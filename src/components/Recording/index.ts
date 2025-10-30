/**
 * Recording Components Barrel Export
 * 
 * Centralized export file for all recording-related components.
 * This provides a clean import interface for the recording feature.
 */

// ============================================================================
// Main Components
// ============================================================================

export { RecordingButton } from './RecordingButton';
export type { RecordingButtonProps } from './RecordingButton';

export { RecordingDialog } from './RecordingDialog';
export type { RecordingDialogProps } from './RecordingDialog';

export { RecordingIndicator } from './RecordingIndicator';
export type { RecordingIndicatorProps } from './RecordingIndicator';

// ============================================================================
// Device Management Components
// ============================================================================

export { DeviceSelector } from './DeviceSelector';
export type { DeviceSelectorProps } from './DeviceSelector';

// ============================================================================
// Camera Components
// ============================================================================

export { CameraPreview } from './CameraPreview';
export type { CameraPreviewProps } from './CameraPreview';

export { WebcamRecorder } from './WebcamRecorder';
export type { WebcamRecorderProps } from './WebcamRecorder';

// ============================================================================
// Settings Components
// ============================================================================

export { PiPSettings } from './PiPSettings';
export type { PiPSettingsProps } from './PiPSettings';

// ============================================================================
// Recording Components
// ============================================================================

export { PiPRecorder } from './PiPRecorder';
export type { PiPRecorderProps } from './PiPRecorder';

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Re-export types that are commonly used with these components
export type { RecordingType, PiPPosition, PiPSize } from '@/types';
