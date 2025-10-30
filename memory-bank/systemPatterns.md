# System Patterns & Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React + TS)           │
│  ┌───────────┬──────────┬─────────────┐ │
│  │ Timeline  │  Player  │  Media Lib  │ │
│  │    UI     │    UI    │     UI      │ │
│  └───────────┴──────────┴─────────────┘ │
│         Zustand State Management        │
└──────────────┬──────────────────────────┘
               │ Tauri IPC Bridge
┌──────────────▼──────────────────────────┐
│         Rust Backend (Tauri)            │
│  ┌────────────┬─────────────────────┐   │
│  │  Recording │  FFmpeg Processing  │   │
│  │   (Native) │    (Sidecar)        │   │
│  └────────────┴─────────────────────┘   │
│         File System & Media I/O         │
└─────────────────────────────────────────┘
```

## Component Organization

### Frontend Structure ✅ IMPLEMENTED
```
src/
├── components/          # React UI components ✅ IMPLEMENTED
│   ├── MediaLibrary/   # Import and clip management ✅ COMPLETE
│   ├── Timeline/       # Timeline editor components ✅ COMPLETE
│   ├── Preview/        # Video player and controls ✅ COMPLETE
│   ├── Export/         # Export dialog and progress ✅ COMPLETE
│   └── Layout/         # App layout and structure ✅ COMPLETE
├── stores/             # Zustand state management ✅ COMPLETE
│   ├── mediaStore.ts   # Imported clips state (19 tests)
│   ├── timelineStore.ts # Timeline composition state (29 tests)
│   └── exportStore.ts  # Export progress state (29 tests)
├── hooks/              # Custom React hooks ✅ IMPLEMENTED
├── utils/              # Helper functions ✅ COMPLETE
│   ├── timeFormat.ts   # Time utilities (15 tests)
│   ├── fileSize.ts     # File size utilities (14 tests)
│   ├── videoCalculations.ts # Video utilities (20 tests)
│   ├── general.ts      # General utilities (29 tests)
│   └── index.ts        # Re-exports
└── types/              # TypeScript interfaces ✅ COMPLETE
    ├── media.ts        # MediaClip interface
    ├── timeline.ts     # TimelineClip, TimelineTrack interfaces
    ├── video.ts        # VideoMetadata interface
    ├── export.ts       # ExportSettings, ExportProgress interfaces
    ├── error.ts        # AppError interface
    ├── common.ts       # Common utility types
    └── index.ts        # Re-exports
```

### Backend Structure ✅ IMPLEMENTED
```
src-tauri/src/
├── commands/           # Tauri command handlers ✅ COMPLETE
│   ├── mod.rs         # Command module exports ✅
│   ├── file_ops.rs    # File import/management ✅
│   ├── metadata.rs    # Video metadata extraction ✅
│   └── export.rs      # Export coordination ✅
├── ffmpeg/            # FFmpeg integration ✅ COMPLETE
│   ├── probe.rs       # Metadata extraction ✅
│   ├── thumbnail.rs   # Thumbnail generation ✅
│   └── export.rs      # Video export execution ✅
└── recording/         # Screen recording features ✅ IN PROGRESS
    ├── mod.rs         # Module exports
    ├── screen.rs      # Screen recording (AVFoundation)
    ├── session.rs     # Recording session management
    └── permissions.rs # Permission handling
```

## State Management Pattern ✅ IMPLEMENTED

### Zustand Stores Architecture
Each store is independent but can access others when needed:

**mediaStore**: Source of truth for imported clips ✅ COMPLETE
- Stores: clip metadata, thumbnails, file paths
- Actions: add, remove, query clips, computed values
- Never modified by timeline operations
- **Tests**: 19 comprehensive test cases

**timelineStore**: Composition and playback state ✅ COMPLETE
- Stores: timeline clips, playhead, playback state, zoom
- Actions: add/update/remove clips, move playhead, control playback
- References mediaStore for source clip data
- **Tests**: 29 comprehensive test cases

**exportStore**: Export process state ✅ COMPLETE
- Stores: progress, status, errors, settings
- Actions: start/cancel export, update progress, manage settings
- Reads from timelineStore and mediaStore during export
- **Tests**: 29 comprehensive test cases

### Data Flow Pattern ✅ IMPLEMENTED
```
User Action → Component → Store Action → State Update → Component Re-render
                    ↓
              Tauri Command (if backend needed)
                    ↓
              Rust Handler → FFmpeg → Response
                    ↓
              Event/Return → Store Update
