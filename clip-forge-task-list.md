# ClipForge - Implementation Task List

## Overview

This task list is structured in dependency order - complete tasks from top to bottom to ensure a buildable application at each stage. The focus is on achieving **MVP requirements** first.

---

## Phase 1: MVP Implementation (Hard Gate)

### 🎯 Goal: Launchable desktop app with import, timeline, preview, trim, and export functionality

---

## 1. Project Setup & Infrastructure

### 1.1 Initialize Tauri Project
- [ ] Install Rust and Node.js dependencies
- [ ] Run `npm create tauri-app` with React + TypeScript template
- [ ] Verify basic app launches with `npm run tauri dev`
- [ ] Configure Vite for optimal development experience
- [ ] Set up project folder structure (see PRD section 6.1)

### 1.2 Configure Tauri for macOS
- [ ] Update `tauri.conf.json` with app metadata
  - [ ] Set `identifier` to `com.clipforge.app`
  - [ ] Set `productName` to `ClipForge`
  - [ ] Configure window settings (1400x1000 default size)
- [ ] Add macOS permissions to `Info.plist` (via tauri.conf.json)
  - [ ] `NSCameraUsageDescription`
  - [ ] `NSMicrophoneUsageDescription`
  - [ ] `NSScreenCaptureUsageDescription`
- [ ] Configure file system permissions in `capabilities/default.json`
  - [ ] Allow file dialog access
  - [ ] Allow file read/write operations
  - [ ] Set up proper permission scopes

### 1.3 Set Up FFmpeg Sidecar
- [ ] Download FFmpeg static binaries for macOS
  - [ ] Get `ffmpeg-x86_64-apple-darwin` (Intel)
  - [ ] Get `ffmpeg-aarch64-apple-darwin` (Apple Silicon)
  - [ ] Place binaries in `src-tauri/bin/` directory
  - [ ] Verify binaries are executable (`chmod +x`)
- [ ] Configure FFmpeg in `tauri.conf.json`
  - [ ] Add to `bundle.externalBin`: `["bin/ffmpeg"]`
- [ ] Set up shell permissions for FFmpeg
  - [ ] Add to `capabilities/default.json`:
    ```json
    {
      "identifier": "shell:allow-execute",
      "allow": [{ "name": "bin/ffmpeg", "sidecar": true }]
    }
    ```
- [ ] Create Rust helper function to verify FFmpeg availability
  - [ ] Test FFmpeg execution with `-version` flag
  - [ ] Log FFmpeg version on app startup
  - [ ] Handle FFmpeg not found error gracefully

### 1.4 Install Frontend Dependencies
- [ ] Install Zustand: `npm install zustand`
- [ ] Install UUID generator: `npm install uuid @types/uuid`
- [ ] Install Tauri API packages (should be included, verify)
  - [ ] `@tauri-apps/api`
  - [ ] `@tauri-apps/plugin-shell`
  - [ ] `@tauri-apps/plugin-dialog`
- [ ] Set up CSS framework or styling approach
  - [ ] Option: Tailwind CSS (`npm install -D tailwindcss postcss autoprefixer`)
  - [ ] Option: Plain CSS with CSS modules
  - [ ] Configure PostCSS if using Tailwind

### 1.5 Create Base Project Structure
- [ ] Create directory structure in `src/`
  - [ ] `components/` (UI components)
  - [ ] `stores/` (Zustand state management)
  - [ ] `hooks/` (Custom React hooks)
  - [ ] `utils/` (Helper functions)
  - [ ] `types/` (TypeScript interfaces)
- [ ] Create directory structure in `src-tauri/src/`
  - [ ] `commands/` (Tauri command handlers)
  - [ ] `ffmpeg/` (FFmpeg-related logic)
  - [ ] `recording/` (Recording implementations - for Phase 2)
- [ ] Set up TypeScript configuration
  - [ ] Enable strict mode
  - [ ] Configure path aliases (optional)

---

## 2. Core Data Models & State Management

### 2.1 Create TypeScript Type Definitions
- [ ] Create `src/types/index.ts`
- [ ] Define `MediaClip` interface
  ```typescript
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
  ```
- [ ] Define `TimelineClip` interface
  ```typescript
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
  ```
- [ ] Define `VideoMetadata` type (for Rust bridge)
- [ ] Define `ExportSettings` interface
- [ ] Define `ExportProgress` interface

### 2.2 Create Media Store (Zustand)
- [ ] Create `src/stores/mediaStore.ts`
- [ ] Implement state structure:
  - [ ] `clips: MediaClip[]`
  - [ ] `loading: boolean`
  - [ ] `selectedClipId: string | null`
