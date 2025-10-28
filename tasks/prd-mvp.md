# ClipForge MVP - Product Requirements Document

## Introduction/Overview

ClipForge MVP is a desktop video editor application for macOS that enables users to import video files, arrange them on a timeline, perform basic editing operations (trim), preview the composition, and export the final video. This MVP focuses on the core video editing workflow without recording capabilities, which will be added in Phase 2.

The MVP solves the problem of users needing a simple, native desktop video editor that can quickly combine and edit video clips without the complexity of professional editing software or the limitations of web-based tools.

## Goals

1. **Functional MVP**: Deliver a working desktop application that can import, edit, and export videos
2. **Native Performance**: Achieve sub-5-second app launch and responsive timeline interactions
3. **User-Friendly Interface**: Create an intuitive drag-and-drop editing experience
4. **Reliable Export**: Produce playable MP4 files without crashes
5. **Packaged Distribution**: Deliver an installable .dmg file for macOS

## User Stories

### Primary User Story
**As a content creator**, I want to import video clips, arrange them on a timeline, trim unwanted sections, and export a polished video so that I can quickly create content without complex software.

### Detailed User Stories

1. **Import Videos**
   - As a user, I want to drag video files into the app or use a file picker so that I can quickly add clips to my project
   - As a user, I want to see thumbnails and metadata (duration, resolution, file size) for imported clips so that I can identify them easily

2. **Timeline Editing**
   - As a user, I want to drag clips from the media library onto a timeline so that I can arrange my video sequence
   - As a user, I want to drag clips within the timeline to reorder them so that I can adjust the sequence
   - As a user, I want to trim clips by dragging the edges so that I can remove unwanted sections
   - As a user, I want to see a visual timeline with time markers so that I can understand the duration and timing

3. **Video Preview**
   - As a user, I want to play/pause the video preview so that I can see how my edits look
   - As a user, I want to scrub through the timeline by clicking or dragging the playhead so that I can navigate to specific moments
   - As a user, I want the preview to show the current frame based on the timeline position so that I can see exactly what will be exported

4. **Export Video**
   - As a user, I want to export my timeline to an MP4 file so that I can share or use the final video
   - As a user, I want to see export progress so that I know the process is working
   - As a user, I want to choose where to save the exported file so that I can organize my output

## Functional Requirements

### 1. Application Infrastructure
1. The application must launch successfully on macOS 11.0+ (Intel and Apple Silicon)
2. The application must be packaged as an installable .dmg file
3. The application must integrate FFmpeg as a sidecar binary for video processing
4. The application must use Tauri 2.0 framework with React frontend and Rust backend

### 2. Video Import System
5. The system must allow users to import video files via drag-and-drop onto the application window
6. The system must provide a file picker dialog for selecting video files
7. The system must support MP4, MOV, and WebM video formats
8. The system must allow importing multiple files simultaneously
9. The system must extract and display video metadata (duration, resolution, fps, codec, file size)
10. The system must generate thumbnails for imported videos (extract frame at 1-second mark)
11. The system must validate file formats and handle import errors gracefully

### 3. Media Library Interface
12. The system must display imported clips in a grid layout with thumbnails
13. The system must show clip metadata (filename, duration, resolution, file size) for each clip
14. The system must allow users to select clips by clicking
15. The system must allow users to delete clips from the library
16. The system must handle empty state when no clips are imported

### 4. Timeline Editor
17. The system must provide a horizontal timeline with time ruler showing seconds/minutes
18. The system must support at least 2 tracks for video clips
19. The system must display clips as visual blocks positioned according to their timeline placement
20. The system must allow dragging clips from media library to timeline tracks
21. The system must allow dragging clips within timeline to reorder them
22. The system must prevent overlapping clips on the same track
23. The system must provide zoom controls (1x, 2x, 5x, 10x, 20x) for timeline precision
24. The system must show a playhead (vertical line) indicating current playback position

### 5. Clip Manipulation
25. The system must provide trim handles on clip edges for adjusting start/end points
26. The system must allow dragging trim handles to modify clip duration
27. The system must enforce minimum clip duration of 0.1 seconds
28. The system must update clip duration and timeline position when trimming
29. The system must allow selecting clips by clicking and highlight selected clips
30. The system must allow deleting selected clips with Delete key

### 6. Video Preview Player
31. The system must provide a video player that displays the current frame based on timeline position
32. The system must sync video playback with timeline playhead position
33. The system must provide play/pause controls
34. The system must display current time and total duration in HH:MM:SS format
35. The system must provide volume control and mute functionality
36. The system must handle video loading states and errors gracefully
37. The system must maintain 16:9 aspect ratio in the player

### 7. Timeline Navigation
38. The system must allow clicking anywhere on timeline to jump to that position
39. The system must allow dragging the playhead to scrub through the timeline
40. The system must provide keyboard shortcuts:
    - Spacebar: Play/pause
    - Left/Right arrows: Skip 1 second
    - Home: Jump to timeline start
    - End: Jump to timeline end
    - Delete: Delete selected clip

### 8. Export System
41. The system must provide an export dialog for configuring output settings
42. The system must allow users to select output file location via native save dialog
43. The system must support MP4 output format with H.264 codec
44. The system must provide resolution options (Source, 1080p, 720p)
45. The system must provide quality presets (High, Medium, Low)
46. The system must execute FFmpeg concatenation to combine timeline clips
47. The system must show export progress with percentage and estimated time remaining
48. The system must allow canceling export operations
49. The system must handle export errors and provide user-friendly error messages
50. The system must clean up temporary files after export completion

