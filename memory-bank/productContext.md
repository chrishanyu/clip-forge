# Product Context

## Why ClipForge Exists

### The Problem
Content creators need a straightforward video editor that can:
- Capture screen and webcam footage
- Combine multiple video clips
- Perform basic editing operations
- Export polished videos quickly

Existing solutions are either too complex (professional NLEs) or too limited (web-based editors).

### The Solution
ClipForge provides a focused, desktop-native video editing experience with:
- **Integrated recording** (screen + webcam)
- **Intuitive timeline editing** (drag, trim, arrange)
- **Fast export** (FFmpeg-powered)
- **Native performance** (Tauri + Rust)

## Target Users
- **Content creators**: YouTubers, course creators, tutorial makers
- **Professionals**: Anyone creating screen recordings or presentations
- **Skill level**: Beginners to intermediate users
- **Use case**: Quick editing of recordings and clips

## Core User Workflows

### Primary Flow: Import → Edit → Export
1. User imports video files (drag-and-drop or file picker)
2. User drags clips to timeline
3. User trims clips to desired length
4. User previews the composition
5. User exports to MP4

### Secondary Flow: Record → Edit → Export (Post-MVP)
1. User starts screen/webcam recording
2. Recording saves to media library
3. User adds to timeline
4. User edits and exports

## User Experience Goals

### Simplicity
- **Minimal learning curve**: Users should understand the interface immediately
- **Clear visual hierarchy**: Important actions are prominent
- **Obvious workflows**: The path from import to export is clear

### Performance
- **Responsive UI**: Timeline interactions feel instant (60 FPS)
- **Fast operations**: Import, preview, and export happen quickly
- **No waiting**: Loading states are brief and informative

### Reliability
- **No crashes**: Application remains stable during use
- **Error recovery**: Clear error messages with actionable solutions
- **Data safety**: User content is never lost

### Native Feel
- **macOS integration**: Uses native file dialogs and permissions
- **System conventions**: Follows macOS design patterns
- **Keyboard shortcuts**: Standard shortcuts work as expected

## Key Features Breakdown

### Media Library
**Purpose**: Organize and preview imported clips
- Grid view of clips with thumbnails
- Metadata display (duration, resolution, size)
- Quick access to add clips to timeline
- Delete unwanted clips

### Timeline Editor
**Purpose**: Arrange and edit video sequence
- Visual blocks representing clips
- Drag to reorder clips
- Trim handles to adjust clip duration
- Playhead showing current position
- Zoom controls for precision editing

### Video Preview
**Purpose**: Real-time playback of timeline
- Play/pause controls
- Synchronized with timeline playhead
- Volume control
- Time display

### Export Engine
**Purpose**: Create final video file
- Format selection (MP4)
- Resolution options
- Progress tracking
- Error handling

## Design Principles

### 1. Progressive Disclosure
Show advanced features only when needed. MVP focuses on essentials.

### 2. Immediate Feedback
Every action provides visual confirmation (loading states, animations, updates).

### 3. Forgiving Interface
Users can undo mistakes, clips aren't destroyed by editing, clear cancel options.

### 4. Performance First
Optimize for speed over features. Fast is better than feature-rich but slow.

### 5. Native Integration
Leverage macOS capabilities (AVFoundation, VideoToolbox, native dialogs).

## Quality Standards

### Functional Quality
- Every feature works reliably
- Error states are handled gracefully
- Edge cases are considered

### Visual Quality
- Consistent design language
- Clear visual hierarchy
- Professional appearance

### Technical Quality
- Clean, maintainable code
- Efficient resource usage
- Proper error handling

## Competitive Context
While not competing directly with professional tools like Final Cut Pro or Premiere, ClipForge aims to be:
- **Simpler** than professional NLEs
- **More powerful** than basic web editors
- **Faster** than Electron-based alternatives
- **More focused** than general-purpose editors

## Success Indicators
- Users can complete import → edit → export without documentation
- Timeline editing feels responsive and intuitive
- Export produces playable, high-quality videos
- Application remains stable during extended sessions

