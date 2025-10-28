# ClipForge - Product Requirements Document (PRD)

## Executive Summary

**Product**: ClipForge - Desktop Video Editor  
**Platform**: macOS (Intel + Apple Silicon)  
**Tech Stack**: Tauri 2.0 + React + TypeScript + Zustand  
**Goal**: Production-grade desktop video editor with recording, import, timeline editing, and export capabilities

---

## 1. Product Overview

### 1.1 Vision
Build a native macOS video editor that enables creators to record their screen/webcam, import video clips, arrange them on a timeline, and export professional videos - all within a single desktop application.

### 1.2 Core Value Proposition
- **Native Performance**: Tauri-based desktop app with minimal bundle size
- **Integrated Recording**: Screen + webcam capture without external tools
- **Intuitive Timeline**: Drag-and-drop video editing
- **Fast Export**: FFmpeg-powered video encoding

### 1.3 Success Criteria
- Launch application in < 5 seconds
- Import and preview video within 2 seconds
- Timeline remains responsive with 10+ clips
- Export completes without crashes
- Packaged .dmg installable on any macOS system

---

## 2. Technical Architecture

### 2.1 Stack Components

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

### 2.2 Key Technologies

**Frontend**
- React 18 with TypeScript
- Zustand for state management
- HTML5 `<video>` element for playback
- DOM-based timeline UI with drag-and-drop
- Vite for build tooling

**Backend (Rust)**
- Tauri 2.0 framework
- AVFoundation bindings for screen/webcam recording (macOS native)
- `tauri-plugin-fs` for file operations
- `tauri-plugin-shell` for FFmpeg sidecar execution
- `serde` for JSON serialization

**Media Processing**
- FFmpeg static binaries (bundled as sidecar)
  - `ffmpeg-x86_64-apple-darwin` (Intel Macs)
  - `ffmpeg-aarch64-apple-darwin` (Apple Silicon)
- Simple concatenation for MVP export
- Future: Re-encoding with quality controls

### 2.3 FFmpeg Integration Strategy

**Approach**: Bundle pre-compiled FFmpeg binaries as Tauri sidecars

**Setup**:
1. Download static FFmpeg binaries from official sources
2. Place in `src-tauri/bin/` with proper naming:
   - `ffmpeg-x86_64-apple-darwin`
   - `ffmpeg-aarch64-apple-darwin`
3. Configure in `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": ["bin/ffmpeg"]
  }
}
```

4. Set up permissions in `src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "shell:allow-execute",
    "shell:allow-spawn",
    {
      "identifier": "shell:allow-sidecar",
      "allow": [{ "name": "bin/ffmpeg", "sidecar": true }]
    }
  ]
}
```

**Execution Pattern**:
```rust
// Rust side
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn export_video(
    app: tauri::AppHandle,
    clips: Vec<String>,
    output_path: String
) -> Result<String, String> {
    let sidecar = app.shell().sidecar("ffmpeg")
        .map_err(|e| e.to_string())?;
    
    let output = sidecar
        .args(&["-i", "input.mp4", "-c", "copy", &output_path])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(output_path)
}
```

**Trade-offs**:
- ✅ Zero compilation complexity
- ✅ Full FFmpeg feature set
- ✅ Battle-tested approach in Tauri community
- ✅ Works identically in dev and production
- ❌ Large bundle size (~80-100MB per architecture)

---

## 3. Feature Requirements

### 3.1 MVP Requirements (Hard Gate)

**Must Have**:
1. ✅ Desktop app launches successfully
2. ✅ Video import via drag-and-drop or file picker (MP4, MOV)
3. ✅ Timeline view showing imported clips as visual blocks
4. ✅ Video preview player with play/pause
5. ✅ Basic trim: Set in/out points on a single clip
6. ✅ Export to MP4 (single clip or simple concatenation)
7. ✅ Packaged as installable .dmg

**Technical Validation**:
- App must build with `cargo tauri build`
- Bundle must install and run on clean macOS system
- No crashes during basic import → trim → export workflow

**Out of Scope for MVP**:
- Recording features (defer to full submission)
- Multiple tracks
- Effects or transitions
- Advanced timeline features

### 3.2 Core Features (Full Submission)

#### 3.2.1 Recording Features

**Screen Recording**
- List available screens and windows
- Select full screen or specific window
- Start/stop recording with visual indicator
- Save recording directly to timeline or media library
- Real-time recording duration display

**Webcam Recording**
- Detect and list available cameras
- Preview camera feed before recording
- Record video + audio from camera
- Save to timeline/library

**Picture-in-Picture (Simultaneous)**
- Record screen + webcam simultaneously
- Webcam appears as overlay in configurable position
- Adjustable size (small, medium, large presets)
- Both streams saved as separate tracks on timeline

**Audio Capture**
- Microphone input during recording
- Audio level monitoring (visual meter)
- Mute/unmute during recording

**Implementation Details (Rust)**:
```rust
// Use AVFoundation via objc bindings or screen-capture crate
// Example command structure:
#[tauri::command]
async fn start_screen_recording(
    display_id: u32,
    output_path: String,
    include_audio: bool
) -> Result<String, String> {
    // Initialize AVCaptureSession
    // Add screen input source (AVCaptureScreenInput)
    // Configure video output settings
    // Start recording to file
    // Return recording session ID
}

#[tauri::command]
async fn stop_recording(session_id: String) -> Result<String, String> {
    // Stop the recording session
    // Finalize file
    // Return file path
}

#[tauri::command]
async fn list_available_screens() -> Result<Vec<Screen>, String> {
    // Enumerate displays using CoreGraphics
    // Return list with id, name, bounds
}

#[tauri::command]
async fn list_available_cameras() -> Result<Vec<Camera>, String> {
    // Enumerate AVCaptureDevice.devices(for: .video)
    // Return list with id, name, formats
}
```

