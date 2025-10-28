# ClipForge MVP Implementation Tasks

## Relevant Files

- `src/types/index.ts` - TypeScript interfaces for MediaClip, TimelineClip, VideoMetadata, ExportSettings, and ExportProgress
- `src/stores/mediaStore.ts` - Zustand store for managing imported video clips
- `src/stores/mediaStore.test.ts` - Unit tests for media store
- `src/stores/timelineStore.ts` - Zustand store for timeline state and clip management
- `src/stores/timelineStore.test.ts` - Unit tests for timeline store
- `src/stores/exportStore.ts` - Zustand store for export progress and state
- `src/stores/exportStore.test.ts` - Unit tests for export store
- `src-tauri/src/commands/mod.rs` - Module exports for Tauri command handlers
- `src-tauri/src/commands/file_ops.rs` - Rust commands for file import and management
- `src-tauri/src/ffmpeg/probe.rs` - FFmpeg integration for video metadata extraction
- `src-tauri/src/ffmpeg/thumbnail.rs` - FFmpeg integration for thumbnail generation
- `src-tauri/src/ffmpeg/export.rs` - FFmpeg integration for video export
- `src/components/MediaLibrary/MediaLibrary.tsx` - Main media library component
- `src/components/MediaLibrary/MediaLibrary.test.tsx` - Unit tests for media library
- `src/components/MediaLibrary/ImportButton.tsx` - Import button component
- `src/components/MediaLibrary/ClipCard.tsx` - Individual clip card component
- `src/components/MediaLibrary/ClipCard.test.tsx` - Unit tests for clip card
- `src/components/Preview/VideoPlayer.tsx` - Video player component
- `src/components/Preview/VideoPlayer.test.tsx` - Unit tests for video player
- `src/components/Preview/PlayerControls.tsx` - Video player controls
- `src/components/Timeline/Timeline.tsx` - Main timeline component
- `src/components/Timeline/Timeline.test.tsx` - Unit tests for timeline
- `src/components/Timeline/TimelineTrack.tsx` - Individual timeline track
- `src/components/Timeline/TimelineClip.tsx` - Timeline clip component
- `src/components/Timeline/Playhead.tsx` - Timeline playhead component
- `src/components/Timeline/TimeRuler.tsx` - Timeline time ruler
- `src/components/Export/ExportDialog.tsx` - Export settings dialog
- `src/components/Export/ExportProgress.tsx` - Export progress indicator
- `src/components/Layout/MainLayout.tsx` - Main application layout
- `src/components/Layout/Header.tsx` - Application header
- `src/hooks/useVideoPlayback.ts` - Custom hook for video playback logic
- `src/hooks/useKeyboardShortcuts.ts` - Custom hook for keyboard shortcuts
- `src/utils/timeFormat.ts` - Time formatting utilities
- `src/utils/fileSize.ts` - File size formatting utilities
- `src/utils/videoUtils.ts` - Video-related utility functions
- `src/index.css` - Global styles and CSS variables
- `tauri.conf.json` - Tauri configuration file
- `src-tauri/capabilities/default.json` - Tauri permissions configuration
- `package.json` - Updated with Zustand, UUID, and Tauri plugin dependencies
- `src-tauri/Cargo.toml` - Updated with shell, dialog plugins, tokio, and regex dependencies

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Set up project infrastructure and dependencies
  - [x] 1.1 Install and verify all required dependencies (Rust, Node.js, Tauri CLI)
  - [x] 1.2 Configure Tauri project settings (app metadata, window size, permissions)
  - [x] 1.3 Download and configure FFmpeg sidecar binaries for Intel and Apple Silicon
  - [x] 1.4 Set up shell permissions for FFmpeg execution in capabilities/default.json
  - [x] 1.5 Create project directory structure (components, stores, hooks, utils, types)
  - [x] 1.6 Install frontend dependencies (Zustand, UUID, Tauri plugins)
  - [x] 1.7 Configure TypeScript with strict mode and path aliases
  - [x] 1.8 Test basic app launch with `npm run tauri dev`

- [x] 2.0 Implement core data models and state management
  - [x] 2.1 Create TypeScript interfaces in src/types/index.ts (MediaClip, TimelineClip, VideoMetadata, ExportSettings, ExportProgress)
  - [x] 2.2 Implement mediaStore with Zustand (clips array, loading state, actions for add/remove/get clips)
  - [x] 2.3 Implement timelineStore with Zustand (clips, playhead, playing state, zoom, actions for timeline manipulation)
  - [x] 2.4 Implement exportStore with Zustand (exporting state, progress tracking, error handling)
  - [x] 2.5 Create utility functions for time formatting, file size formatting, and video calculations
  - [x] 2.6 Write unit tests for all stores and utility functions

- [x] 3.0 Build video import system with FFmpeg integration
  - [x] 3.1 Set up Rust command infrastructure in src-tauri/src/commands/mod.rs
  - [x] 3.2 Implement FFmpeg probe module for video metadata extraction (duration, resolution, fps, codec)
  - [x] 3.3 Implement FFmpeg thumbnail generation module (extract frame at 1-second mark)
  - [x] 3.4 Create file operations command handler for importing video files
  - [x] 3.5 Implement application data directory setup and cleanup functions
  - [x] 3.6 Create Tauri commands for metadata extraction, thumbnail generation, and file import
  - [x] 3.7 Add error handling for unsupported formats, file access issues, and FFmpeg failures
  - [x] 3.8 Write unit tests for FFmpeg integration and command handlers

