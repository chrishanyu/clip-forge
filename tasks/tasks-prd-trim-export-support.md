# Task List: Trim Export Support

## Relevant Files

- `src-tauri/src/ffmpeg/export.rs` - FFmpeg export module that needs trim functionality
- `src-tauri/src/ffmpeg/export.test.rs` - Unit tests for export module trim functionality
- `src-tauri/src/commands/export.rs` - Tauri command handlers for export operations
- `src-tauri/src/commands/export.test.rs` - Unit tests for export commands with trim support
- `src/types/timeline.ts` - TimelineClip interface (already contains trim data)
- `src/stores/timelineStore.ts` - Timeline store (already provides trim data)
- `src/components/Export/ExportDialog.tsx` - Export dialog (already passes trim data)
- `src/components/Export/ExportProgress.tsx` - Export progress component (no changes needed)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Trim Data Processing and Validation
  - [x] 1.1 Create trim data validation functions in `src-tauri/src/ffmpeg/export.rs`
  - [x] 1.2 Implement trim data reading from TimelineExportClip structures
  - [x] 1.3 Add validation for trimStart >= 0 and trimEnd > trimStart
  - [x] 1.4 Add validation for trimEnd <= original video duration
  - [x] 1.5 Implement minimum clip duration validation (0.1 seconds)
  - [x] 1.6 Add function to detect clips that don't need trimming (full duration)
  - [x] 1.7 Write unit tests for trim data validation functions
- [x] 2.0 FFmpeg Trim Implementation
  - [x] 2.1 Create function to generate FFmpeg trim commands with -ss and -t parameters
  - [x] 2.2 Implement temporary file creation for trimmed clips
  - [x] 2.3 Add FFmpeg execution for individual clip trimming
  - [x] 2.4 Implement -c copy codec usage to avoid re-encoding when possible
  - [x] 2.5 Add support for different video formats (MP4, MOV, AVI, etc.)
  - [x] 2.6 Create function to skip trimming for full-duration clips
  - [x] 2.7 Write unit tests for FFmpeg trim functionality
- [x] 3.0 Temporary File Management System
  - [x] 3.1 Create unique filename generation for temporary trimmed files
  - [x] 3.2 Implement temporary file creation in system temp directory
  - [x] 3.3 Add temporary file cleanup after successful export
  - [x] 3.4 Add temporary file cleanup after failed export
  - [x] 3.5 Implement graceful cleanup error handling
  - [x] 3.6 Add cleanup of temporary files as soon as they're no longer needed
  - [x] 3.7 Write unit tests for temporary file management
- [x] 4.0 Timeline Order Preservation
  - [x] 4.1 Modify generate_concat_file to sort clips by timeline startTime
  - [x] 4.2 Implement track ordering for clips on different tracks
  - [x] 4.3 Add chronological sequence validation for timeline clips
      - [x] 4.4 Handle overlapping clips on different tracks correctly
      - [x] 4.5 Update concat file generation to use trimmed files when available
      - [x] 4.6 Write unit tests for timeline order preservation
- [ ] 5.0 Error Handling and Integration Testing
  - [ ] 5.1 Add comprehensive error handling for trim failures
  - [ ] 5.2 Implement export failure when any single clip trimming fails
  - [ ] 5.3 Add clear error messages for trim-related failures
  - [ ] 5.4 Integrate trim functionality with existing progress tracking
  - [ ] 5.5 Test integration with existing export dialog and settings
  - [ ] 5.6 Add end-to-end tests for complete trim export workflow
  - [ ] 5.7 Test error scenarios and cleanup behavior
  - [ ] 5.8 Write integration tests for trim export system
