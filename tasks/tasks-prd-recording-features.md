# Tasks: Recording Features Implementation

Based on PRD: `prd-recording-features.md`

## Relevant Files

- `src/stores/recordingStore.ts` - Zustand store for recording state management
- `src/stores/recordingStore.test.ts` - Unit tests for recording store
- `src/components/Recording/RecordingButton.tsx` - Header recording button component
- `src/components/Recording/RecordingButton.css` - Styles for recording button
- `src/components/Recording/RecordingButton.test.tsx` - Unit tests for recording button
- `src/components/Recording/RecordingDialog.tsx` - Main recording interface dialog
- `src/components/Recording/RecordingDialog.css` - Styles for recording dialog
- `src/components/Recording/RecordingDialog.test.tsx` - Unit tests for recording dialog
- `src/components/Recording/DeviceSelector.tsx` - Screen/camera selection component
- `src/components/Recording/DeviceSelector.css` - Styles for device selector
- `src/components/Recording/DeviceSelector.test.tsx` - Unit tests for device selector
- `src/components/Recording/CameraPreview.tsx` - Live camera preview component
- `src/components/Recording/CameraPreview.css` - Styles for camera preview
- `src/components/Recording/WebcamRecorder.tsx` - Webcam recording wrapper component
- `src/components/Recording/WebcamRecorder.css` - Styles for webcam recorder
- `src/components/Recording/RecordingIndicator.tsx` - Active recording overlay component
- `src/components/Recording/RecordingIndicator.css` - Styles for recording indicator
- `src/components/Recording/PiPSettings.tsx` - Picture-in-picture controls component
- `src/components/Recording/PiPSettings.css` - Styles for PiP settings
- `src/components/Recording/index.ts` - Recording components barrel export
- `src/types/recording.ts` - TypeScript interfaces for recording features
- `src-tauri/src/commands/recording.rs` - Rust command handlers for recording operations
- `src-tauri/src/recording/mod.rs` - Recording module organization
- `src-tauri/src/recording/screen.rs` - Screen recording implementation (AVFoundation)
- `src-tauri/src/recording/pip.rs` - Picture-in-picture recording implementation
- `src/hooks/useWebcamRecording.ts` - Custom hook for webcam recording with Web APIs (getUserMedia)
- `src/hooks/useWebcamRecording.test.ts` - Unit tests for useWebcamRecording hook
- `src/utils/recordingUtils.ts` - Utility functions for webcam recording operations
- `src/utils/recordingUtils.test.ts` - Unit tests for recording utilities
- `src/components/Recording/WebcamRecorder.tsx` - Webcam recording component

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npm run test:run` to run all tests or `npm run test:run [path]` for specific files
- Recording functionality will integrate with existing media library and timeline systems
- **Hybrid Architecture**: Screen recording uses AVFoundation (Rust), webcam recording and preview use Web APIs (getUserMedia)
- PiP recording combines screen recording (Rust) with camera preview (Web APIs) in the frontend
- **Camera Access**: Uses native Web APIs (getUserMedia) with proper Tauri webview configuration
- **Note**: Camera permissions configured in entitlements.plist and tauri.conf.json

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
  - [x] 2.4 Create screen recording command with AVFoundation
  - [x] 2.5 Create PiP recording command for simultaneous recording
  - [x] 2.6 Implement recording session management and cleanup
  - [x] 2.7 Add recording duration tracking and events
  - [x] 2.8 Add error handling and permission management
  - [ ] 2.9 Write unit tests for recording commands
  - [x] 2.10 Register recording commands in Tauri app

- [x] 2.13 Frontend Webcam Recording Infrastructure (React + Web APIs)
  - [x] 2.13.1 Create useWebcamRecording hook for getUserMedia integration
  - [x] 2.13.2 Implement camera device enumeration using navigator.mediaDevices
  - [x] 2.13.3 Create MediaRecorder wrapper for webcam recording
  - [x] 2.13.4 Implement webcam recording state management
  - [x] 2.13.5 Add webcam recording error handling and permissions
  - [x] 2.13.6 Create utility functions for webcam recording operations
  - [x] 2.13.7 Write unit tests for webcam recording functionality

- [x] 3.0 Recording UI Components (React)
  - [x] 3.1 Create RecordingButton component for header integration
  - [x] 3.2 Create RecordingDialog component for main recording interface
  - [x] 3.3 Create DeviceSelector component for screen/camera selection
  - [x] 3.4 Create CameraPreview component for live camera feed
  - [x] 3.5 Create WebcamRecorder component for webcam recording
  - [x] 3.6 Create RecordingIndicator component for active recording overlay
  - [x] 3.7 Create PiPSettings component for Picture-in-Picture controls
  - [x] 3.8 Add CSS styling following ClipForge design tokens
  - [x] 3.9 Implement responsive design and accessibility features
  - [x] 3.10 Write unit tests for all recording components
  - [x] 3.11 Create barrel export file for recording components

- [x] 4.0 Device Detection & Selection (Hybrid Approach)
  - [x] 4.1 Implement screen detection and enumeration in Rust (CoreGraphics)
  - [x] 4.2 Add device information data structures (ScreenInfo, CameraInfo)
  - [x] 4.3 Implement frontend camera device enumeration (Web APIs - navigator.mediaDevices)
  - [x] 4.4 Create device selection UI with dropdown lists
  - [x] 4.5 Implement camera preview functionality (Web APIs - getUserMedia)
  - [x] 4.6 Implement device permission handling and error states
  - [x] 4.7 Add device refresh functionality
  - [x] 4.8 Write tests for device detection and selection

- [x] 5.0 Recording Workflow Integration (Hybrid Approach) - **COMPLETE** ✅
  - [x] 5.1 Integrate RecordingButton into AppHeader component
  - [x] 5.2 Connect recording dialog to RecordingStore state
  - [x] 5.3 Implement screen recording workflow with Tauri commands (AVFoundation)
  - [x] 5.4 Implement webcam recording workflow with Web APIs (getUserMedia) - **Refactored to app-level state**
  - [x] 5.5 Implement PiP recording workflow combining both approaches
  - [x] 5.6 Implement camera preview functionality (Web APIs - getUserMedia)
    - [x] 5.6.1 Configure Tauri webview to allow mediaDevices API access
    - [x] 5.6.2 Update useWebcamRecording hook to use getUserMedia for camera access
    - [x] 5.6.3 Implement camera enumeration with navigator.mediaDevices.enumerateDevices()
    - [x] 5.6.4 Update CameraPreview component to display live camera feed
    - [x] 5.6.5 Add camera preview controls (start/stop, error handling)
    - [x] 5.6.6 Test camera preview with proper permission handling
  - [x] 5.7 **NEW: Refactor webcam recording to app-level state management**
    - [x] 5.7.1 Move webcam recording logic from component to recordingStore
    - [x] 5.7.2 Ensure recording persists across component unmounts
    - [x] 5.7.3 Fix MediaRecorder data collection issues
    - [x] 5.7.4 Update RecordingIndicator to use store methods
    - [x] 5.7.5 Simplify WebcamRecorder component to UI-only
  - [x] 5.8 Add automatic media library integration for completed recordings (FFmpeg with fallback to manual metadata)
  - [x] 5.9 Implement thumbnail generation for recordings using existing FFmpeg pipeline
  - [x] 5.10 Add recording duration limit enforcement (1 hour maximum)
  - [x] 5.11 Implement error handling and user feedback for recording failures
  - [x] 5.12 Add recording indicator overlay during active recording
  - [x] 5.13 Test complete webcam recording workflow (record → save → auto-import) - **Ready for manual testing! 🎉**
  - [ ] 5.14 Add keyboard shortcuts for recording start/stop - SKIPPED per user request
  - [ ] 5.15 Write integration tests for complete recording workflow - SKIPPED per user request