- [ ] Implement actions:
  - [ ] `addClips(clips: MediaClip[]): void`
  - [ ] `removeClip(id: string): void`
  - [ ] `getClipById(id: string): MediaClip | undefined`
  - [ ] `setSelectedClip(id: string | null): void`
  - [ ] `clearAllClips(): void`

### 2.3 Create Timeline Store (Zustand)
- [ ] Create `src/stores/timelineStore.ts`
- [ ] Implement state structure:
  - [ ] `clips: TimelineClip[]`
  - [ ] `playhead: number` (current time in seconds)
  - [ ] `playing: boolean`
  - [ ] `zoom: number` (1x, 2x, 5x, etc.)
  - [ ] `snapToGrid: boolean`
- [ ] Implement actions:
  - [ ] `addClipToTimeline(mediaClip: MediaClip, trackIndex: number): void`
  - [ ] `updateClip(id: string, updates: Partial<TimelineClip>): void`
  - [ ] `removeClip(id: string): void`
  - [ ] `setPlayhead(time: number): void`
  - [ ] `setPlaying(playing: boolean): void`
  - [ ] `setZoom(zoom: number): void`
  - [ ] `getTotalDuration(): number` (computed)
  - [ ] `getActiveClipsAtTime(time: number): TimelineClip[]` (computed)
  - [ ] `clearTimeline(): void`

### 2.4 Create Export Store (Zustand)
- [ ] Create `src/stores/exportStore.ts`
- [ ] Implement state structure:
  - [ ] `exporting: boolean`
  - [ ] `progress: number` (0-100)
  - [ ] `currentFrame: number`
  - [ ] `totalFrames: number`
  - [ ] `estimatedTimeRemaining: number`
  - [ ] `error: string | null`
- [ ] Implement actions:
  - [ ] `setExporting(exporting: boolean): void`
  - [ ] `updateProgress(data: ExportProgress): void`
  - [ ] `resetExport(): void`
  - [ ] `setError(error: string): void`

---

## 3. File Operations & Media Import (Rust Backend)

### 3.1 Set Up Rust Command Infrastructure
- [ ] Create `src-tauri/src/commands/mod.rs`
- [ ] Set up module exports for command groups
- [ ] Register commands in `main.rs`:
  ```rust
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      // Commands will be registered here
    ])
    .run(tauri::generate_context!())
  ```

### 3.2 Implement Video Metadata Extraction
- [ ] Create `src-tauri/src/ffmpeg/probe.rs`
- [ ] Implement `extract_video_metadata` function
  - [ ] Use FFmpeg sidecar to probe video file
  - [ ] Execute command: `ffmpeg -i {path} -hide_banner`
  - [ ] Parse stderr output for metadata
  - [ ] Extract: duration, resolution, fps, codec, bitrate
  - [ ] Return structured `VideoMetadata` object
  - [ ] Handle errors (file not found, unsupported format, etc.)
- [ ] Create Tauri command wrapper:
  ```rust
  #[tauri::command]
  async fn extract_video_metadata(
    path: String
  ) -> Result<VideoMetadata, String>
  ```
- [ ] Add command to handler registration in `main.rs`

### 3.3 Implement Thumbnail Generation
- [ ] Create `src-tauri/src/ffmpeg/thumbnail.rs`
- [ ] Implement `generate_thumbnail` function
  - [ ] Use FFmpeg to extract frame at 1 second mark
  - [ ] Command: `ffmpeg -ss 1 -i {input} -vframes 1 -q:v 2 {output}.jpg`
  - [ ] Save thumbnail to app temp directory
  - [ ] Return path to generated thumbnail
  - [ ] Handle edge cases (video < 1 second)
- [ ] Create Tauri command wrapper:
  ```rust
  #[tauri::command]
  async fn generate_thumbnail(
    video_path: String,
    output_path: String
  ) -> Result<String, String>
  ```
- [ ] Add command to handler registration

### 3.4 Implement File Import Handler
- [ ] Create `src-tauri/src/commands/file_ops.rs`
- [ ] Implement `import_video_files` command
  - [ ] Accept array of file paths
  - [ ] Validate file extensions (mp4, mov, webm)
  - [ ] For each file:
    - [ ] Extract metadata using `extract_video_metadata`
    - [ ] Generate thumbnail
    - [ ] Get file size from filesystem
    - [ ] Create `VideoMetadata` response object
  - [ ] Return array of metadata objects
  - [ ] Handle batch import errors gracefully
- [ ] Create Tauri command:
  ```rust
  #[tauri::command]
  async fn import_video_files(
    app: tauri::AppHandle,
    paths: Vec<String>
  ) -> Result<Vec<VideoMetadata>, String>
  ```
- [ ] Add command to handler registration

