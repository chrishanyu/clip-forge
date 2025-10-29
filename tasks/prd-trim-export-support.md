# Product Requirements Document: Trim Export Support

## Introduction/Overview

The trim export support feature addresses a critical limitation in ClipForge's export system where trimmed clips on the timeline are not properly exported. Currently, when users trim video clips on the timeline and export, the system exports the entire original video files instead of the trimmed portions, resulting in larger file sizes and unwanted content in the final video. This feature will ensure that the export system respects the trim data from timeline clips, exporting only the trimmed portions in the correct timeline order.

## Goals

1. **Accurate Trim Export**: Export only the trimmed portions of video clips as defined by the timeline
2. **Timeline Order Preservation**: Maintain the correct sequence of clips as arranged on the timeline
3. **File Size Optimization**: Reduce exported file sizes by excluding untrimmed content
4. **Seamless User Experience**: Make trim export work transparently without additional user interaction
5. **Performance Optimization**: Skip trimming for clips that don't actually need it (full duration clips)

## User Stories

### Primary User Stories
- **As a video editor**, I want my trimmed clips to export as trimmed portions so that my final video only contains the content I selected
- **As a user**, I want my timeline arrangement to be preserved in the export so that clips appear in the correct order
- **As a user**, I want smaller exported files so that I don't waste storage space on unwanted content
- **As a user**, I want the export to work automatically so that I don't need to manually specify trim points during export

### Secondary User Stories
- **As a user**, I want the export to fail clearly if trimming fails so that I know there's an issue
- **As a user**, I want the export to be fast so that I don't wait unnecessarily for clips that don't need trimming

## Functional Requirements

### 8.1 Trim Data Processing
1. The system must read trim data (trimStart, trimEnd) from timeline clips during export
2. The system must validate that trim data is within the bounds of the original video duration
3. The system must calculate the actual duration of trimmed clips (trimEnd - trimStart)
4. The system must handle clips with no trimming (trimStart = 0, trimEnd = full duration) efficiently

### 8.2 FFmpeg Trim Implementation
1. The system must use FFmpeg's `-ss` (start time) and `-t` (duration) parameters for trimming
2. The system must create temporary trimmed files for clips that require trimming
3. The system must skip trimming for clips that use the full original duration
4. The system must use the `-c copy` codec for trimmed files to avoid re-encoding when possible
5. The system must handle different video formats supported by FFmpeg

### 8.3 Timeline Order Preservation
1. The system must export clips in the order they appear on the timeline (by startTime)
2. The system must respect track ordering when multiple tracks contain clips
3. The system must maintain the timeline's chronological sequence in the final export
4. The system must handle overlapping clips on different tracks correctly

### 8.4 Temporary File Management
1. The system must create temporary files in the system's temporary directory
2. The system must generate unique filenames for temporary trimmed files
3. The system must clean up temporary files after successful export
4. The system must clean up temporary files after failed export
5. The system must handle cleanup errors gracefully without affecting user experience

### 8.5 Error Handling and Validation
1. The system must validate that trimStart is not negative
2. The system must validate that trimEnd is greater than trimStart
3. The system must validate that trimEnd does not exceed the original video duration
4. The system must fail the entire export if any single clip trimming fails
5. The system must provide clear error messages when trimming fails
6. The system must enforce a minimum clip duration of 0.1 seconds

### 8.6 Performance Optimization
1. The system must skip trimming for clips where trimStart = 0 and trimEnd = full duration
2. The system must use the most efficient FFmpeg parameters for trimming
3. The system must minimize the number of temporary files created
4. The system must clean up temporary files as soon as they're no longer needed

### 8.7 Integration with Existing Export System
1. The system must work with existing export settings (resolution, quality, codec)
2. The system must integrate with the existing progress tracking system
3. The system must maintain compatibility with the current export dialog
4. The system must preserve all existing export functionality

## Non-Goals (Out of Scope)

1. **Real-time Trim Preview**: No preview of trimmed content during export progress
2. **Advanced Trim Operations**: No support for complex trimming like multiple segments from one clip
3. **Trim Validation UI**: No user interface for validating trim points before export
4. **Trim History**: No tracking of trim operations or undo functionality
5. **Custom Trim Formats**: No support for non-standard trim data formats
6. **Trim Optimization**: No automatic optimization of trim points for performance
7. **Multi-segment Clips**: No support for clips with gaps or multiple non-contiguous segments

## Design Considerations

### User Experience
- **Transparent Operation**: Users should not need to understand that trimming is happening
- **Consistent Behavior**: Trim export should work the same way as regular export
- **Error Clarity**: Error messages should clearly indicate trim-related failures
- **Progress Indication**: Export progress should continue to work normally

### Performance
- **Efficient Processing**: Minimize temporary file creation and processing time
- **Memory Management**: Handle large video files without excessive memory usage
- **Cleanup Reliability**: Ensure temporary files are always cleaned up

## Technical Considerations

### Backend (Rust/Tauri)
- **FFmpeg Integration**: Use existing FFmpeg sidecar for trim operations
- **File Operations**: Leverage existing temporary file management system
- **Error Handling**: Integrate with existing error handling patterns
- **Progress Tracking**: Maintain compatibility with existing progress events

### Frontend (React/TypeScript)
- **No UI Changes**: Existing export dialog and progress components remain unchanged
- **Data Flow**: Timeline clip data already contains necessary trim information
- **Error Display**: Use existing error handling and toast notification system

### Integration Points
- **Timeline Store**: Access existing trim data from TimelineClip objects
- **Export Store**: Maintain compatibility with existing export state management
- **FFmpeg Module**: Extend existing FFmpeg export module with trim functionality

## Success Metrics

1. **Export Accuracy**: 100% of trimmed clips export with correct trim points
2. **File Size Reduction**: Exported files are smaller than untrimmed exports by expected amount
3. **Timeline Order**: 100% of exports maintain correct clip sequence
4. **Performance**: Export time increases by no more than 20% due to trimming overhead
5. **Error Rate**: Less than 1% of exports fail due to trim-related issues
6. **User Satisfaction**: No user confusion about trim export behavior

## Open Questions

1. **Split Clip Handling**: How should the system handle clips that have been split on the timeline?
2. **Trim Precision**: What level of precision is required for trim start/end times?
3. **Codec Compatibility**: Are there any codec-specific considerations for trimming?
4. **Memory Limits**: What is the maximum number of clips that can be trimmed simultaneously?
5. **Temporary File Naming**: What naming convention should be used for temporary trimmed files?
6. **Progress Granularity**: Should trim operations be reflected in export progress updates?
7. **Validation Timing**: When should trim data validation occur - during export or earlier?
8. **Fallback Behavior**: Should there be a fallback to non-trimmed export if trimming fails?

## Dependencies

- **FFmpeg Sidecar**: Required for video trimming operations
- **Timeline Store**: Source of trim data from TimelineClip objects
- **Export Store**: Integration with existing export state management
- **File System APIs**: For temporary file creation and cleanup
- **Existing Export System**: Integration with current export pipeline

## Implementation Priority

1. **High Priority**: Core trim functionality, timeline order preservation, error handling
2. **Medium Priority**: Performance optimization, temporary file management
3. **Low Priority**: Advanced error messages, progress enhancements
4. **Future**: Split clip handling, advanced trim operations

---

**Document Version**: 1.0  
**Created**: December 2024  
**Status**: Ready for Implementation
