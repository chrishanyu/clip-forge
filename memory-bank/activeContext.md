# Active Context

**Last Updated**: Project Initialization
**Current Phase**: Pre-Development / Planning
**Focus**: Memory Bank Initialization

## Current Work Status

### What We're Doing Now
Initializing the ClipForge project memory bank to establish a clear foundation for development. This is the starting point before any implementation begins.

### Immediate Next Steps
1. **Project Setup** (Priority: CRITICAL)
   - Verify Tauri project structure is correct
   - Install all required dependencies
   - Test basic app launch with `npm run tauri dev`
   - Set up FFmpeg sidecar binaries

2. **Foundation Work** (Priority: HIGH)
   - Create data models and TypeScript types
   - Set up Zustand stores (media, timeline, export)
   - Establish Rust command infrastructure
   - Configure Tauri permissions properly

3. **First Feature Implementation** (Priority: HIGH)
   - Implement video import (Rust backend)
   - Create media library UI
   - Set up basic file handling

## Recent Changes
- ✅ Memory bank initialized with all core files
- ✅ Project brief documented
- ✅ Architecture patterns defined
- ✅ Technical stack confirmed

## Active Decisions & Considerations

### Critical Decisions Made
1. **FFmpeg as Sidecar**: Confirmed - bundle pre-compiled binaries
2. **State Management**: Zustand over Redux for simplicity
3. **Timeline Rendering**: Start with DOM, migrate to Canvas only if needed
4. **MVP Scope**: Import, timeline, preview, trim, export - NO recording yet

### Open Questions
1. **CSS Approach**: Tailwind CSS vs plain CSS modules?
   - Recommendation: Plain CSS for MVP (faster setup, no build config)
   
2. **Thumbnail Storage**: Where to cache?
   - Recommendation: `~/Library/Application Support/com.clipforge.app/thumbnails/`
   
3. **Error Handling**: Toast library or custom?
   - Recommendation: Custom simple toast (avoid dependencies)

### Pending Investigations
- FFmpeg binary sourcing (exact URLs for download)
- Tauri 2.0 permission configuration specifics
- Video codec compatibility testing approach

## Current Challenges

### Technical Challenges
1. **FFmpeg Integration Complexity**
   - Need to correctly configure sidecar in Tauri v2
   - Must handle both Intel and Apple Silicon architectures
   - Permission system in v2 is different from v1
   - **Mitigation**: Test early, reference Tauri 2.0 docs

2. **Timeline Performance**
   - Unknown if DOM rendering will handle 50+ clips smoothly
   - Drag operations must remain responsive
   - **Mitigation**: Start simple, profile early, optimize if needed

3. **Video Playback Sync**
   - Keeping HTML5 video in sync with timeline playhead
   - Handling clip boundaries during playback
   - **Mitigation**: Use requestAnimationFrame, implement carefully

### Development Challenges
1. **Time Constraints**
   - MVP must be complete and functional
   - Need to prioritize ruthlessly
   - **Mitigation**: Stick to task list, defer all non-MVP features

2. **First Time with Tauri 2.0**
   - Version 2.0 has breaking changes from v1
   - Permission system is new
   - **Mitigation**: Reference official migration guide

## Implementation Strategy

### Development Order (Critical Path)
Following this order ensures each piece builds on stable foundations:

1. **Infrastructure** (Days 1-2)
   - Project setup and dependencies
   - FFmpeg sidecar configuration
   - Basic app structure and layout

2. **Backend Foundation** (Days 2-3)
   - File operations and metadata extraction
   - Thumbnail generation
   - Rust-TypeScript bridge testing

3. **Core UI** (Days 3-4)
   - Media library with import
   - Video player with controls
   - Basic timeline structure

4. **Timeline Editing** (Days 4-5)
   - Clip rendering and positioning
   - Drag and drop functionality
   - Trim handles
   - Playhead interaction

5. **Export** (Days 5-6)
   - FFmpeg concatenation
   - Progress tracking
   - Export UI

6. **Polish & Packaging** (Days 6-7)
   - Bug fixes
   - Error handling
   - Build and test .dmg
   - Demo video

### Testing Approach
- **Continuous testing**: Test each feature as implemented
- **Integration testing**: Test full workflows frequently
- **Packaging testing**: Build .dmg early (Day 3-4) to catch issues

### Risk Mitigation
- **FFmpeg issues**: Test sidecar execution by Day 2
- **Timeline performance**: Profile by Day 4, optimize if needed
- **Export problems**: Test simple concat by Day 5

## Code Organization Guidelines

### TypeScript Standards
- Strict mode enabled
- Explicit types (avoid `any`)
- Interfaces in `src/types/index.ts`
- Functional components with hooks

### Rust Standards
- All commands async
- Structured error types
- Meaningful error messages
- Clean up resources (temp files)

### Component Structure
- One component per file
- Props interface at top
- State and hooks before render
- Helper functions below component

### Store Organization
- Separate stores for separate concerns
- Actions return void (update state directly)
- Computed values as getters
- No store dependencies (access via hooks)

## Current Blockers
**None** - Project is in initial setup phase

## Definition of "Done" for Current Phase
Memory bank initialization is complete when:
- ✅ All 6 core memory bank files exist
- ✅ Project brief is comprehensive
- ✅ Architecture patterns are documented
- ✅ Technical stack is clear
- ✅ Active context reflects current state
- ✅ Progress tracking is in place

**Status**: ✅ **COMPLETE**

## Next Session Goals
When development begins:
1. Verify project structure and dependencies
2. Test `npm run tauri dev` successfully launches
3. Download and configure FFmpeg binaries
4. Create initial data models (TypeScript types)
5. Set up first Zustand store (mediaStore)
6. Implement first Rust command (verify FFmpeg)

## Notes & Reminders

### Important Paths
- FFmpeg binaries: `src-tauri/bin/`
- Thumbnails: `~/Library/Application Support/com.clipforge.app/thumbnails/`
- Temp files: `/tmp/clipforge/`
- Build output: `src-tauri/target/release/bundle/dmg/`

### Key Commands
```bash
# Development
npm run tauri dev

# Build production
npm run tauri build

# Rust linting
cargo clippy

# TypeScript check
npm run type-check  # (if configured)
```

### Reference Documents
- PRD: `clip-forge-prd.md` (comprehensive feature specs)
- Task List: `clip-forge-task-list.md` (implementation checklist)
- Memory Bank: `memory-bank/` (this directory)

### Communication Notes
- Focus on MVP first, defer everything else
- Prioritize working features over perfect code
- Test early, test often
- Package and test .dmg before final day