### 3.5 Set Up Application Data Directory
- [ ] Create helper function to get app data directory
  - [ ] Use `tauri::api::path::app_data_dir()`
  - [ ] Create subdirectories: `media/`, `thumbnails/`, `recordings/`
  - [ ] Handle directory creation errors
- [ ] Implement cleanup function for temp files
- [ ] Store thumbnail cache in app data directory

---

## 4. Media Library UI (Frontend)

### 4.1 Create Media Library Layout
- [ ] Create `src/components/MediaLibrary/MediaLibrary.tsx`
- [ ] Implement basic layout structure:
  - [ ] Fixed width sidebar (240px)
  - [ ] Header with "Import" button
  - [ ] Scrollable grid of media clips
  - [ ] Empty state when no clips imported
- [ ] Style with CSS (grid layout, 2 columns)
- [ ] Make responsive/collapsible (stretch goal)

### 4.2 Implement Import Button
- [ ] Create `src/components/MediaLibrary/ImportButton.tsx`
- [ ] Add click handler to open native file dialog
  - [ ] Use `@tauri-apps/plugin-dialog`
  - [ ] Filter for video files: `.mp4`, `.mov`, `.webm`
  - [ ] Allow multiple file selection
- [ ] Call Rust `import_video_files` command
- [ ] Update media store with imported clips
- [ ] Show loading indicator during import
- [ ] Display error toast on import failure

### 4.3 Create Media Clip Card Component
- [ ] Create `src/components/MediaLibrary/ClipCard.tsx`
- [ ] Display clip thumbnail
  - [ ] Use `<img>` with thumbnail path
  - [ ] Handle missing/loading thumbnails
  - [ ] Show placeholder if thumbnail fails
- [ ] Display clip metadata:
  - [ ] Filename (truncated if long)
  - [ ] Duration in HH:MM:SS format
  - [ ] Resolution (e.g., "1920x1080")
  - [ ] File size (convert bytes to MB/GB)
- [ ] Add hover effects
- [ ] Add click handler to select clip
- [ ] Add double-click to add to timeline
- [ ] Add right-click context menu (Delete)

### 4.4 Implement Drag and Drop for Import
- [ ] Add drop zone to `MediaLibrary` component
- [ ] Listen for `drop` event on library container
- [ ] Prevent default browser behavior
- [ ] Extract file paths from drop event
- [ ] Call `import_video_files` with dropped paths
- [ ] Show visual feedback during drag-over
- [ ] Handle invalid file types gracefully

### 4.5 Create Utility Functions
- [ ] Create `src/utils/timeFormat.ts`
  - [ ] `formatDuration(seconds: number): string` (HH:MM:SS)
  - [ ] `parseTimestamp(timestamp: string): number`
- [ ] Create `src/utils/fileSize.ts`
  - [ ] `formatFileSize(bytes: number): string` (MB, GB)
- [ ] Create `src/utils/videoUtils.ts`
  - [ ] Helper functions for video-related calculations

---

## 5. Video Preview Player

### 5.1 Create Video Player Component
- [ ] Create `src/components/Preview/VideoPlayer.tsx`
- [ ] Add HTML5 `<video>` element
  - [ ] Disable default controls
  - [ ] Set autoPlay={false}
  - [ ] Add ref for programmatic control
  - [ ] Style to maintain 16:9 aspect ratio
- [ ] Create container with black background
- [ ] Handle video loading states
- [ ] Display "No video selected" placeholder

### 5.2 Implement Player Controls
- [ ] Create `src/components/Preview/PlayerControls.tsx`
- [ ] Add play/pause button
  - [ ] Toggle video.play() / video.pause()
  - [ ] Update timeline store playing state
  - [ ] Show appropriate icon (play/pause)
- [ ] Add time display
  - [ ] Show current time (playhead position)
  - [ ] Show total duration
  - [ ] Format as HH:MM:SS.mmm
- [ ] Add volume control slider
  - [ ] Range input 0-1
  - [ ] Update video.volume
  - [ ] Add mute button
- [ ] Add playback speed selector (stretch goal)
  - [ ] Options: 0.25x, 0.5x, 1x, 1.5x, 2x
  - [ ] Update video.playbackRate

### 5.3 Sync Player with Timeline Playhead
- [ ] Subscribe to timeline store playhead changes
- [ ] When playhead changes:
  - [ ] Get active clips at playhead time
  - [ ] If no clips, pause and show black screen
  - [ ] If single clip:
    - [ ] Set video.src to clip filepath
    - [ ] Calculate clip-relative time: `playhead - clip.startTime + clip.trimStart`
    - [ ] Seek video to calculated time
  - [ ] Handle seeking errors
- [ ] Update playhead when video plays
  - [ ] Listen to video `timeupdate` event
  - [ ] Calculate timeline time and update store
  - [ ] Use requestAnimationFrame for smooth updates