**Frontend Integration**:
```typescript
// React component for recording controls
import { invoke } from '@tauri-apps/api/core';

const startRecording = async (type: 'screen' | 'webcam') => {
  const outputPath = await invoke('get_temp_recording_path');
  const sessionId = await invoke('start_screen_recording', {
    displayId: selectedDisplay,
    outputPath,
    includeAudio: true
  });
  
  setRecordingState({ active: true, sessionId, startTime: Date.now() });
};
```

#### 3.2.2 Import & Media Management

**Import Methods**
- Drag and drop files onto app window (anywhere)
- File picker dialog (native macOS dialog via Tauri)
- Support formats: MP4, MOV, WebM
- Batch import (multiple files at once)

**Media Library Panel**
- Grid view of imported clips with thumbnails
- List view option (compact)
- Thumbnail preview (extract first frame or frame at 1s)
- Metadata display per clip:
  - Duration (HH:MM:SS.mmm format)
  - Resolution (e.g., 1920x1080)
  - File size (human-readable: MB, GB)
  - Codec info (H.264, H.265, etc.)
  - Frame rate (30fps, 60fps, etc.)
- Search/filter clips by filename
- Delete clips from library (remove reference, optionally delete file)
- Refresh library (re-scan directory)

**Data Structures**:
```typescript
// Zustand store
interface MediaClip {
  id: string;
  filename: string;
  filepath: string;
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  fileSize: number; // bytes
  thumbnailPath: string;
  createdAt: string;
}

interface MediaStore {
  clips: MediaClip[];
  addClips: (clips: MediaClip[]) => void;
  removeClip: (id: string) => void;
  getClipById: (id: string) => MediaClip | undefined;
}
```

**Rust Commands**:
```rust
#[derive(Serialize, Deserialize)]
struct VideoMetadata {
    duration: f64,
    width: u32,
    height: u32,
    fps: f64,
    codec: String,
    file_size: u64,
}

#[tauri::command]
async fn extract_video_metadata(path: String) -> Result<VideoMetadata, String> {
    // Use FFmpeg to probe video file
    // ffmpeg -i input.mp4 -hide_banner
    // Parse output for metadata
}

#[tauri::command]
async fn generate_thumbnail(
    video_path: String,
    output_path: String,
    timestamp: f64
) -> Result<String, String> {
    // Use FFmpeg to extract frame
    // ffmpeg -ss {timestamp} -i {video_path} -vframes 1 -q:v 2 {output_path}
}
```

#### 3.2.3 Timeline Editor

**Core Timeline Features**
- Horizontal timeline with time ruler (showing seconds/minutes)
- Visual representation of clips as colored blocks
- Multiple tracks (minimum 2):
  - Track 1: Main video
  - Track 2: Overlay/PiP/Additional clips
- Drag clips from media library onto timeline
- Drag clips within timeline to reorder
- Playhead (vertical line) showing current time position
- Time display (HH:MM:SS.mmm) next to playhead

**Clip Manipulation**
- **Trim**: Adjust clip start/end by dragging edges
- **Split**: Cut clip at playhead position (creates two clips)
- **Delete**: Remove clip from timeline (Del/Backspace key)
- **Move**: Drag clip to different position or track
- **Duplicate**: Copy clip (Cmd+D)

**Timeline Controls**
- Zoom in/out (pinch gesture, zoom slider, or Cmd +/-)
  - Zoom levels: 1x, 2x, 5x, 10x, 20x
- Horizontal scroll (when zoomed)
- Snap-to-grid toggle (snap clips to second boundaries)
- Snap-to-clip edges (automatic alignment)
- Fit timeline to window

**Visual Design**
- Each clip shows thumbnail strip (multiple frames)
- Clip duration displayed on block
- Waveform visualization (stretch goal)
- Track height adjustable
- Color-coded by source or track

**Data Structures**:
```typescript
interface TimelineClip {
  id: string;
  mediaClipId: string; // Reference to MediaClip
  trackIndex: number; // 0, 1, 2...
  startTime: number; // Timeline position in seconds
  duration: number; // Actual duration after trim
  trimStart: number; // Trim in point (original clip time)
  trimEnd: number; // Trim out point (original clip time)
  volume: number; // 0-1
}

interface TimelineStore {
  clips: TimelineClip[];
  playhead: number; // Current time in seconds
  duration: number; // Total timeline duration
  zoom: number; // 1x, 2x, 5x, etc.
  snapToGrid: boolean;
  
  addClipToTimeline: (clip: MediaClip, trackIndex: number, startTime: number) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  removeClip: (id: string) => void;
  splitClipAtPlayhead: () => void;
  setPlayhead: (time: number) => void;
  getTotalDuration: () => number;
}
```

**Timeline Rendering Logic**:
- Calculate pixel-to-time ratio based on zoom level
- Convert timeline seconds to pixel positions
- Handle overlapping clips (disallow or push adjacent clips)
- Update on drag events with debouncing for performance

#### 3.2.4 Preview & Playback

**Video Player**
- HTML5 `<video>` element with controls disabled (custom UI)
- Display current frame based on playhead position
- Real-time preview of timeline composition
- Synchronized with timeline playhead

**Playback Controls**
- Play/Pause (spacebar)
- Skip forward/backward (arrow keys)
  - Left/Right: 1 second
  - Shift+Left/Right: 5 seconds
- Jump to start/end (Home/End keys)
- Frame-by-frame stepping (Cmd+Left/Right)
- Playback speed control (0.25x, 0.5x, 1x, 1.5x, 2x)

**Scrubbing**
- Drag playhead on timeline to any position
- Click anywhere on timeline to jump
- Real-time preview updates during scrub
- Smooth seeking without lag

**Audio Playback**
- Synchronized audio during playback
- Volume control (master volume slider)
- Mute toggle