```

### Store Implementation Patterns ✅ IMPLEMENTED

#### 1. Computed Values Pattern
**Problem**: Zustand getters don't automatically recalculate when dependencies change
**Solution**: Explicit state properties updated by actions

```typescript
// ❌ Old approach (getters)
const useMediaStore = create((set, get) => ({
  clips: [],
  get totalDuration() {
    return get().clips.reduce((sum, clip) => sum + clip.duration, 0);
  }
}));

// ✅ New approach (explicit properties)
const useMediaStore = create((set, get) => ({
  clips: [],
  totalDuration: 0, // Explicit state property
  
  addClip: (clip) => set((state) => {
    const newClips = [...state.clips, clip];
    return {
      clips: newClips,
      totalDuration: newClips.reduce((sum, c) => sum + c.duration, 0)
    };
  })
}));
```

#### 2. Factory Functions Pattern ✅ IMPLEMENTED
**Purpose**: Consistent object creation with validation and defaults

```typescript
// ✅ All data models have factory functions
export function createMediaClip(data: Omit<MediaClip, 'id' | 'createdAt'>): MediaClip {
  return {
    id: generateRandomId(),
    createdAt: new Date().toISOString(),
    ...data
  };
}

export function createTimelineClip(data: Omit<TimelineClip, 'id'>): TimelineClip {
  return {
    id: generateRandomId(),
    ...data
  };
}
```

#### 3. Error Handling Pattern ✅ IMPLEMENTED
**Purpose**: Consistent error management across stores

```typescript
// ✅ Structured error interface
export interface AppError {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
}

// ✅ Error factory function
export function createAppError(code: string, message: string, details?: string): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}
```

## Key Technical Patterns

### 1. FFmpeg Sidecar Pattern ✅ IMPLEMENTED
**Why**: Avoid compilation complexity, get full FFmpeg features
**How**: Bundle pre-compiled static binaries for each architecture

```rust
// Access FFmpeg via Tauri Shell API
let sidecar = app.shell().sidecar("ffmpeg")?;
let output = sidecar
    .args(&["-i", "input.mp4", ...])
    .output()
    .await?;
```

**Status**: ✅ Binaries downloaded, permissions configured, and integration working
- Intel binary: `ffmpeg-x86_64-apple-darwin` ✅ WORKING
- Apple Silicon binary: `ffmpeg-aarch64-apple-darwin` ✅ WORKING
- Permissions: `shell:allow-execute` and `shell:allow-spawn` ✅ CONFIGURED
- Commands: Metadata extraction, thumbnail generation, export ✅ IMPLEMENTED

### 2. Video Playback Synchronization ✅ IMPLEMENTED
**Challenge**: Keep HTML5 video in sync with timeline playhead

**Pattern**:
```typescript
// On playhead change
const activeClip = getClipAtTime(playhead);
if (activeClip) {
  videoRef.current.src = activeClip.filepath;
  const clipTime = playhead - activeClip.startTime + activeClip.trimStart;
  videoRef.current.currentTime = clipTime;
}

// During playback
requestAnimationFrame(() => {
  const timelineTime = activeClip.startTime + 
    videoRef.current.currentTime - activeClip.trimStart;
  setPlayhead(timelineTime);
});
```

**Status**: ✅ Implemented in useVideoPlayback hook with smooth synchronization

### 3. Timeline Rendering Pattern ✅ IMPLEMENTED
**Approach**: DOM-based rendering with CSS positioning

**Calculation**:
```typescript
// Convert time to pixels
const pixelsPerSecond = BASE_PPS * zoom;
const clipX = clip.startTime * pixelsPerSecond;
const clipWidth = clip.duration * pixelsPerSecond;

// Position clip on timeline
<div style={{
  position: 'absolute',
  left: `${clipX}px`,
  width: `${clipWidth}px`,
  top: `${clip.trackIndex * TRACK_HEIGHT}px`
}} />
```

**Performance considerations**:
- Use `React.memo` for timeline clips ✅ IMPLEMENTED
- Debounce updates during drag operations ✅ IMPLEMENTED
- Consider Canvas rendering if > 50 clips (not needed yet)

**Status**: ✅ Implemented with TimelineClip component and smooth drag operations

### 4. Export Concatenation Pattern ✅ IMPLEMENTED
**MVP Strategy**: Simple concatenation without re-encoding

```rust
// Generate concat file
let concat_content = clips.iter()
    .map(|c| format!("file '{}'", c.filepath))
    .collect::<Vec<_>>()
    .join("\n");

