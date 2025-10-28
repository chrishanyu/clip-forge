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

### Frontend Structure
```
src/
├── components/          # React UI components
│   ├── MediaLibrary/   # Import and clip management
│   ├── Timeline/       # Timeline editor components
│   ├── Preview/        # Video player and controls
│   ├── Export/         # Export dialog and progress
│   └── Layout/         # App layout and structure
├── stores/             # Zustand state management
│   ├── mediaStore.ts   # Imported clips state
│   ├── timelineStore.ts # Timeline composition state
│   └── exportStore.ts  # Export progress state
├── hooks/              # Custom React hooks
├── utils/              # Helper functions
└── types/              # TypeScript interfaces
```

### Backend Structure
```
src-tauri/src/
├── commands/           # Tauri command handlers
│   ├── file_ops.rs    # File import/management
│   ├── metadata.rs    # Video metadata extraction
│   └── export.rs      # Export coordination
├── ffmpeg/            # FFmpeg integration
│   ├── probe.rs       # Metadata extraction
│   ├── thumbnail.rs   # Thumbnail generation
│   └── export.rs      # Video export execution
└── recording/         # Recording features (Phase 2)
```

## State Management Pattern

### Zustand Stores Architecture
Each store is independent but can access others when needed:

**mediaStore**: Source of truth for imported clips
- Stores: clip metadata, thumbnails, file paths
- Actions: add, remove, query clips
- Never modified by timeline operations

**timelineStore**: Composition and playback state
- Stores: timeline clips, playhead, playback state
- Actions: add/update/remove clips, move playhead, control playback
- References mediaStore for source clip data

**exportStore**: Export process state
- Stores: progress, status, errors
- Actions: start/cancel export, update progress
- Reads from timelineStore and mediaStore during export

### Data Flow Pattern
```
User Action → Component → Store Action → State Update → Component Re-render
                    ↓
              Tauri Command (if backend needed)
                    ↓
              Rust Handler → FFmpeg → Response
                    ↓
              Event/Return → Store Update
```

## Key Technical Patterns

### 1. FFmpeg Sidecar Pattern
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

**Considerations**:
- Large bundle size (~100MB per architecture)
- Must configure permissions in capabilities/default.json
- Binary naming includes target triple: `ffmpeg-{arch}-apple-darwin`

### 2. Video Playback Synchronization
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

### 3. Timeline Rendering Pattern
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
- Use `React.memo` for timeline clips
- Debounce updates during drag operations
- Consider Canvas rendering if > 50 clips

### 4. Export Concatenation Pattern
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

**Limitations**:
- All clips must have same codec/resolution
- No trim support (MVP limitation)
- Fast but inflexible

**Future enhancement**: Re-encode with trim support:
```bash
ffmpeg -ss {trim_start} -t {duration} -i input.mp4 -c copy segment.mp4
# Then concatenate segments
```

### 5. Thumbnail Generation Pattern
**When**: On import, after metadata extraction
**Where**: App data directory (`~/Library/Application Support/com.clipforge.app/thumbnails/`)

```rust
// Extract frame at 1 second
ffmpeg -ss 1 -i {video_path} -vframes 1 -q:v 2 {thumbnail_path}
```

**Caching**: Store thumbnails permanently, key by video filepath hash

### 6. Progress Tracking Pattern
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

### 7. Drag and Drop Pattern
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

**Within Timeline** (reorder):
Use mouse event handlers instead of drag events for better control during repositioning.

## File System Organization

### Application Data Directory
```
~/Library/Application Support/com.clipforge.app/
├── media/              # Imported clips cache (future)
├── thumbnails/         # Generated thumbnails
│   └── {hash}.jpg
├── recordings/         # Screen/webcam recordings (Phase 2)
└── logs/              # Application logs (future)
```

### Temporary Files
```
/tmp/clipforge/
├── export/            # Temp files during export
└── concat_*.txt       # FFmpeg concat lists
```

**Cleanup**: Remove temp files after export completion or app exit

## Error Handling Strategy

### Frontend Errors
- Toast notifications for non-critical errors
- Modal dialogs for critical errors requiring user action
- Console logging for debugging

### Backend Errors
- Structured error types in Rust
- User-friendly error messages
- Detailed logging for debugging

### FFmpeg Errors
- Parse stderr for error messages
- Map common errors to user actions
- Always clean up partial/failed exports

## Performance Optimization Strategies

### Frontend
1. **Selective rendering**: Use Zustand selectors to minimize re-renders
2. **Debouncing**: Debounce timeline scrubbing and drag operations
3. **Lazy loading**: Load thumbnails only for visible clips
4. **Memoization**: Memo expensive components (timeline clips)

### Backend
1. **Streaming**: Stream FFmpeg output, don't load into memory
2. **Async operations**: All FFmpeg operations are async
3. **Concurrent processing**: Process thumbnails in parallel
4. **Resource cleanup**: Always clean up temp files and handles

### Video Playback
1. **Preloading**: Preload next clip during playback
2. **Fast seek**: Use `fastSeek()` when available
3. **Pause when hidden**: Stop updates when window minimized

## Security & Permissions

### Required Permissions
- File system: Read/write via Tauri file dialog (sandboxed)
- Shell: Execute FFmpeg sidecar
- Screen recording: AVFoundation access (Phase 2)
- Camera: AVFoundation access (Phase 2)
- Microphone: Audio input (Phase 2)

### Sandboxing
- All file access via Tauri APIs (no arbitrary file access)
- FFmpeg only accessible via sidecar pattern
- No network access (all operations local)