**Preview Rendering Strategy**:
```typescript
// When playhead moves:
1. Determine which clip(s) are active at current time
2. For single clip:
   - Set video.src to clip filepath
   - Set video.currentTime to (playhead - clip.startTime + clip.trimStart)
3. For multiple clips (overlays):
   - Render main clip in primary <video>
   - Render overlay in secondary <video> with CSS positioning
   - Synchronize both
4. Update on every requestAnimationFrame during playback
```

**Performance Optimization**:
- Preload adjacent clips
- Use video seek with `fastSeek()` when available
- Debounce scrubbing updates
- Pause rendering when window is not focused

#### 3.2.5 Export & Sharing

**Export Configuration**
- Output format: MP4 (H.264 codec)
- Resolution options:
  - Source resolution (maintain original)
  - 1080p (1920x1080)
  - 720p (1280x720)
  - Custom (user-specified)
- Frame rate: Match source or specify (30fps, 60fps)
- Quality preset:
  - High (higher bitrate, larger file)
  - Medium (balanced)
  - Low (smaller file, lower quality)

**Export Process**
1. User clicks "Export" button
2. Show export dialog with settings
3. User selects output file location (native save dialog)
4. Generate FFmpeg command based on timeline
5. Execute FFmpeg via sidecar
6. Show progress modal with:
   - Progress bar (0-100%)
   - Current frame / total frames
   - Estimated time remaining
   - Cancel button
7. On completion: Show success message with "Open file location" button
8. On error: Show error message with details

**FFmpeg Export Strategy**:

For MVP (Simple Concatenation):
```bash
# Generate concat file listing all clips in order
# file 'clip1.mp4'
# file 'clip2.mp4'
# Then run:
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4
```

For Full Submission (With Trims):
```bash
# For each clip with trims, create a segment
ffmpeg -i input.mp4 -ss {trim_start} -t {duration} -c copy segment1.mp4

# Then concatenate all segments
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4
```

For Advanced (Re-encoding with effects):
```bash
# Complex filter graph with overlays, transitions
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0:v][1:v]overlay=x=10:y=10[out]" \
  -map "[out]" -map 0:a -c:v libx264 -crs 23 -c:a aac output.mp4
```

**Rust Export Command**:
```rust
#[tauri::command]
async fn export_timeline(
    app: tauri::AppHandle,
    clips: Vec<ExportClip>,
    output_path: String,
    settings: ExportSettings
) -> Result<(), String> {
    // 1. Generate temporary concat file or filter complex
    // 2. Spawn FFmpeg sidecar with appropriate args
    // 3. Parse stdout/stderr for progress
    // 4. Emit progress events to frontend
    // 5. Return on completion or error
}

#[derive(Deserialize)]
struct ExportClip {
    filepath: String,
    trim_start: f64,
    trim_end: f64,
    start_time: f64,
}

#[derive(Deserialize)]
struct ExportSettings {
    width: u32,
    height: u32,
    fps: u32,
    quality: String, // "high", "medium", "low"
}
```

**Progress Tracking**:
```typescript
// Frontend listens to progress events
import { listen } from '@tauri-apps/api/event';

listen('export-progress', (event) => {
  const { frame, totalFrames, fps, elapsed } = event.payload;
  const progress = (frame / totalFrames) * 100;
  const remaining = ((totalFrames - frame) / fps);
  
  updateExportProgress({ progress, remaining });
});
```

**Bonus: Cloud Upload** (Stretch Goal)
- After export completes, offer upload to:
  - Google Drive (via OAuth)
  - Dropbox (via OAuth)
  - Generate shareable link
- Show upload progress
- Copy link to clipboard on completion

---

## 4. User Interface Design

### 4.1 Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ClipForge                    ⚫ 🟡 🟢  [Record] [Export]   │ Header
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   Media      │         Video Preview Player                │
│   Library    │                                              │
│              │         [▶️ Play] [⏸️] [⏹️]                  │
│  [+ Import]  │                                              │
│              │         00:00:15.240 / 00:02:30.000          │
│  ┌─────────┐ │                                              │
│  │ Clip 1  │ │                                              │
│  │ 00:30   │ ├──────────────────────────────────────────────┤
│  └─────────┘ │                                              │
│              │         Timeline                             │
│  ┌─────────┐ │  ┌────────────────────────────────────────┐ │
│  │ Clip 2  │ │  │ Track 1: [====Clip1====][==Clip2==]    │ │
│  │ 01:15   │ │  │ Track 2: [==PiP==]                     │ │
│  └─────────┘ │  └────────────────────────────────────────┘ │
│              │  [Zoom: 1x] [Snap: ON]                      │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 4.2 Component Specifications

**Header Bar**
- App title/logo (left)
- macOS traffic lights (standard position)
- Record button (red, prominent)
- Export button (primary color)
- Settings menu (gear icon)

**Media Library (Left Sidebar)**
- Width: 240px (collapsible)
- Import button at top
- Grid of clip thumbnails (2 per row)
- Each thumbnail shows:
  - Preview image
  - Filename (truncated)
  - Duration badge
- Hover: Show metadata tooltip
- Right-click: Context menu (Delete, Show in Finder)

**Video Preview (Center Top)**
- 16:9 aspect ratio maintained
- Black bars for different aspect ratios
- Custom video controls overlay
- Click to play/pause
- Time display below player

**Timeline (Center Bottom)**
- Height: 200-300px
- Resizable divider with preview
- Zoom controls in top-right corner
- Time ruler at top
- Tracks stacked vertically
- Playhead (red line) draggable

**Modals/Dialogs**
- Recording setup (select screen/camera)
- Export settings
- Progress indicator during export
- Error messages

### 4.3 Design Tokens

**Colors**
- Primary: #3B82F6 (Blue)
- Danger: #EF4444 (Red) - for recording
- Success: #10B981 (Green)
- Background: #1F2937 (Dark gray)
- Surface: #374151 (Lighter gray)
- Text: #F9FAFB (White)
- Text Secondary: #9CA3AF (Gray)