### 5.4 Implement Playback Loop
- [ ] Create custom hook `src/hooks/useVideoPlayback.ts`
- [ ] When playing = true:
  - [ ] Start requestAnimationFrame loop
  - [ ] Each frame:
    - [ ] Read video.currentTime
    - [ ] Update timeline playhead
    - [ ] Check if reached end of timeline
    - [ ] Pause if end reached
- [ ] When playing = false:
  - [ ] Cancel requestAnimationFrame loop
  - [ ] Pause video element

### 5.5 Handle Video Loading & Errors
- [ ] Show loading spinner when video is loading
- [ ] Listen to video `loadstart`, `canplay`, `error` events
- [ ] Display error message if video fails to load
- [ ] Handle codec compatibility issues
- [ ] Preload video when timeline clip is added (stretch goal)

---

## 6. Timeline UI - Basic Structure

### 6.1 Create Timeline Container
- [ ] Create `src/components/Timeline/Timeline.tsx`
- [ ] Set up container layout:
  - [ ] Fixed height (200-300px)
  - [ ] Horizontal scroll enabled
  - [ ] Position relative for absolute children
- [ ] Add resize handle to adjust timeline height (stretch goal)
- [ ] Style with dark background and borders

### 6.2 Implement Time Ruler
- [ ] Create `src/components/Timeline/TimeRuler.tsx`
- [ ] Calculate time markers based on zoom level
  - [ ] Show second markers at 1x zoom
  - [ ] Show 5-second markers at higher zoom
  - [ ] Adjust granularity dynamically
- [ ] Render time labels above timeline
  - [ ] Format as MM:SS or HH:MM:SS
  - [ ] Position at appropriate pixel locations
- [ ] Draw tick marks for each time division
- [ ] Scale ruler width based on total timeline duration

### 6.3 Create Timeline Track Component
- [ ] Create `src/components/Timeline/TimelineTrack.tsx`
- [ ] Render horizontal track lane
  - [ ] Fixed height (60-80px per track)
  - [ ] Background color to distinguish tracks
  - [ ] Track label on left side ("Track 1", "Track 2")
- [ ] Render multiple tracks (at least 2 for MVP)
- [ ] Style with subtle borders between tracks

### 6.4 Implement Zoom Controls
- [ ] Add zoom slider or +/- buttons to Timeline
- [ ] Update timeline store zoom value
- [ ] Recalculate pixel-to-time ratio:
  - [ ] `pixelsPerSecond = basePixelsPerSecond * zoom`
  - [ ] Example: 100px/sec at 1x, 200px/sec at 2x
- [ ] Re-render timeline with new scale
- [ ] Adjust scroll position to maintain view center
- [ ] Keyboard shortcuts: Cmd+Plus, Cmd+Minus

### 6.5 Create Playhead Component
- [ ] Create `src/components/Timeline/Playhead.tsx`
- [ ] Render vertical line at playhead position
  - [ ] Convert playhead time to pixel position
  - [ ] `x = playhead * pixelsPerSecond`
  - [ ] Absolute positioning
  - [ ] Full height of timeline
- [ ] Style with distinctive color (red)
- [ ] Add triangle indicator at top
- [ ] Subscribe to playhead changes and update position
- [ ] Animate smoothly during playback (CSS transition or requestAnimationFrame)

---

## 7. Timeline Clip Rendering & Interaction

### 7.1 Create Timeline Clip Component
- [ ] Create `src/components/Timeline/TimelineClip.tsx`
- [ ] Accept props: `clip: TimelineClip`, `pixelsPerSecond: number`
- [ ] Calculate clip visual properties:
  - [ ] `x = clip.startTime * pixelsPerSecond`
  - [ ] `width = clip.duration * pixelsPerSecond`
  - [ ] `y = trackIndex * trackHeight`
- [ ] Render clip as styled div
  - [ ] Absolute positioning at calculated x, y
  - [ ] Set width based on duration
  - [ ] Distinctive background color
  - [ ] Border and shadow for depth
- [ ] Display clip name/label inside block
- [ ] Display duration badge
- [ ] Show thumbnail strip (multiple frames) - stretch goal

### 7.2 Implement Drag to Add Clips
- [ ] Make media library clips draggable
  - [ ] Add `draggable={true}` to ClipCard
  - [ ] Set drag data with clip ID
- [ ] Make timeline tracks drop zones
  - [ ] Listen for `dragover` and `drop` events on tracks
  - [ ] Prevent default behavior
  - [ ] Calculate drop position based on mouse X coordinate
  - [ ] Convert pixel position to time: `time = x / pixelsPerSecond`