// Execute FFmpeg
ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4
```

**Features**:
- Timeline order preservation with track-based sorting
- Chronological validation and overlap detection
- Temporary file management with cleanup
- Clean production logging without debug spam
- Comprehensive error handling and validation
**Status**: ✅ Implemented and tested

### 5. Thumbnail Generation Pattern ✅ IMPLEMENTED
**When**: On import, after metadata extraction
**Where**: App data directory (`~/Library/Application Support/com.clipforge.app/thumbnails/`)

```rust
// Extract frame at 1 second
ffmpeg -ss 1 -i {video_path} -vframes 1 -q:v 2 {thumbnail_path}
```

**Caching**: Store thumbnails permanently, key by video filepath hash
**Status**: ✅ Implemented and tested

### 6. Progress Tracking Pattern ✅ IMPLEMENTED
**Challenge**: FFmpeg doesn't provide structured progress output

**Solution**: Parse stderr for progress indicators:
```rust
// Look for patterns like: "frame= 123 fps=30 time=00:00:04.10"
let regex = Regex::new(r"frame=\s*(\d+).*time=(\S+)")?;

// Calculate percentage
let progress = (current_frame / total_frames) * 100.0;

// Emit event to frontend
app.emit_all("export-progress", ExportProgress { 
    progress, 
    current_frame, 
    total_frames 
})?;
```

**Features**:
- Real-time progress updates with time estimates
- Export cancellation with process termination
- Error handling with user-friendly messages
- Clean production logging without debug spam
**Status**: ✅ Export store with progress tracking implemented

### 7. Drag and Drop Pattern ✅ IMPLEMENTED
**Media Library → Timeline**:
```typescript
// On media card
<div 
  draggable 
  onDragStart={e => e.dataTransfer.setData('clipId', clip.id)}
>

// On timeline track
<div 
  onDragOver={e => e.preventDefault()}
  onDrop={e => {
    const clipId = e.dataTransfer.getData('clipId');
    const time = (e.clientX - trackRect.left) / pixelsPerSecond;
    addClipToTimeline(clipId, trackIndex, time);
  }}
>
```

**Status**: ✅ Implemented with mouse-based drag-and-drop for Tauri compatibility

## File System Organization

### Application Data Directory
```
~/Library/Application Support/com.clipforge.app/
├── media/              # Imported clips cache (future)
├── thumbnails/         # Generated thumbnails
│   └── {hash}.jpg
├── recordings/         # Screen/webcam recordings ✅ IN PROGRESS
└── logs/              # Application logs (future)
```

### Recording Architecture ✅ IN PROGRESS

**Hybrid approach**: Screen recording (backend) + Webcam recording (frontend)

#### Screen Recording (Rust Backend)
- **Technology**: AVFoundation (macOS native)
- **Implementation**: Rust commands with Tauri IPC
- **Features**: Screen enumeration, display capture, permission handling
- **Storage**: App data directory

#### Webcam Recording (Frontend Web APIs)
- **Technology**: getUserMedia + MediaRecorder
- **Implementation**: React hooks with browser APIs
- **Features**: Camera enumeration, live preview, recording
- **Why Web APIs**: 
  - Cross-platform compatibility
  - No Objective-C bindings needed
  - Native browser optimization
  - Simpler maintenance

#### Camera Preview
- **Technology**: getUserMedia (Web APIs)
- **Implementation**: Direct MediaStream to video element
- **Benefits**: Real-time, no IPC overhead, built-in permission handling
- **Configuration**: Tauri webview configured with `mediaDevices` API access

#### Picture-in-Picture
- **Combination**: Screen recording (AVFoundation) + webcam stream (getUserMedia)
- **Composition**: Frontend combines both streams
- **Recording**: Both sources recorded simultaneously

### Temporary Files
```
/tmp/clipforge/
├── export/            # Temp files during export
├── concat_*.txt       # FFmpeg concat lists
├── trimmed_clip_*.mp4 # Trimmed video clips (if needed)
└── temp_*.txt         # Other temporary files
```

**Cleanup**: Robust temporary file management with automatic cleanup after export completion, failure, or app exit

## Error Handling Strategy ✅ IMPLEMENTED

### Frontend Errors ✅ IMPLEMENTED
- Toast notifications for non-critical errors
- Modal dialogs for critical errors requiring user action
- Console logging for debugging
- **Status**: AppError interface and factory functions implemented

### Backend Errors ✅ IMPLEMENTED
- Structured error types in Rust ✅ IMPLEMENTED
- User-friendly error messages ✅ IMPLEMENTED
- Detailed logging for debugging ✅ IMPLEMENTED

### FFmpeg Errors ✅ IMPLEMENTED
- Parse stderr for error messages ✅ IMPLEMENTED
- Map common errors to user actions ✅ IMPLEMENTED
- Always clean up partial/failed exports ✅ IMPLEMENTED

## Performance Optimization Strategies ✅ IMPLEMENTED

### Frontend ✅ IMPLEMENTED
1. **Selective rendering**: Use Zustand selectors to minimize re-renders
2. **Debouncing**: Debounce timeline scrubbing and drag operations (utility functions ready)
3. **Lazy loading**: Load thumbnails only for visible clips
4. **Memoization**: Memo expensive components (timeline clips)

### Backend ✅ IMPLEMENTED
1. **Streaming**: Stream FFmpeg output, don't load into memory ✅ IMPLEMENTED
2. **Async operations**: All FFmpeg operations are async ✅ IMPLEMENTED
3. **Concurrent processing**: Process thumbnails in parallel ✅ IMPLEMENTED
4. **Resource cleanup**: Always clean up temp files and handles ✅ IMPLEMENTED

### Video Playback (Next Phase)
1. **Preloading**: Preload next clip during playback
2. **Fast seek**: Use `fastSeek()` when available
3. **Pause when hidden**: Stop updates when window minimized

## Security & Permissions ✅ CONFIGURED

### Required Permissions ✅ CONFIGURED
- File system: Read/write via Tauri file dialog (sandboxed)
- Shell: Execute FFmpeg sidecar ✅ CONFIGURED
- Screen recording: AVFoundation access ✅ CONFIGURED (entitlements.plist)
- Camera: Web APIs (getUserMedia) ✅ CONFIGURED (webview + entitlements)
- Microphone: Web APIs (getUserMedia) ✅ CONFIGURED (webview + entitlements)

### Sandboxing ✅ CONFIGURED
- All file access via Tauri APIs (no arbitrary file access)
- FFmpeg only accessible via sidecar pattern ✅ CONFIGURED
- No network access (all operations local)

## Testing Patterns ✅ IMPLEMENTED

### Unit Testing Strategy ✅ COMPLETE
- **155+ tests** across 7+ files
- **Store tests**: Complete coverage of all state management
- **Utility tests**: Complete coverage of all helper functions
- **Backend tests**: FFmpeg integration and command handlers
- **Export tests**: Timeline order preservation and temporary file management
- **Edge cases**: Floating-point precision, boundary conditions, error handling
- **Real-world scenarios**: Practical usage patterns and workflows

### Test Organization ✅ IMPLEMENTED
```
src/
├── stores/
│   ├── mediaStore.test.ts      # 19 tests
│   ├── timelineStore.test.ts    # 29 tests
│   └── exportStore.test.ts      # 29 tests
└── utils/
    ├── timeFormat.test.ts       # 15 tests
    ├── fileSize.test.ts         # 14 tests
    ├── videoCalculations.test.ts # 20 tests
    └── general.test.ts          # 29 tests