**Typography**
- Font Family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Sizes:
  - Heading: 24px / 600 weight
  - Subheading: 18px / 500 weight
  - Body: 14px / 400 weight
  - Caption: 12px / 400 weight

**Spacing**
- Base unit: 8px
- Padding: 8px, 16px, 24px, 32px
- Gaps: 8px, 16px

---

## 5. Data Models & State Management

### 5.1 Zustand Store Structure

```typescript
// src/stores/mediaStore.ts
interface MediaClip {
  id: string;
  filename: string;
  filepath: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  fileSize: number;
  thumbnailPath: string;
  createdAt: string;
}

interface MediaStore {
  clips: MediaClip[];
  loading: boolean;
  
  addClips: (clips: MediaClip[]) => void;
  removeClip: (id: string) => void;
  getClipById: (id: string) => MediaClip | undefined;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  clips: [],
  loading: false,
  
  addClips: (newClips) => set((state) => ({
    clips: [...state.clips, ...newClips]
  })),
  
  removeClip: (id) => set((state) => ({
    clips: state.clips.filter(c => c.id !== id)
  })),
  
  getClipById: (id) => get().clips.find(c => c.id === id),
}));
```

```typescript
// src/stores/timelineStore.ts
interface TimelineClip {
  id: string;
  mediaClipId: string;
  trackIndex: number;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
}

interface TimelineStore {
  clips: TimelineClip[];
  playhead: number;
  playing: boolean;
  zoom: number;
  snapToGrid: boolean;
  
  addClipToTimeline: (mediaClip: MediaClip, trackIndex: number) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  removeClip: (id: string) => void;
  splitClipAtPlayhead: () => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  getTotalDuration: () => number;
  getActiveClipsAtTime: (time: number) => TimelineClip[];
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  clips: [],
  playhead: 0,
  playing: false,
  zoom: 1,
  snapToGrid: true,
  
  addClipToTimeline: (mediaClip, trackIndex) => {
    const newClip: TimelineClip = {
      id: uuidv4(),
      mediaClipId: mediaClip.id,
      trackIndex,
      startTime: get().getTotalDuration(), // Append to end
      duration: mediaClip.duration,
      trimStart: 0,
      trimEnd: mediaClip.duration,
      volume: 1,
    };
    set((state) => ({ clips: [...state.clips, newClip] }));
  },
  
  updateClip: (id, updates) => set((state) => ({
    clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  
  removeClip: (id) => set((state) => ({
    clips: state.clips.filter(c => c.id !== id)
  })),
  
  splitClipAtPlayhead: () => {
    const playhead = get().playhead;
    const clips = get().clips;
    
    // Find clip at playhead
    const clipToSplit = clips.find(c => 
      playhead >= c.startTime && playhead < c.startTime + c.duration
    );
    
    if (!clipToSplit) return;
    
    const splitPoint = playhead - clipToSplit.startTime;
    
    const firstHalf: TimelineClip = {
      ...clipToSplit,
      duration: splitPoint,
      trimEnd: clipToSplit.trimStart + splitPoint,
    };
    
    const secondHalf: TimelineClip = {
      ...clipToSplit,
      id: uuidv4(),
      startTime: playhead,
      duration: clipToSplit.duration - splitPoint,
      trimStart: clipToSplit.trimStart + splitPoint,
    };
    
    set((state) => ({
      clips: [
        ...state.clips.filter(c => c.id !== clipToSplit.id),
        firstHalf,
        secondHalf
      ]
    }));
  },
  
  setPlayhead: (time) => set({ playhead: time }),
  setPlaying: (playing) => set({ playing }),
  
  getTotalDuration: () => {
    const clips = get().clips;
    if (clips.length === 0) return 0;
    return Math.max(...clips.map(c => c.startTime + c.duration));
  },
  
  getActiveClipsAtTime: (time) => {
    return get().clips.filter(c => 
      time >= c.startTime && time < c.startTime + c.duration
    ).sort((a, b) => a.trackIndex - b.trackIndex);
  },
}));
```

```typescript
// src/stores/recordingStore.ts
interface RecordingStore {
  isRecording: boolean;
  recordingType: 'screen' | 'webcam' | 'both' | null;
  sessionId: string | null;
  startTime: number | null;
  duration: number;
  
  startRecording: (type: 'screen' | 'webcam' | 'both') => Promise<void>;
  stopRecording: () => Promise<string>; // Returns filepath
  updateDuration: () => void;
}
```

```typescript
// src/stores/exportStore.ts
interface ExportStore {
  exporting: boolean;
  progress: number; // 0-100
  currentFrame: number;
  totalFrames: number;
  estimatedTimeRemaining: number;
  
  startExport: (settings: ExportSettings) => Promise<void>;
  cancelExport: () => void;
  updateProgress: (progress: ExportProgress) => void;
}
```

### 5.2 Rust-TypeScript Bridge (Tauri Commands)

**File Operations**
```rust
#[tauri::command]
async fn import_video_files(paths: Vec<String>) -> Result<Vec<VideoMetadata>, String>

#[tauri::command]
async fn extract_video_metadata(path: String) -> Result<VideoMetadata, String>

#[tauri::command]
async fn generate_thumbnail(
    video_path: String,
    output_path: String,
    timestamp: f64
) -> Result<String, String>

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String>
```

**Recording**
```rust
#[tauri::command]
async fn list_available_screens() -> Result<Vec<ScreenInfo>, String>

#[tauri::command]
async fn list_available_cameras() -> Result<Vec<CameraInfo>, String>

#[tauri::command]
async fn start_screen_recording(
    display_id: u32,
    output_path: String,
    include_audio: bool
) -> Result<String, String> // Returns session_id

#[tauri::command]
async fn start_webcam_recording(
    camera_id: String,
    output_path: String
) -> Result<String, String> // Returns session_id

#[tauri::command]
async fn stop_recording(session_id: String) -> Result<String, String> // Returns file path
```