- [ ] Call timeline store `addClipToTimeline`
  - [ ] Pass mediaClip, trackIndex, startTime
  - [ ] Create new TimelineClip with default values
- [ ] Visual feedback during drag
  - [ ] Show preview at drop position
  - [ ] Highlight valid drop zones

### 7.3 Implement Clip Dragging on Timeline
- [ ] Make TimelineClip draggable within timeline
- [ ] Add `onMouseDown` handler to clip
  - [ ] Track initial mouse position
  - [ ] Calculate offset from clip start
- [ ] Add `onMouseMove` handler (document level)
  - [ ] Calculate new clip position
  - [ ] Update clip `startTime` in store
  - [ ] Optionally: snap to grid if enabled
  - [ ] Prevent overlap with other clips
- [ ] Add `onMouseUp` handler
  - [ ] Finalize clip position
  - [ ] Clean up event listeners
- [ ] Show ghost/preview during drag
- [ ] Update preview player when clip moves

### 7.4 Implement Trim Handles
- [ ] Add trim handles to left and right edges of clip
- [ ] Style handles as small resize indicators
- [ ] Detect mouse down on handles vs clip body
- [ ] On trim handle drag:
  - [ ] Left handle: Update `trimStart` and `startTime`
  - [ ] Right handle: Update `trimEnd` and `duration`
  - [ ] Clamp values to clip bounds (0 to original duration)
  - [ ] Update clip in timeline store
- [ ] Show visual feedback (cursor change, highlight)
- [ ] Minimum clip duration: 0.1 seconds

### 7.5 Implement Clip Selection & Deletion
- [ ] Track selected clip ID in timeline store or local state
- [ ] Highlight selected clip with border/glow
- [ ] Click on clip to select
- [ ] Click on empty timeline area to deselect
- [ ] Delete key to remove selected clip
  - [ ] Call `timelineStore.removeClip(selectedId)`
- [ ] Show confirmation dialog (optional)
- [ ] Update preview if deleted clip was active

---

## 8. Timeline Playhead Interaction

### 8.1 Implement Click-to-Seek on Timeline
- [ ] Add click handler to timeline container (on time ruler or track area)
- [ ] Calculate clicked time position:
  - [ ] Get mouse X coordinate relative to timeline
  - [ ] Convert to time: `clickedTime = mouseX / pixelsPerSecond`
- [ ] Update timeline store playhead
  - [ ] `setPlayhead(clickedTime)`
- [ ] Update video player to new position
- [ ] Visual feedback: move playhead instantly

### 8.2 Implement Playhead Dragging (Scrubbing)
- [ ] Make playhead draggable
- [ ] Add mouse down handler to playhead element
- [ ] Track drag state (isDragging)
- [ ] On mouse move (document level):
  - [ ] Calculate new time from mouse X
  - [ ] Update playhead position
  - [ ] Update video player (seek to new time)
  - [ ] Debounce video seeks (every 50ms)
- [ ] On mouse up:
  - [ ] Finalize position
  - [ ] Clean up event listeners
- [ ] Show time tooltip during scrub

### 8.3 Implement Keyboard Controls
- [ ] Create custom hook `src/hooks/useKeyboardShortcuts.ts`
- [ ] Listen for keyboard events (document level)
- [ ] Implement shortcuts:
  - [ ] **Spacebar**: Toggle play/pause
  - [ ] **Left Arrow**: Skip backward 1 second
  - [ ] **Right Arrow**: Skip forward 1 second
  - [ ] **Home**: Jump to timeline start (playhead = 0)
  - [ ] **End**: Jump to timeline end
  - [ ] **Delete**: Delete selected clip
- [ ] Prevent shortcuts when typing in input fields
- [ ] Add shortcuts info to UI (help tooltip)

---

## 9. Export Functionality (Rust Backend)

### 9.1 Create Export Command Infrastructure
- [ ] Create `src-tauri/src/ffmpeg/export.rs`
- [ ] Define `ExportClip` struct to receive from frontend:
  ```rust
  #[derive(Deserialize)]
  struct ExportClip {
    filepath: String,
    trim_start: f64,
    trim_end: f64,
    start_time: f64,
  }
  ```
- [ ] Define `ExportSettings` struct:
  ```rust
  #[derive(Deserialize)]
  struct ExportSettings {
    width: u32,
    height: u32,
    fps: u32,
    quality: String, // "high", "medium", "low"
  }
  ```

### 9.2 Implement Simple Concatenation (MVP)
- [ ] Implement `generate_concat_file` function
  - [ ] Create temporary concat list file
  - [ ] Format: `file '/path/to/clip1.mp4'\nfile '/path/to/clip2.mp4'`
  - [ ] Write to temp directory
  - [ ] Return path to concat file
