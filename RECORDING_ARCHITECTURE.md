# ClipForge Recording Architecture

**Date**: January 2025  
**Status**: Camera Preview Implemented with Web APIs

## Overview

ClipForge uses a **hybrid recording architecture** that combines native macOS screen recording with web-based camera access for maximum simplicity and cross-platform compatibility.

## Architecture Decision

### Screen Recording: Rust Backend (AVFoundation)
- **Why**: Native macOS performance, system-level access
- **Implementation**: Tauri commands with AVFoundation bindings
- **Status**: In development

### Webcam Recording: Web APIs (Frontend)
- **Why**: Simpler, cross-platform, no Objective-C bindings
- **Implementation**: getUserMedia + MediaRecorder
- **Status**: Camera preview working, recording in progress

## Key Components

### Camera Preview ✅ IMPLEMENTED
- **Technology**: `navigator.mediaDevices.getUserMedia()`
- **Implementation**: Direct MediaStream → video element
- **Benefits**:
  - Real-time camera feed
  - No IPC overhead
  - Built-in permission handling
  - Browser-optimized performance

### Camera Enumeration ✅ IMPLEMENTED
- **Technology**: `navigator.mediaDevices.enumerateDevices()`
- **Implementation**: Frontend store (recordingStore)
- **Returns**: Actual camera names and device IDs

### Webcam Recording 🟡 IN PROGRESS
- **Technology**: MediaRecorder API
- **Implementation**: React hooks
- **Benefits**: Browser-optimized, cross-platform

### Picture-in-Picture 🟡 IN PROGRESS
- **Combination**: Screen recording (Rust) + webcam stream (Web APIs)
- **Composition**: Frontend combines both streams

## Configuration

### Tauri Configuration
```json
{
  "webview": {
    "allowedApis": {
      "mediaDevices": true
    }
  },
  "security": {
    "csp": "default-src 'self'; media-src 'self' asset: https://asset.localhost blob: mediastream:; ..."
  }
}
```

### macOS Entitlements
```xml
<key>com.apple.security.device.camera</key>
<true/>
<key>com.apple.security.device.microphone</key>
<true/>
```

## Benefits of Web APIs Approach

### 1. Simplicity
- No Objective-C bindings needed
- No native FFI complexity
- Standard browser APIs

### 2. Cross-Platform
- Same code works on Windows, Linux, macOS
- No platform-specific implementations

### 3. Maintenance
- Browser handles API updates
- No custom polling/frame conversion
- Built-in permission management

### 4. Performance
- Browser-optimized MediaStream
- Hardware acceleration
- No IPC overhead for preview

## Implementation Details

### useWebcamRecording Hook
```typescript
// Simple getUserMedia call
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    deviceId: cameraId,
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
});

// Direct to video element
videoElement.srcObject = stream;
```

### Camera Enumeration
```typescript
const devices = await navigator.mediaDevices.enumerateDevices();
const cameras = devices.filter(d => d.kind === 'videoinput');
```

## Previous Approach (Abandoned)

### What We Tried
- Rust backend with AVFoundation camera capture
- Polling-based frame transfer via IPC
- Canvas-based stream conversion

### Why We Abandoned It
- Complex Objective-C bindings
- IPC overhead for every frame
- Unnecessary complexity
- Cross-platform limitations

## Current Status

### ✅ Complete
- Camera preview with getUserMedia
- Camera enumeration
- Tauri webview configuration
- Permission handling

### 🟡 In Progress
- MediaRecorder integration
- Screen recording (AVFoundation)
- Picture-in-Picture composition

### ❌ Not Started
- Recording to media library
- Thumbnail generation for recordings
- Recording duration limits

## Files Modified

### Frontend
- `src/hooks/useWebcamRecording.ts` - Web APIs implementation
- `src/stores/recordingStore.ts` - Camera enumeration
- `src/components/Recording/CameraPreview.tsx` - Live preview

### Configuration
- `src-tauri/tauri.conf.json` - Webview API access
- `src-tauri/entitlements.plist` - Camera permissions

### Documentation
- `tasks/prd-recording-features.md` - Updated architecture
- `memory-bank/systemPatterns.md` - Recording patterns
- `memory-bank/techContext.md` - Web APIs documentation
- `memory-bank/progress.md` - Recording status

## Testing

### Camera Preview
```bash
npm run tauri dev
# Open recording dialog
# Select camera from dropdown
# Preview should show live camera feed
```

### Expected Behavior
1. Camera permission prompt (first time)
2. Live camera feed appears
3. Smooth video stream (no lag)
4. Proper cleanup on stop

## Next Steps

1. Implement MediaRecorder for actual recording
2. Save recordings to media library
3. Integrate with timeline editor
4. Test Picture-in-Picture combination

---

**Conclusion**: Using Web APIs for camera access was the right decision. It's simpler, more maintainable, and works great!