**Export**
```rust
#[tauri::command]
async fn export_timeline(
    app: tauri::AppHandle,
    clips: Vec<ExportClip>,
    output_path: String,
    settings: ExportSettings
) -> Result<(), String>

#[tauri::command]
async fn cancel_export() -> Result<(), String>
```

**Events (Rust → Frontend)**
```typescript
// Frontend listens to these events
import { listen } from '@tauri-apps/api/event';

// Export progress
listen('export-progress', (event) => {
  const { frame, totalFrames, fps, elapsed } = event.payload;
  // Update progress UI
});

// Recording duration update (every second)
listen('recording-tick', (event) => {
  const { duration } = event.payload;
  // Update recording duration display
});

// Error notifications
listen('error', (event) => {
  const { message } = event.payload;
  // Show error toast
});
```

---

## 6. File System & Project Structure

### 6.1 Application Directory Structure

```
ClipForge/
├── src/                          # React frontend
│   ├── components/
│   │   ├── MediaLibrary/
│   │   │   ├── MediaLibrary.tsx
│   │   │   ├── ClipCard.tsx
│   │   │   └── ImportButton.tsx
│   │   ├── Timeline/
│   │   │   ├── Timeline.tsx
│   │   │   ├── TimelineClip.tsx
│   │   │   ├── TimelineTrack.tsx
│   │   │   ├── Playhead.tsx
│   │   │   └── TimeRuler.tsx
│   │   ├── Preview/
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── PlayerControls.tsx
│   │   ├── Recording/
│   │   │   ├── RecordingDialog.tsx
│   │   │   └── RecordingControls.tsx
│   │   ├── Export/
│   │   │   ├── ExportDialog.tsx
│   │   │   └── ExportProgress.tsx
│   │   └── Layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── MainLayout.tsx
│   ├── stores/
│   │   ├── mediaStore.ts
│   │   ├── timelineStore.ts
│   │   ├── recordingStore.ts
│   │   └── exportStore.ts
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useDragAndDrop.ts
│   │   └── useVideoPlayback.ts
│   ├── utils/
│   │   ├── timeFormat.ts
│   │   ├── fileSize.ts
│   │   └── videoUtils.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── file_ops.rs
│   │   │   ├── recording.rs
│   │   │   ├── export.rs
│   │   │   └── metadata.rs
│   │   ├── recording/
│   │   │   ├── mod.rs
│   │   │   ├── screen.rs         # AVFoundation screen capture
│   │   │   └── camera.rs         # AVFoundation camera capture
│   │   ├── ffmpeg/
│   │   │   ├── mod.rs
│   │   │   ├── probe.rs          # Metadata extraction
│   │   │   ├── thumbnail.rs      # Thumbnail generation
│   │   │   └── export.rs         # Video export
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── bin/
│   │   ├── ffmpeg-x86_64-apple-darwin
│   │   └── ffmpeg-aarch64-apple-darwin
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 permissions
│   ├── icons/
│   │   └── icon.icns
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 6.2 User Data Locations

**macOS Application Support**
```
~/Library/Application Support/com.clipforge.app/
├── media/                        # Imported clips cache
│   └── thumbnails/               # Generated thumbnails
├── recordings/                   # Screen/webcam recordings
├── projects/                     # Saved project files (future)
└── logs/                         # Application logs
```

**Temporary Files**
```
/tmp/clipforge/
├── export/                       # Temp files during export
└── concat_*.txt                  # FFmpeg concat lists
```

---

## 7. Performance Requirements

### 7.1 Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| App Launch | < 5 seconds | From click to UI ready |
| Import Video | < 2 seconds | For single file < 100MB |
| Timeline Responsiveness | 60 FPS | During drag operations |
| Playback Frame Rate | 30 FPS minimum | Smooth video preview |
| Export Start | < 1 second | From click to FFmpeg start |
| Memory Usage | < 500MB idle | Without loaded videos |
| Memory per Video | ~10MB | For 1080p 1-minute clip |
| Bundle Size | < 250MB | .dmg file size |

### 7.2 Optimization Strategies

**Frontend Performance**
- Use `React.memo` for expensive components (Timeline clips, media cards)
- Debounce timeline scrubbing (update every 50ms, not every mousemove)
- Virtual scrolling for media library (if > 100 clips)
- Lazy load thumbnails (only render visible items)
- Use `requestAnimationFrame` for playback updates
- Avoid re-renders with Zustand selectors:
  ```typescript
  const playhead = useTimelineStore(state => state.playhead);
  // Instead of:
  const { playhead, clips, zoom } = useTimelineStore();
  ```

**Video Playback**
- Preload next clip during playback (HTMLVideoElement.preload)
- Use `fastSeek()` for timeline scrubbing
- Lower preview resolution during scrubbing (if needed)
- Pause rendering when window is minimized

**FFmpeg Optimization**
- Use `-c copy` for concatenation (no re-encoding)
- Only re-encode when necessary (effects, resolution change)
- Use hardware acceleration when available:
  ```
  -c:v h264_videotoolbox (for macOS VideoToolbox)
  ```
- Optimize preset for speed vs quality:
  ```
  -preset ultrafast (for previews)
  -preset medium (for final export)
  ```

**Memory Management**
- Stream FFmpeg output instead of loading into memory
- Clean up temporary files after export
- Release video element sources when not in use
- Limit thumbnail cache size (max 1000 thumbnails)

### 7.3 Testing Scenarios

**Load Testing**
- Import 20 video clips (total 2GB)
- Create timeline with 15 clips across 3 tracks
- Scrub timeline continuously for 2 minutes
- Verify: No memory leaks, UI remains responsive

**Stress Testing**
- Export 10-minute video with 30+ clips
- Monitor memory usage during export
- Verify: Completes without crash, memory returns to baseline

**Edge Cases**
- Import 4K 60fps video (large file)
- Import corrupted video file
- Export with no clips on timeline
- Export while system is low on disk space

---

## 8. Error Handling & Edge Cases

### 8.1 Error Scenarios

**Import Errors**
- Unsupported video format
- Corrupted/unreadable file
- Insufficient permissions
- File not found (moved/deleted)
- FFmpeg probe failure

**Response**: Show toast notification with error message, log details to console

**Recording Errors**
- No camera detected
- Screen recording permission denied (macOS)
- Microphone permission denied
- Disk full during recording
- Recording session crashes

**Response**: Show modal with specific error and remediation steps (e.g., "Grant screen recording permission in System Preferences")

**Playback Errors**
- Video codec not supported by browser
- File moved/deleted while on timeline
- Seeking beyond file duration

**Response**: Show error overlay on player, allow user to re-import or remove clip

**Export Errors**
- FFmpeg not found or crashes
- Insufficient disk space
- Output path invalid or inaccessible
- Timeline has gaps or overlaps
- Export cancelled by user

**Response**: Show error modal with details, offer to retry or save project state

### 8.2 Input Validation

**Timeline Validation**
- Prevent negative trim values
- Prevent trim end < trim start
- Prevent clip duration < 0.1 seconds
- Prevent overlapping clips on same track
- Warn if timeline is empty before export

**Export Validation**
- Verify output path is writable
- Check available disk space (>2x estimated output size)
- Validate resolution values (>0, reasonable maximums)
- Ensure at least one clip on timeline

**File Validation**
- Check file extension before import
- Verify file exists and is readable
- Validate video container and codec with FFmpeg
- Check file size (warn if > 5GB)

### 8.3 Graceful Degradation

**Limited System Resources**
- If low memory: Reduce thumbnail quality
- If slow disk: Show loading indicators
- If old CPU: Lower playback frame rate

**Missing Permissions**
- If no screen recording: Disable screen recording button, show alert
- If no camera access: Disable webcam recording
- If no microphone: Disable audio recording

**FFmpeg Unavailable**
- Check for FFmpeg on launch
- If missing: Show error and instructions to reinstall
- Disable export functionality

---

## 9. Security & Permissions

### 9.1 macOS Permissions Required

**Screen Recording**
- Required for: Screen capture functionality
- Request: First time user clicks "Record Screen"
- Configuration: Add to `Info.plist`:
  ```xml
  <key>NSScreenCaptureUsageDescription</key>
  <string>ClipForge needs access to record your screen</string>
  ```

**Camera Access**
- Required for: Webcam recording
- Request: First time user clicks "Record Webcam"
- Configuration:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>ClipForge needs access to record video from your camera</string>
  ```