```

### Test Patterns ✅ IMPLEMENTED
1. **State Reset**: Each test resets store state
2. **Edge Cases**: Invalid inputs, boundary conditions
3. **Error Handling**: Comprehensive error scenarios
4. **Integration**: Cross-function dependencies
5. **Performance**: Async operations, debouncing, throttling

## Development Patterns ✅ IMPLEMENTED

### TypeScript Standards ✅ IMPLEMENTED
- **Strict mode**: Full type safety enabled
- **Path aliases**: Clean import structure (`@/components`, `@/stores`, etc.)
- **Modular types**: Domain-specific type files
- **Factory functions**: Consistent object creation
- **Error handling**: Structured error management

### Code Organization ✅ IMPLEMENTED
- **Separation of concerns**: Clear boundaries between stores, utils, types
- **Re-exports**: Clean API through index files
- **Documentation**: Comprehensive inline documentation
- **Consistency**: Uniform patterns across all modules

### Performance Patterns ✅ IMPLEMENTED
- **Computed values**: Explicit state properties instead of getters
- **Optimized selectors**: Zustand selectors for minimal re-renders
- **Utility functions**: Debounce, throttle, deep clone, etc.
- **Memory management**: Proper cleanup and resource management

## Next Phase Patterns (To Implement)

### UI Component Patterns
- Compound components ✅ IMPLEMENTED (Timeline components)
- Render props ✅ IMPLEMENTED (Custom hooks)
- Custom hooks ✅ IMPLEMENTED (useVideoPlayback, useDragAndDrop)
- Error boundaries ❌ PENDING

### Integration Patterns
- IPC communication ✅ IMPLEMENTED (Tauri commands)
- Event handling ✅ IMPLEMENTED (Timeline events)
- State synchronization ✅ IMPLEMENTED (Zustand stores)
- Error propagation ✅ IMPLEMENTED (Error handling system)

---

**Document Status**: All core patterns implemented, MVP complete
**Next Update**: After advanced features implementation
