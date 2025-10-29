# Tasks: Recording Features Implementation

Based on PRD: `prd-recording-features.md`

## Relevant Files

- `src/stores/recordingStore.ts` - Zustand store for recording state management
- `src/stores/recordingStore.test.ts` - Unit tests for recording store
- `src/components/Recording/RecordingButton.tsx` - Header recording button component
- `src/components/Recording/RecordingButton.test.tsx` - Unit tests for recording button
- `src/components/Recording/RecordingDialog.tsx` - Main recording interface dialog
- `src/components/Recording/RecordingDialog.test.tsx` - Unit tests for recording dialog
- `src/components/Recording/DeviceSelector.tsx` - Screen/camera selection component
- `src/components/Recording/DeviceSelector.test.tsx` - Unit tests for device selector
- `src/components/Recording/CameraPreview.tsx` - Live camera preview component
- `src/components/Recording/CameraPreview.test.tsx` - Unit tests for camera preview
- `src/components/Recording/RecordingIndicator.tsx` - Active recording overlay component
- `src/components/Recording/RecordingIndicator.test.tsx` - Unit tests for recording indicator
- `src/components/Recording/PiPSettings.tsx` - Picture-in-picture controls component
- `src/components/Recording/PiPSettings.test.tsx` - Unit tests for PiP settings
- `src/components/Recording/index.ts` - Recording components barrel export
- `src/types/recording.ts` - TypeScript interfaces for recording features
- `src-tauri/src/commands/recording.rs` - Rust command handlers for recording operations
- `src-tauri/src/recording/mod.rs` - Recording module organization
- `src-tauri/src/recording/screen.rs` - Screen recording implementation (AVFoundation)
- `src-tauri/src/recording/camera.rs` - Camera enumeration only (actual recording in frontend)
- `src-tauri/src/recording/pip.rs` - Picture-in-picture recording implementation
- `src/hooks/useWebcamRecording.ts` - Custom hook for webcam recording with getUserMedia
- `src/utils/recordingUtils.ts` - Utility functions for webcam recording
- `src/components/Recording/WebcamRecorder.tsx` - Webcam recording component

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npm run test:run` to run all tests or `npm run test:run [path]` for specific files
- Recording functionality will integrate with existing media library and timeline systems
- **Hybrid Architecture**: Screen recording uses AVFoundation (Rust), webcam recording uses getUserMedia (frontend)
- PiP recording combines both approaches in the frontend

## Tasks

- [x] 1.0 Recording State Management & Data Models
  - [x] 1.1 Create TypeScript interfaces for recording features in `src/types/recording.ts`
  - [x] 1.2 Implement RecordingStore with Zustand following project patterns
  - [x] 1.3 Add recording state management actions (start, stop, update duration)
  - [x] 1.4 Add device management state (screens, cameras, selection)
  - [x] 1.5 Add PiP settings state management
  - [x] 1.6 Add audio settings state management
  - [x] 1.7 Write comprehensive unit tests for RecordingStore
  - [x] 1.8 Integrate RecordingStore with existing store architecture

- [x] 2.0 Backend Recording Infrastructure (Rust) - Screen Recording Only
  - [x] 2.1 Set up recording module structure in `src-tauri/src/recording/`
  - [x] 2.2 Add AVFoundation dependencies to Cargo.toml
  - [x] 2.3 Implement screen enumeration using CoreGraphics
  - [x] 2.4 Implement camera enumeration using AVFoundation (for device detection only)
  - [x] 2.5 Create screen recording command with AVFoundation
  - [x] 2.6 Create camera enumeration commands (actual recording in frontend)
  - [x] 2.7 Create PiP recording command for simultaneous recording
  - [x] 2.8 Implement recording session management and cleanup
  - [x] 2.9 Add recording duration tracking and events
  - [x] 2.10 Add error handling and permission management
  - [ ] 2.11 Write unit tests for recording commands
  - [x] 2.12 Register recording commands in Tauri app

- [ ] 2.13 Frontend Webcam Recording Infrastructure (React + Web APIs)
  - [ ] 2.13.1 Create useWebcamRecording hook for getUserMedia integration
  - [ ] 2.13.2 Implement camera device enumeration using navigator.mediaDevices
  - [ ] 2.13.3 Create MediaRecorder wrapper for webcam recording
  - [ ] 2.13.4 Implement webcam recording state management
  - [ ] 2.13.5 Add webcam recording error handling and permissions
  - [ ] 2.13.6 Create utility functions for webcam recording operations
  - [ ] 2.13.7 Write unit tests for webcam recording functionality

- [ ] 3.0 Recording UI Components (React)
  - [ ] 3.1 Create RecordingButton component for header integration
  - [ ] 3.2 Create RecordingDialog component for main recording interface
  - [ ] 3.3 Create DeviceSelector component for screen/camera selection
  - [ ] 3.4 Create CameraPreview component for live camera feed
  - [ ] 3.5 Create WebcamRecorder component for webcam recording
  - [ ] 3.6 Create RecordingIndicator component for active recording overlay
  - [ ] 3.7 Create PiPSettings component for Picture-in-Picture controls
  - [ ] 3.8 Add CSS styling following ClipForge design tokens
  - [ ] 3.9 Implement responsive design and accessibility features
  - [ ] 3.10 Write unit tests for all recording components
  - [ ] 3.11 Create barrel export file for recording components

- [ ] 4.0 Device Detection & Selection (Hybrid Approach)
  - [x] 4.1 Implement screen detection and enumeration in Rust (CoreGraphics)
  - [x] 4.2 Implement camera detection and enumeration in Rust (AVFoundation)
  - [x] 4.3 Add device information data structures (ScreenInfo, CameraInfo)
  - [ ] 4.4 Implement frontend camera device enumeration (navigator.mediaDevices)
  - [ ] 4.5 Create device selection UI with dropdown lists
  - [ ] 4.6 Add device preview functionality for cameras (getUserMedia)
  - [ ] 4.7 Implement device permission handling and error states
  - [ ] 4.8 Add device refresh functionality
  - [ ] 4.9 Write tests for device detection and selection

- [ ] 5.0 Recording Workflow Integration (Hybrid Approach)
  - [ ] 5.1 Integrate RecordingButton into AppHeader component
  - [ ] 5.2 Connect recording dialog to RecordingStore state
  - [ ] 5.3 Implement screen recording workflow with Tauri commands (AVFoundation)
  - [ ] 5.4 Implement webcam recording workflow with Web APIs (getUserMedia)
  - [ ] 5.5 Implement PiP recording workflow combining both approaches
  - [ ] 5.6 Add automatic media library integration for completed recordings
  - [ ] 5.7 Implement thumbnail generation for recordings using existing FFmpeg pipeline
  - [ ] 5.8 Add recording duration limit enforcement (1 hour maximum)
  - [ ] 5.9 Implement error handling and user feedback for recording failures
  - [ ] 5.10 Add recording indicator overlay during active recording
  - [ ] 5.11 Test complete recording workflow (record → save → timeline)
  - [ ] 5.12 Add keyboard shortcuts for recording start/stop
  - [ ] 5.13 Write integration tests for complete recording workflow