**Microphone Access**
- Required for: Audio recording
- Request: First time user starts any recording with audio
- Configuration:
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>ClipForge needs access to record audio from your microphone</string>
  ```

**File System Access**
- Required for: Import/export videos
- Handled by: Tauri file dialog (sandboxed)
- No special configuration needed (user grants per-operation)

### 9.2 Data Privacy

**User Data**
- All video files remain local (no cloud upload without explicit user action)
- No telemetry or analytics collection
- No user accounts or authentication required

**File Handling**
- Always use user-selected paths (via native dialogs)
- Clean up temporary files on app exit
- Never auto-upload or share user content

### 9.3 Code Signing & Notarization

**For Distribution** (Post-MVP):
- Sign with Apple Developer certificate
- Notarize with Apple for Gatekeeper
- Enable hardened runtime
- Package as signed .dmg

**For MVP**:
- Allow unsigned app (user must right-click → Open)
- Document installation instructions in README

---

## 10. Testing Strategy

### 10.1 Unit Testing

**Frontend (Vitest + React Testing Library)**
```typescript
// Example: Timeline store tests
describe('timelineStore', () => {
  it('should add clip to timeline', () => {
    const { addClipToTimeline, clips } = useTimelineStore.getState();
    addClipToTimeline(mockMediaClip, 0);
    expect(clips).toHaveLength(1);
  });
  
  it('should split clip at playhead', () => {
    // Setup: Add clip, set playhead to middle
    // Action: Split
    // Assert: Two clips with correct durations
  });
});
```

**Backend (Rust)**
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_extract_metadata() {
        let metadata = extract_video_metadata("test.mp4").unwrap();
        assert_eq!(metadata.width, 1920);
        assert_eq!(metadata.height, 1080);
    }
    
    #[test]
    fn test_generate_concat_list() {
        let clips = vec![/* ... */];
        let list = generate_concat_list(clips);
        assert!(list.contains("file 'clip1.mp4'"));
    }
}
```

### 10.2 Integration Testing

**Critical Paths**:
1. Import → Timeline → Export
   - Import video
   - Add to timeline
   - Export (verify output file exists and plays)

2. Record → Timeline → Export
   - Start screen recording
   - Stop recording
   - Verify file saved
   - Add to timeline
   - Export

3. Trim → Export
   - Import video
   - Add to timeline
   - Trim clip
   - Export
   - Verify output duration matches trim

### 10.3 Manual Testing Checklist

**Before MVP Submission**:
- [ ] App launches on clean macOS system
- [ ] Import video via drag-and-drop
- [ ] Import video via file picker
- [ ] Video plays in preview
- [ ] Timeline shows clip correctly
- [ ] Trim clip by dragging edges
- [ ] Export single clip to MP4
- [ ] Output video plays in QuickTime
- [ ] .dmg installs correctly

**Before Final Submission**:
- [ ] All MVP items pass
- [ ] Screen recording works
- [ ] Webcam recording works
- [ ] PiP recording works
- [ ] Multiple clips on timeline
- [ ] Split clip at playhead
- [ ] Delete clip from timeline
- [ ] Export multi-clip timeline
- [ ] Progress indicator during export
- [ ] Cancel export mid-process
- [ ] Keyboard shortcuts work
- [ ] App doesn't crash during 15-min session

### 10.4 Performance Testing

**Tools**:
- Chrome DevTools Performance tab (for React profiling)
- `cargo instruments` (for Rust profiling on macOS)
- Activity Monitor (memory/CPU usage)