- [ ] For MVP: Skip trim support, just concatenate full clips
- [ ] Handle file path escaping for FFmpeg
- [ ] Clean up concat file after export

### 9.3 Implement FFmpeg Export Execution
- [ ] Implement `execute_export` function
  - [ ] Get FFmpeg sidecar handle
  - [ ] Build FFmpeg command:
    ```bash
    ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4
    ```
  - [ ] For MVP: Use `-c copy` (no re-encoding)
  - [ ] Spawn FFmpeg process
  - [ ] Capture stdout/stderr
  - [ ] Parse FFmpeg output for progress
  - [ ] Emit progress events to frontend
  - [ ] Wait for completion
  - [ ] Return output file path or error
- [ ] Handle FFmpeg errors:
  - [ ] Parse error messages
  - [ ] Provide user-friendly error descriptions

### 9.4 Create Export Tauri Command
- [ ] Create `export_timeline` command:
  ```rust
  #[tauri::command]
  async fn export_timeline(
    app: tauri::AppHandle,
    clips: Vec<ExportClip>,
    output_path: String,
    settings: ExportSettings
  ) -> Result<String, String>
  ```
- [ ] Sort clips by `start_time` before processing
- [ ] Validate inputs (non-empty clips, valid paths)
- [ ] Generate concat file
- [ ] Execute FFmpeg export
- [ ] Return output file path on success
- [ ] Add command to handler registration in `main.rs`

### 9.5 Implement Progress Tracking
- [ ] Parse FFmpeg stderr for progress information
  - [ ] Look for `frame=`, `fps=`, `time=` patterns
  - [ ] Extract current frame number
  - [ ] Calculate total frames from duration
- [ ] Emit progress events to frontend:
  ```rust
  app.emit_all("export-progress", ExportProgress {
    frame: current_frame,
    total_frames: total_frames,
    progress: (current_frame / total_frames * 100),
  })
  ```
- [ ] Update every 500ms to avoid overwhelming frontend
- [ ] Emit completion event on success
- [ ] Emit error event on failure

---

## 10. Export UI (Frontend)

### 10.1 Create Export Dialog Component
- [ ] Create `src/components/Export/ExportDialog.tsx`
- [ ] Modal/dialog overlay with backdrop
- [ ] Export settings form:
  - [ ] Output file name input
  - [ ] Resolution dropdown (Source, 1080p, 720p)
  - [ ] Quality preset (High, Medium, Low)
- [ ] Browse button to select output location
  - [ ] Use `@tauri-apps/plugin-dialog` save dialog
  - [ ] Default to user's Videos folder
  - [ ] Filter for .mp4 extension
- [ ] Export button (disabled if no output path)
- [ ] Cancel button to close dialog

### 10.2 Implement Export Trigger
- [ ] Add "Export" button to main app header/toolbar
- [ ] Click handler opens ExportDialog
- [ ] Validate timeline has clips before opening
  - [ ] Show error if timeline empty
  - [ ] Require at least one clip
- [ ] Pre-fill default settings

### 10.3 Implement Export Progress UI
- [ ] Create `src/components/Export/ExportProgress.tsx`
- [ ] Show modal when export starts
- [ ] Display progress bar (0-100%)
- [ ] Show current frame / total frames
- [ ] Show export speed (fps)
- [ ] Estimated time remaining
- [ ] Cancel button (to stop export)
- [ ] Prevent closing modal during export
- [ ] On completion:
  - [ ] Show success message
  - [ ] "Open file location" button
  - [ ] "Export another" button
  - [ ] Close button

### 10.4 Wire Export to Backend
- [ ] On export button click:
  - [ ] Get all timeline clips from store
  - [ ] Convert TimelineClip to ExportClip format
  - [ ] Get media file paths from mediaStore
  - [ ] Call Rust `export_timeline` command
  - [ ] Pass clips, output path, settings
  - [ ] Update export store state (exporting = true)
- [ ] Listen for export progress events:
  ```typescript
  import { listen } from '@tauri-apps/api/event';
  
  listen('export-progress', (event) => {
    exportStore.updateProgress(event.payload);
  });
  ```
- [ ] Handle export completion
- [ ] Handle export errors (show error modal)

### 10.5 Implement Cancel Export
- [ ] Add cancel button to progress modal
- [ ] Create Rust command to kill FFmpeg process:
  ```rust
  #[tauri::command]
  async fn cancel_export() -> Result<(), String>
  ```
- [ ] Store FFmpeg process handle globally
- [ ] Terminate process on cancel
- [ ] Clean up temp files
- [ ] Reset export store state

---

## 11. Application Layout & Polish