### 9. User Interface
51. The system must provide a three-panel layout: Media Library (left), Video Player (center-top), Timeline (center-bottom)
52. The system must include a header with app title and Export button
53. The system must use a dark theme with appropriate color contrast
54. The system must provide loading indicators for all async operations
55. The system must show toast notifications for errors and success messages
56. The system must be responsive to window resizing

### 10. Performance Requirements
57. The application must launch in less than 5 seconds
58. The application must import videos in less than 2 seconds (for files < 100MB)
59. The timeline must remain responsive (60 FPS) during drag operations
60. The video preview must maintain at least 30 FPS during playback
61. The application must use less than 500MB memory when idle
62. The packaged .dmg must be less than 250MB in size

## Non-Goals (Out of Scope)

### Recording Features (Deferred to Phase 2)
- Screen recording functionality
- Webcam recording functionality
- Picture-in-picture recording
- Audio capture from microphone

### Advanced Editing Features
- Multiple video tracks (only 2 tracks for MVP)
- Video effects or filters
- Transitions between clips
- Text overlays
- Audio waveform visualization
- Color correction

### Project Management
- Save/load project files
- Undo/redo functionality
- Multiple project tabs
- Recent projects list

### Advanced Export Options
- Custom resolution input
- Multiple export formats
- Batch export
- Cloud upload integration

### Platform Support
- Windows or Linux support (macOS only for MVP)
- Mobile or web versions

## Design Considerations

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  ClipForge                    ⚫ 🟡 🟢  [Export]           │ Header
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   Media      │         Video Preview Player                │
│   Library    │                                              │
│              │         [▶️ Play] [⏸️] [⏹️]                  │
│  [+ Import]  │                                              │
│              │         00:00:15.240 / 00:02:30.000          │
│  ┌─────────┐ │                                              │
│  │ Clip 1  │ ├──────────────────────────────────────────────┤
│  │ 00:30   │ │                                              │
│  └─────────┘ │         Timeline                             │
│              │  ┌────────────────────────────────────────┐ │
│  ┌─────────┐ │  │ Track 1: [====Clip1====][==Clip2==]    │ │
│  │ Clip 2  │ │  │ Track 2: [==PiP==]                     │ │
│  │ 01:15   │ │  └────────────────────────────────────────┘ │
│  └─────────┘ │  [Zoom: 1x] [Snap: ON]                      │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Visual Design Tokens
- **Colors**: Dark theme with blue primary (#3B82F6), red danger (#EF4444), green success (#10B981)
- **Typography**: System fonts (-apple-system, BlinkMacSystemFont)
- **Spacing**: 8px base unit for consistent spacing
- **Layout**: Fixed 240px media library width, resizable timeline height

### Component Architecture
- **Media Library**: Grid of clip cards with thumbnails and metadata
- **Video Player**: HTML5 video element with custom controls overlay
- **Timeline**: Horizontal tracks with draggable clips and playhead
- **Export Dialog**: Modal with settings form and progress indicator

## Technical Considerations

### Technology Stack
- **Frontend**: React 18 + TypeScript + Zustand + Vite
- **Backend**: Rust + Tauri 2.0
- **Media Processing**: FFmpeg (bundled as sidecar)
- **State Management**: Zustand stores for media, timeline, and export state

### Key Technical Patterns
- **FFmpeg Sidecar**: Bundle pre-compiled binaries for Intel and Apple Silicon
- **Video Sync**: Use requestAnimationFrame to sync HTML5 video with timeline playhead
- **Timeline Rendering**: DOM-based positioning with CSS transforms for performance
- **Export Process**: Simple concatenation with `ffmpeg -c copy` for speed

### Data Flow
1. User imports videos → Rust extracts metadata → Zustand stores clips
2. User drags to timeline → Timeline store updates → UI re-renders
3. User plays video → Timeline updates playhead → Video seeks to position
4. User exports → Timeline data sent to Rust → FFmpeg processes → Progress events

### File Organization
```
src/
├── components/
│   ├── MediaLibrary/    # Import and clip management
│   ├── Timeline/        # Timeline editor components
│   ├── Preview/         # Video player and controls
│   ├── Export/          # Export dialog and progress
│   └── Layout/          # App layout and structure
├── stores/              # Zustand state management
├── hooks/               # Custom React hooks
├── utils/               # Helper functions
└── types/               # TypeScript interfaces
```

## Success Metrics

### Functional Success
- All 7 MVP requirements working without crashes
- Complete import → edit → export workflow functional
- App installs and launches on clean macOS system
- Exported videos play correctly in QuickTime Player

### Performance Success
- App launch time < 5 seconds
- Timeline remains responsive with 10+ clips
- Export completes without memory issues
- Bundle size < 250MB

### User Experience Success
- Users can complete basic editing workflow without documentation
- Drag-and-drop operations feel intuitive and responsive
- Error messages are clear and actionable
- Loading states provide appropriate feedback

## Open Questions

### Technical Questions
1. Should we implement Canvas-based timeline rendering for better performance with many clips?
2. How should we handle video codec compatibility issues in the preview player?
3. What's the best approach for handling very large video files (>5GB)?

### User Experience Questions
1. Should we provide keyboard shortcuts reference panel in the UI?
2. How should we handle timeline zoom when clips are very short (<1 second)?
3. Should we show waveform visualization for audio tracks (stretch goal)?

### Implementation Questions
1. What's the optimal thumbnail cache size limit?
2. Should we implement clip duplication feature for MVP?
3. How should we handle timeline snapping to grid vs. free positioning?

---

**Document Version**: 1.0  
**Created**: Project Initialization  
**Status**: Ready for Implementation  
**Target Completion**: MVP Phase (Phase 1)