**Scenarios**:
- Profile timeline drag operations (should maintain 60 FPS)
- Monitor memory during 10-video import
- Test export performance with different clip counts
- Measure app startup time

---

## 11. Deployment & Distribution

### 11.1 Build Process

**Development Build**
```bash
npm run tauri dev
```

**Production Build**
```bash
# Install dependencies
npm install
cd src-tauri && cargo build --release

# Build frontend
npm run build

# Build Tauri app
npm run tauri build
```

**Output**: `src-tauri/target/release/bundle/dmg/ClipForge_0.1.0_x64.dmg`

### 11.2 Bundle Configuration

**tauri.conf.json**
```json
{
  "productName": "ClipForge",
  "version": "0.1.0",
  "identifier": "com.clipforge.app",
  "bundle": {
    "active": true,
    "targets": ["dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": ["bin/ffmpeg"],
    "resources": [],
    "copyright": "Copyright © 2025",
    "category": "public.app-category.video",
    "shortDescription": "Desktop Video Editor",
    "longDescription": "Record, edit, and export videos with ClipForge"
  }
}
```

### 11.3 Distribution Checklist

**MVP Submission**:
- [ ] Build .dmg successfully
- [ ] Test installation on clean macOS system
- [ ] Verify all features work in installed app
- [ ] Upload .dmg to Google Drive/Dropbox
- [ ] Generate shareable link
- [ ] Include link in README

**Final Submission**:
- [ ] All MVP items complete
- [ ] Test on both Intel and Apple Silicon Macs (if possible)
- [ ] Record 3-5 minute demo video
- [ ] Update README with:
  - Feature list
  - Installation instructions
  - Build instructions
  - Known issues
  - System requirements
- [ ] Push code to GitHub
- [ ] Tag release (v0.1.0)
- [ ] Upload .dmg to GitHub Releases
- [ ] Submit project

---

## 12. Known Limitations & Future Enhancements

### 12.1 MVP Limitations

**Out of Scope**:
- Windows/Linux support
- Text overlays
- Transitions between clips
- Audio waveform visualization
- Color correction/filters
- Undo/redo functionality
- Project save/load
- Multiple video tracks (only 2 tracks)
- Audio mixing/ducking
- Keyframe animations
- Text overlays
- Transitions between clips
- Audio waveform visualization
- Color correction/filters
- Undo/redo functionality
- Project save/load
- Multiple video tracks (only 2 tracks)
- Audio mixing/ducking
- Keyframe animations

### 12.2 Future Features

**Phase 2**:
- Save/load project files (.clipforge format)
- Undo/redo with command pattern
- Text overlays with fonts and animations
- Basic transitions (fade, dissolve, slide)
- Audio controls (volume, fade, normalize)
- Keyboard shortcuts reference panel

**Phase 3**:
- Windows support
- Effects library (filters, color grading)
- Multiple audio tracks
- Audio waveform visualization
- Export presets (YouTube, Instagram, TikTok)
- Background music library
- Batch export

**Phase 4**:
- Cloud collaboration
- AI-powered features (auto-captions, scene detection)
- Plugin system
- Template library
- Direct upload to social platforms

### 12.3 Technical Debt to Address

**After MVP**:
- Implement proper error boundaries in React
- Add comprehensive logging (file-based)
- Set up crash reporting (Sentry or similar)
- Optimize FFmpeg command generation (reduce redundancy)
- Refactor timeline rendering (consider Canvas for better performance)
- Add TypeScript strict mode
- Increase test coverage (>70%)
- Profile and optimize memory usage

---

## 13. Success Metrics & Goals

### 13.1 MVP Success Criteria

**Functional**:
- ✅ App installs and launches without errors
- ✅ User can import at least 3 different video files
- ✅ Timeline displays clips correctly
- ✅ Preview player works for all imported clips
- ✅ Export produces playable MP4 file
- ✅ Basic trim functionality works

**Non-Functional**:
- ✅ App launch < 5 seconds
- ✅ No crashes during 10-minute session
- ✅ Timeline responsive with 10+ clips
- ✅ Export completes within 2x video duration

### 13.2 Final Submission Goals

**Feature Completeness**:
- All recording features functional (screen, webcam, PiP)
- All timeline features implemented (drag, trim, split, delete)
- Export with progress indicator
- Media library with thumbnails

**Polish**:
- Consistent UI/UX across all screens
- Helpful error messages
- Loading states for all async operations
- Basic keyboard shortcuts work

**Documentation**:
- Clear README with setup instructions
- Demo video shows all major features
- Code is reasonably commented
- Build instructions are accurate

### 13.3 Stretch Goals

**If Time Permits**:
- Audio waveform visualization
- Fade in/out transitions
- Text overlay (simple implementation)
- Export presets (720p, 1080p, 4K)
- Drag-and-drop from Finder directly to timeline
- Recent projects list
- Dark/light theme toggle

---

## 14. Risk Management

### 14.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AVFoundation recording too complex | High | High | Start with web APIs (getDisplayMedia), defer to native if time |
| FFmpeg sidecar bundling issues | Medium | High | Test bundling early, have fallback to system FFmpeg |
| Timeline performance issues | Medium | Medium | Start with DOM, switch to Canvas if needed |
| Video codec compatibility | Low | Medium | Test with multiple formats early |
| Export crashes with large videos | Medium | High | Implement error handling, test with various sizes |

### 14.2 Time Management Risks

| Risk | Mitigation |
|------|------------|
| Recording takes longer than expected | Defer to post-MVP, focus on import/edit/export |
| Timeline UI too complex | Simplify to basic blocks, no waveforms for MVP |
| FFmpeg learning curve | Use simple concat for MVP, defer complex filters |
| Packaging issues on macOS | Start packaging early, test on Day 2 |

### 14.3 Contingency Plans