### 11.1 Create Main Layout Component
- [ ] Create `src/components/Layout/MainLayout.tsx`
- [ ] Implement three-panel layout:
  - [ ] Left: MediaLibrary (240px fixed width)
  - [ ] Center: VideoPlayer (top) + Timeline (bottom)
  - [ ] Resizable divider between player and timeline
- [ ] Add header bar with:
  - [ ] App title/logo
  - [ ] Export button
  - [ ] Settings menu (future)
- [ ] Style with CSS Grid or Flexbox
- [ ] Ensure responsive to window resizing

### 11.2 Create Header Component
- [ ] Create `src/components/Layout/Header.tsx`
- [ ] Add app title "ClipForge"
- [ ] Add Export button (prominent)
- [ ] Add placeholder for Record button (Phase 2)
- [ ] Style with app branding colors
- [ ] Fixed position at top

### 11.3 Implement Global Styles
- [ ] Create `src/index.css` or `src/App.css`
- [ ] Define CSS variables for design tokens:
  - [ ] Colors (primary, danger, success, background, text)
  - [ ] Spacing units (8px base)
  - [ ] Typography (font family, sizes)
- [ ] Set global styles:
  - [ ] Box-sizing: border-box
  - [ ] Default font family
  - [ ] Remove default margins/padding
  - [ ] Dark theme background
- [ ] Style scrollbars (for timeline and library)

### 11.4 Add Loading States
- [ ] Create loading spinner component
- [ ] Show spinner during:
  - [ ] Video import
  - [ ] Thumbnail generation
  - [ ] Video loading in player
- [ ] Add skeleton loaders for media cards (optional)
- [ ] Disable interactions during loading

### 11.5 Implement Error Handling UI
- [ ] Create toast notification component
  - [ ] Use React context or simple state management
  - [ ] Auto-dismiss after 5 seconds
  - [ ] Show error/success/info variants
- [ ] Show toasts for:
  - [ ] Import errors
  - [ ] Export errors
  - [ ] FFmpeg not found
  - [ ] File access errors
- [ ] Create error modal for critical errors
  - [ ] Display error message
  - [ ] Show retry option if applicable

---

## 12. Build & Packaging (MVP Checkpoint)

### 12.1 Test Development Build
- [ ] Run `npm run tauri dev`
- [ ] Verify all features work in dev mode:
  - [ ] Import videos
  - [ ] Add to timeline
  - [ ] Trim clips
  - [ ] Play/pause preview
  - [ ] Export video
- [ ] Test with various video formats (MP4, MOV)
- [ ] Test error scenarios
- [ ] Monitor console for errors

### 12.2 Create Production Build
- [ ] Run `npm run tauri build`
- [ ] Wait for build to complete (may take 5-10 minutes)
- [ ] Verify build artifacts created:
  - [ ] `src-tauri/target/release/bundle/dmg/ClipForge_0.1.0_x64.dmg`
  - [ ] Or: `ClipForge_0.1.0_aarch64.dmg` for Apple Silicon
- [ ] Check bundle size (should be < 250MB)
- [ ] Verify FFmpeg binary is included in bundle

### 12.3 Test Packaged Application
- [ ] Mount .dmg file
- [ ] Drag app to Applications folder
- [ ] Launch ClipForge from Applications
- [ ] Test all MVP features in packaged app:
  - [ ] Import videos
  - [ ] Timeline editing
  - [ ] Export
- [ ] Verify no crashes
- [ ] Check app launches in < 5 seconds
- [ ] Test on clean macOS system (if available)

### 12.4 Fix Packaging Issues
- [ ] Common issues to check:
  - [ ] FFmpeg binary not found in bundle
    - [ ] Verify `externalBin` configuration
    - [ ] Check binary naming with target triple
    - [ ] Ensure binaries are executable
  - [ ] Permission errors
    - [ ] Verify `capabilities/default.json` is correct
    - [ ] Check file dialog permissions
  - [ ] Resource paths incorrect
    - [ ] Use Tauri path APIs, not hardcoded paths
    - [ ] Test thumbnail generation in bundle
- [ ] Rebuild and retest after fixes

### 12.5 Prepare MVP Submission
- [ ] Upload .dmg to Google Drive or Dropbox
- [ ] Generate shareable download link
- [ ] Take screenshots of app in action
- [ ] Record screen demo video (use QuickTime or ClipForge itself!)
  - [ ] Show import feature
  - [ ] Show timeline editing
  - [ ] Show export process
  - [ ] Duration: 2-3 minutes
- [ ] Update README.md with:
  - [ ] MVP feature list
  - [ ] Installation instructions
  - [ ] Known limitations
  - [ ] Build instructions (for evaluators)

---

## Phase 2: Full Submission Features

**Note**: Phase 2 tasks are listed as high-level features only. These are to be implemented after MVP is complete and working.

