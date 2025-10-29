# ClipForge - Project Brief

## Project Identity
- **Name**: ClipForge
- **Type**: Desktop Video Editor Application
- **Platform**: macOS (Intel + Apple Silicon)
- **Status**: MVP Development / Core Features Complete
- **Version**: 0.1.0-mvp-timeline-editor

## Core Mission
Build a production-grade native macOS video editor that enables creators to record their screen/webcam, import video clips, arrange them on a timeline, and export professional videos - all within a single desktop application.

## Value Proposition
1. **Native Performance**: Tauri-based desktop app with minimal bundle size
2. **Integrated Recording**: Screen + webcam capture without external tools
3. **Intuitive Timeline**: Drag-and-drop video editing
4. **Fast Export**: FFmpeg-powered video encoding

## Critical Success Criteria

### MVP Requirements (Hard Gate)
1. ✅ Desktop app launches successfully
2. ✅ Video import via drag-and-drop or file picker (MP4, MOV)
3. ✅ Timeline view showing imported clips as visual blocks
4. ✅ Video preview player with play/pause
5. ✅ Basic trim: Set in/out points on a single clip
6. 🟡 Export to MP4 (backend ready, UI pending)
7. 🔴 Packaged as installable .dmg (not tested)

### Technical Validation
- App must build with `cargo tauri build`
- Bundle must install and run on clean macOS system
- No crashes during basic import → trim → export workflow

### Performance Targets
- App launch: < 5 seconds
- Import video: < 2 seconds (for files < 100MB)
- Timeline responsiveness: 60 FPS during drag operations
- Export start: < 1 second from click to FFmpeg start
- Bundle size: < 250MB

## Scope Boundaries

### In Scope for MVP
- ✅ Video import and file management
- ✅ Timeline with basic clip manipulation
- ✅ Video preview player
- ✅ Basic trim functionality
- 🟡 Simple concatenation export (backend ready, UI pending)

### Out of Scope for MVP
- Recording features (deferred to full submission)
- Multiple tracks (only 2 tracks needed)
- Effects or transitions
- Text overlays
- Advanced timeline features
- Undo/redo functionality
- Project save/load

### Future Enhancements (Post-MVP)
- Screen and webcam recording
- Picture-in-picture recording
- Audio waveform visualization
- Transitions and effects
- Text overlays
- Project management

## Technical Approach

### Architecture
- **Frontend**: React 18 + TypeScript + Zustand
- **Backend**: Rust + Tauri 2.0
- **Media Processing**: FFmpeg (bundled as sidecar)
- **Build Tool**: Vite

### Key Technical Decisions
1. **FFmpeg as Sidecar**: Bundle pre-compiled binaries instead of compiling
2. **DOM-based Timeline**: Start with DOM rendering (consider Canvas if performance issues)
3. **HTML5 Video**: Use native video element for playback
4. **Zustand State**: Lightweight state management over Redux
5. **Simple Concatenation**: Use `ffmpeg -c copy` for MVP (no re-encoding)

## Constraints
- **Platform**: macOS only (11.0+)
- **Time**: Optimized for rapid development
- **Size**: Keep bundle under 250MB
- **Dependencies**: Minimize external dependencies

## Success Metrics
- Functional: 6/7 MVP requirements working (export UI pending)
- Performance: Meets all performance targets
- Quality: No crashes during 10-minute usage
- Packaging: Installable .dmg that works on clean system (not tested)

## Key Deliverables
1. Working desktop application (.dmg)
2. Source code with clear structure
3. README with installation instructions
4. Demo video showing core features

## Risk Mitigation
- **FFmpeg bundling issues**: Test early, have fallback plan
- **Timeline performance**: Start simple, optimize if needed
- **Export complexity**: Use simple concat for MVP
- **Time constraints**: Clear MVP scope, defer advanced features