**If Behind Schedule**:
1. Cut recording from MVP, add in final submission
2. Simplify timeline to single track
3. Remove thumbnails, use file icons
4. Skip PiP, focus on basic recording

**If Critical Bug**:
1. Document issue clearly
2. Implement temporary workaround
3. Focus on core user journey (import → timeline → export)
4. Submit with known issues documented

---

## 15. Development Workflow

### 15.1 Git Strategy

**Branch Structure**:
- `main`: Stable, deployable code
- `develop`: Active development
- `feature/*`: Individual features

**Commit Messages**:
```
feat: Add screen recording functionality
fix: Resolve timeline clip overlap issue
chore: Update dependencies
docs: Add installation instructions
```

**MVP Milestone Tag**: `v0.1.0-mvp`  
**Final Submission Tag**: `v0.1.0`

### 15.2 Code Quality

**Linting**:
- ESLint for TypeScript
- Clippy for Rust
- Prettier for formatting

**Pre-commit Hooks** (optional for 72h sprint):
```bash
npm run lint
cargo clippy
```

### 15.3 Documentation Requirements

**README.md** (minimum):
```markdown
# ClipForge

Desktop video editor built with Tauri + React

## Features
- Screen & webcam recording
- Timeline video editing
- MP4 export

## Installation
[Download .dmg](link)

## Development
npm install
npm run tauri dev

## Build
npm run tauri build

## System Requirements
- macOS 11.0+
- 4GB RAM
- 500MB disk space
```

**Code Comments**:
- Document complex algorithms
- Explain non-obvious FFmpeg commands
- Add JSDoc for exported functions

---

## 16. Support & Maintenance

### 16.1 Post-Launch Support

**User Feedback**:
- Monitor GitHub Issues
- Create feedback form (Google Form or Typeform)
- Track common bug reports

**Updates**:
- Patch critical bugs within 48 hours
- Minor releases bi-weekly
- Major releases monthly

### 16.2 System Requirements

**Minimum**:
- macOS 11.0 (Big Sur) or later
- 4GB RAM
- 500MB free disk space
- Intel or Apple Silicon processor

**Recommended**:
- macOS 13.0 (Ventura) or later
- 8GB+ RAM
- 2GB+ free disk space
- SSD

**Not Supported**:
- macOS 10.x (Catalina and earlier)
- PowerPC Macs

---

## 17. Appendix

### 17.1 Useful Resources

**Tauri Documentation**:
- https://v2.tauri.app/
- https://v2.tauri.app/develop/sidecar/
- https://v2.tauri.app/develop/calling-rust/

**FFmpeg Documentation**:
- https://ffmpeg.org/documentation.html
- https://trac.ffmpeg.org/wiki/Concatenate
- https://trac.ffmpeg.org/wiki/Encode/H.264

**AVFoundation (macOS)**:
- https://developer.apple.com/av-foundation/
- https://developer.apple.com/documentation/avfoundation/avcapturesession

**React/Zustand**:
- https://react.dev/
- https://zustand-demo.pmnd.rs/

### 17.2 FFmpeg Commands Reference

**Probe Video**:
```bash
ffmpeg -i input.mp4 -hide_banner
```

**Extract Thumbnail**:
```bash
ffmpeg -ss 00:00:01 -i input.mp4 -vframes 1 -q:v 2 thumbnail.jpg
```

**Simple Concatenation** (no re-encode):
```bash
# Create concat.txt:
# file 'video1.mp4'
# file 'video2.mp4'

ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4
```

**Trim Video** (no re-encode):
```bash
ffmpeg -ss 00:00:10 -t 00:00:30 -i input.mp4 -c copy output.mp4
# -ss: start time
# -t: duration
```

**Re-encode with Quality**:
```bash
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac output.mp4
# -crf: 0-51 (lower = better quality, 23 is default)
# -preset: ultrafast, fast, medium, slow
```

**Overlay Video (PiP)**:
```bash
ffmpeg -i main.mp4 -i overlay.mp4 \
  -filter_complex "[1:v]scale=320:240[pip];[0:v][pip]overlay=10:10[out]" \
  -map "[out]" -map 0:a -c:v libx264 -c:a aac output.mp4
```

**Get Progress During Export**:
```bash
ffmpeg -i input.mp4 -c copy output.mp4 -progress pipe:1
# Outputs progress info to stdout
```

### 17.3 Keyboard Shortcuts (Planned)

| Shortcut | Action |
|----------|--------|
| Space | Play/Pause |
| Left/Right Arrow | Skip 1 second |
| Shift+Left/Right | Skip 5 seconds |
| Home | Jump to start |
| End | Jump to end |
| Cmd+I | Import file |
| Cmd+E | Export video |
| Cmd+R | Start recording |
| Cmd+Z | Undo (future) |
| Cmd+Shift+Z | Redo (future) |
| Delete | Delete selected clip |
| Cmd+D | Duplicate clip (future) |
| Cmd+S | Split at playhead |
| Cmd+Plus | Zoom in timeline |
| Cmd+Minus | Zoom out timeline |

### 17.4 Glossary

- **Clip**: A video file, either imported or recorded
- **Timeline**: The editing workspace where clips are arranged
- **Track**: A horizontal layer on the timeline (like a layer in Photoshop)
- **Playhead**: The vertical indicator showing current playback position
- **Trim**: Adjusting the in/out points of a clip without changing the original file
- **Split**: Cutting a clip into two separate clips
- **Concatenate**: Joining multiple video clips into a single output
- **Sidecar**: An external binary bundled with the app (FFmpeg in our case)
- **Codec**: Compression format for video/audio (e.g., H.264, AAC)
- **Container**: File format that holds video/audio streams (e.g., MP4, MOV)
- **PiP**: Picture-in-Picture, overlaying one video on top of another

---

## Document Control

**Version**: 1.0  
**Last Updated**: Project Start  
**Author**: ClipForge Development Team  
**Status**: Active Development

**Changelog**:
- v1.0: Initial PRD created based on project requirements