### Phase 2 Features Overview

- [ ] **Recording Features**
  - [ ] Screen recording with AVFoundation
  - [ ] Webcam recording
  - [ ] Picture-in-picture (simultaneous recording)
  - [ ] Audio capture from microphone
  - [ ] Recording controls UI

- [ ] **Advanced Timeline Features**
  - [ ] Split clip at playhead
  - [ ] Multiple tracks support (expand to 3-4 tracks)
  - [ ] Snap-to-edge functionality
  - [ ] Clip duplication
  - [ ] Audio waveform visualization (stretch)

- [ ] **Enhanced Export**
  - [ ] Support for trim points in export (re-encode if necessary)
  - [ ] Resolution presets
  - [ ] Quality settings (bitrate control)
  - [ ] Progress improvements (more accurate time estimates)

- [ ] **UI Enhancements**
  - [ ] Thumbnail strip on timeline clips
  - [ ] Clip color coding
  - [ ] Timeline zoom fit-to-window
  - [ ] Keyboard shortcut reference panel

- [ ] **Polish & Optimization**
  - [ ] Memory optimization for large projects
  - [ ] Timeline rendering performance improvements
  - [ ] Undo/redo functionality (stretch)
  - [ ] Auto-save project state (stretch)

---

## Critical Path to MVP Success

**Must Complete In Order:**

1. ✅ Project Setup (Task 1) - Foundation for everything
2. ✅ FFmpeg Integration (Task 1.3) - Required for metadata and export
3. ✅ Data Models (Task 2) - Foundation for state management
4. ✅ File Operations Backend (Task 3) - Required for import
5. ✅ Media Library UI (Task 4) - User's entry point
6. ✅ Video Player (Task 5) - Preview is core functionality
7. ✅ Timeline Structure (Task 6) - Heart of the editor
8. ✅ Timeline Clips (Task 7) - Must render and manipulate clips
9. ✅ Playhead Interaction (Task 8) - Required for preview sync
10. ✅ Export Backend (Task 9) - Must deliver output
11. ✅ Export UI (Task 10) - User's exit point
12. ✅ Layout & Polish (Task 11) - Make it presentable
13. ✅ Build & Package (Task 12) - Deliverable

**Estimated Complexity:**
- **High Complexity**: Tasks 7, 9 (Timeline interactions, FFmpeg export)
- **Medium Complexity**: Tasks 3, 5, 6, 8 (Backend integration, player sync)
- **Low Complexity**: Tasks 2, 4, 10, 11 (UI components, state management)

**Time-Saving Tips:**
- Start with Task 1 immediately (setup while thinking through architecture)
- Implement Tasks 2-3 in parallel (backend while planning frontend)
- Use simple CSS instead of complex styling libraries
- Test export early (Task 9) - don't wait until the end
- Build and package frequently - don't save for last minute

---

## Troubleshooting Guide

### Common Issues & Solutions

**FFmpeg not found in bundle:**
- Ensure binaries are in `src-tauri/bin/` with correct naming
- Verify `externalBin` in tauri.conf.json
- Check binaries have execute permissions (`chmod +x`)

**Video won't play in preview:**
- Check browser codec support (H.264 is safest)
- Verify file path is accessible from Tauri
- Check video element src is set correctly
- Look for errors in console

**Timeline clips not draggable:**
- Ensure drag event handlers are attached
- Check preventDefault() is called on dragover
- Verify drop zone is receiving events
- Test with console.log in handlers

**Export fails silently:**
- Check FFmpeg stderr output for actual error
- Verify concat file is generated correctly
- Ensure output path is writable
- Test FFmpeg command manually in terminal

**App won't launch after build:**
- Check for permission errors in Console.app
- Verify all required permissions in Info.plist
- Ensure all dependencies are bundled
- Try running from terminal to see error output

---

## Definition of Done (MVP)

An MVP task is complete when:

- [ ] Feature works in development mode
- [ ] Feature works in packaged .dmg
- [ ] No console errors related to feature
- [ ] Basic error handling implemented
- [ ] User can complete the workflow without crashes
- [ ] Code is reasonably clean (no commented-out blocks, organized)

**MVP is DONE when:**

- [ ] User can launch app from .dmg
- [ ] User can import 3+ video files
- [ ] Timeline shows imported clips
- [ ] User can play/pause video preview
- [ ] User can trim at least one clip
- [ ] User can export timeline to playable MP4
- [ ] Export completes without crash
- [ ] App is stable for 10-minute usage session
- [ ] .dmg is uploaded with download link
- [ ] README has installation and usage instructions

---

**Document Version:** 1.0  
**Last Updated:** Project Start  
**Status:** Ready for Implementation