- [ ] 4.0 Create media library interface with drag-and-drop
  - [x] 4.1 Create MediaLibrary component with grid layout and empty state
  - [x] 4.2 Implement ImportButton component with native file dialog integration
  - [x] 4.3 Create ClipCard component displaying thumbnails, metadata, and hover effects
  - [x] 4.4 Implement drag-and-drop functionality for importing files
  - [ ] 4.5 Add click handlers for clip selection and double-click to add to timeline
  - [ ] 4.6 Implement right-click context menu for clip deletion
  - [ ] 4.7 Add loading indicators during import and thumbnail generation
  - [ ] 4.8 Handle error states with toast notifications for import failures
  - [ ] 4.9 Write component tests for MediaLibrary, ImportButton, and ClipCard

- [ ] 5.0 Develop video preview player with timeline sync
  - [ ] 5.1 Create VideoPlayer component with HTML5 video element and custom controls
  - [ ] 5.2 Implement PlayerControls component (play/pause, time display, volume control)
  - [ ] 5.3 Create useVideoPlayback hook for managing playback state and timeline sync
  - [ ] 5.4 Implement video synchronization with timeline playhead position
  - [ ] 5.5 Add requestAnimationFrame loop for smooth playback updates
  - [ ] 5.6 Handle video loading states, errors, and codec compatibility issues
  - [ ] 5.7 Implement 16:9 aspect ratio maintenance and responsive sizing
  - [ ] 5.8 Add playback speed control and mute functionality
  - [ ] 5.9 Write tests for video player components and playback hook

- [ ] 6.0 Implement timeline editor with clip manipulation
  - [ ] 6.1 Create Timeline container component with horizontal scroll and time ruler
  - [ ] 6.2 Implement TimelineTrack components for multiple video tracks
  - [ ] 6.3 Create TimelineClip component with visual positioning and duration display
  - [ ] 6.4 Implement Playhead component with draggable scrubbing functionality
  - [ ] 6.5 Add zoom controls and pixel-to-time conversion logic
  - [ ] 6.6 Implement drag-and-drop from media library to timeline tracks
  - [ ] 6.7 Add clip dragging within timeline for reordering
  - [ ] 6.8 Implement trim handles for adjusting clip start/end points
  - [ ] 6.9 Add clip selection, highlighting, and deletion functionality
  - [ ] 6.10 Implement click-to-seek and keyboard shortcuts (spacebar, arrows, home/end)
  - [ ] 6.11 Write comprehensive tests for timeline components and interactions

- [ ] 7.0 Build export system with progress tracking
  - [ ] 7.1 Create FFmpeg export module with concatenation logic
  - [ ] 7.2 Implement export command handler with progress parsing from FFmpeg stderr
  - [ ] 7.3 Create ExportDialog component with settings form (resolution, quality, output path)
  - [ ] 7.4 Implement ExportProgress component with progress bar and time estimates
  - [ ] 7.5 Add export trigger button in header with timeline validation
  - [ ] 7.6 Implement progress event listening and real-time updates
  - [ ] 7.7 Add export cancellation functionality with process termination
  - [ ] 7.8 Handle export errors with user-friendly messages and retry options
  - [ ] 7.9 Implement temporary file cleanup after export completion
  - [ ] 7.10 Write tests for export functionality and progress tracking

- [ ] 8.0 Create application layout and polish UI
  - [ ] 8.1 Create MainLayout component with three-panel structure (Media Library, Video Player, Timeline)
  - [ ] 8.2 Implement Header component with app title and Export button
  - [ ] 8.3 Set up global CSS with design tokens (colors, spacing, typography)
  - [ ] 8.4 Implement dark theme styling with proper contrast and accessibility
  - [ ] 8.5 Add loading spinner component and skeleton loaders for media cards
  - [ ] 8.6 Create toast notification system for errors and success messages
  - [ ] 8.7 Implement error modal component for critical errors
  - [ ] 8.8 Add responsive design support for window resizing
  - [ ] 8.9 Style scrollbars and ensure consistent visual hierarchy
  - [ ] 8.10 Write tests for layout components and UI interactions

- [ ] 9.0 Package and test the complete application
  - [ ] 9.1 Test all features in development mode with various video formats
  - [ ] 9.2 Create production build with `npm run tauri build`
  - [ ] 9.3 Verify FFmpeg binaries are included in bundle and executable
  - [ ] 9.4 Test packaged .dmg installation and app launch on clean macOS system
  - [ ] 9.5 Perform complete workflow testing (import → edit → export)
  - [ ] 9.6 Verify performance requirements (launch <5s, timeline 60fps, export completion)
  - [ ] 9.7 Test error scenarios and edge cases (corrupted files, insufficient space)
  - [ ] 9.8 Fix any packaging issues (permissions, resource paths, binary naming)
  - [ ] 9.9 Create demo video showing all MVP features
  - [ ] 9.10 Update README with installation instructions and feature list
