/**
 * Recording Features Type Definitions
 * 
 * This file contains all TypeScript interfaces and types related to recording
 * functionality including screen recording, webcam recording, and Picture-in-Picture.
 */

import { AppError } from './error';

// ============================================================================
// Core Recording Types
// ============================================================================

/**
 * Recording type enumeration
 */
export type RecordingType = 'screen' | 'webcam' | 'pip';

/**
 * Recording status enumeration
 */
export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'stopping' | 'error';

/**
 * Device type enumeration
 */
export type DeviceType = 'screen' | 'camera';

// ============================================================================
// Device Information
// ============================================================================

/**
 * Screen device information
 */
export interface ScreenInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
  scaleFactor: number;
}

/**
 * Camera device information
 */
export interface CameraInfo {
  id: string;
  name: string;
  isDefault: boolean;
  isAvailable: boolean;
  capabilities: CameraCapabilities;
}

/**
 * Camera capabilities
 */
export interface CameraCapabilities {
  maxWidth: number;
  maxHeight: number;
  supportedFormats: string[];
  hasAudio: boolean;
}

// ============================================================================
// Recording Settings
// ============================================================================

/**
 * Base recording settings
 */
export interface BaseRecordingSettings {
  quality: RecordingQuality;
  frameRate: number;
  audioEnabled: boolean;
  audioDeviceId?: string;
}

/**
 * Screen recording settings
 */
export interface ScreenRecordingSettings extends BaseRecordingSettings {
  type: 'screen';
  screenId: string;
  captureArea?: CaptureArea;
}

/**
 * Webcam recording settings
 */
export interface WebcamRecordingSettings extends BaseRecordingSettings {
  type: 'webcam';
  cameraId: string;
  showPreview: boolean;
}

/**
 * Picture-in-Picture recording settings
 */
export interface PiPRecordingSettings extends BaseRecordingSettings {
  type: 'pip';
  screenId: string;
  cameraId: string;
  pipPosition: PiPPosition;
  pipSize: PiPSize;
  captureArea?: CaptureArea;
}

/**
 * Union type for all recording settings
 */
export type RecordingSettings = 
  | ScreenRecordingSettings 
  | WebcamRecordingSettings 
  | PiPRecordingSettings;

/**
 * Recording quality presets
 */
export type RecordingQuality = 'low' | 'medium' | 'high';

/**
 * Capture area for screen recording
 */
export interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Picture-in-Picture position
 */
export type PiPPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Picture-in-Picture size
 */
export type PiPSize = 'small' | 'medium' | 'large';

// ============================================================================
// Recording Session
// ============================================================================

/**
 * Active recording session
 */
export interface RecordingSession {
  id: string;
  type: RecordingType;
  settings: RecordingSettings;
  status: RecordingStatus;
  startTime: string;
  duration: number; // in seconds
  filePath?: string;
  error?: AppError;
}

/**
 * Recording progress information
 */
export interface RecordingProgress {
  sessionId: string;
  duration: number;
  fileSize: number; // in bytes
  frameCount: number;
  isRecording: boolean;
}

// ============================================================================
// Recording Store State
// ============================================================================

/**
 * Available devices for recording
 */
export interface AvailableDevices {
  screens: ScreenInfo[];
  cameras: CameraInfo[];
  isLoading: boolean;
  error?: AppError;
}

/**
 * Recording store state interface
 */
export interface RecordingState {
  // Current recording session
  currentSession: RecordingSession | null;
  
  // Available devices
  devices: AvailableDevices;
  
  // Recording settings
  settings: RecordingSettings | null;
  
  // Recording progress
  progress: RecordingProgress | null;
  
  // UI state
  isDialogOpen: boolean;
  isRecordingIndicatorVisible: boolean;
  
  // Error state
  error: AppError | null;
}

// ============================================================================
// Recording Actions
// ============================================================================

/**
 * Recording store actions interface
 */
export interface RecordingActions {
  // Device management
  loadDevices: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectScreen: (screenId: string) => void;
  selectCamera: (cameraId: string) => void;
  
  // Recording session management
  startRecording: (settings: RecordingSettings) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  
  // Settings management
  updateSettings: (settings: Partial<RecordingSettings>) => void;
  resetSettings: () => void;
  
  // UI state management
  openRecordingDialog: () => void;
  closeRecordingDialog: () => void;
  showRecordingIndicator: () => void;
  hideRecordingIndicator: () => void;
  
  // Progress tracking
  updateProgress: (progress: Partial<RecordingProgress>) => void;
  
  // Error handling
  setError: (error: AppError | null) => void;
  clearError: () => void;
  
  // Cleanup
  cleanup: () => void;
}

// ============================================================================
// Recording Events
// ============================================================================

/**
 * Recording events that can be emitted
 */
export interface RecordingEvent {
  type: 'recording-started' | 'recording-stopped' | 'recording-error' | 'progress-update';
  sessionId: string;
  data?: any;
  timestamp: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new recording session
 */
export function createRecordingSession(
  type: RecordingType,
  settings: RecordingSettings
): RecordingSession {
  return {
    id: generateRecordingId(),
    type,
    settings,
    status: 'idle',
    startTime: new Date().toISOString(),
    duration: 0,
  };
}

/**
 * Create screen recording settings
 */
export function createScreenRecordingSettings(
  screenId: string,
  options: Partial<Omit<ScreenRecordingSettings, 'type' | 'screenId'>> = {}
): ScreenRecordingSettings {
  return {
    type: 'screen',
    screenId,
    quality: 'medium',
    frameRate: 30,
    audioEnabled: false,
    ...options,
  };
}

/**
 * Create webcam recording settings
 */
export function createWebcamRecordingSettings(
  cameraId: string,
  options: Partial<Omit<WebcamRecordingSettings, 'type' | 'cameraId'>> = {}
): WebcamRecordingSettings {
  return {
    type: 'webcam',
    cameraId,
    quality: 'medium',
    frameRate: 30,
    audioEnabled: true,
    showPreview: true,
    ...options,
  };
}

/**
 * Create Picture-in-Picture recording settings
 */
export function createPiPRecordingSettings(
  screenId: string,
  cameraId: string,
  options: Partial<Omit<PiPRecordingSettings, 'type' | 'screenId' | 'cameraId'>> = {}
): PiPRecordingSettings {
  return {
    type: 'pip',
    screenId,
    cameraId,
    quality: 'medium',
    frameRate: 30,
    audioEnabled: true,
    pipPosition: 'bottom-right',
    pipSize: 'medium',
    ...options,
  };
}

/**
 * Create recording progress
 */
export function createRecordingProgress(
  sessionId: string,
  options: Partial<Omit<RecordingProgress, 'sessionId'>> = {}
): RecordingProgress {
  return {
    sessionId,
    duration: 0,
    fileSize: 0,
    frameCount: 0,
    isRecording: false,
    ...options,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique recording ID
 */
function generateRecordingId(): string {
  return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if recording settings are valid
 */
export function validateRecordingSettings(settings: RecordingSettings): AppError | null {
  if (!settings) {
    return {
      code: 'INVALID_SETTINGS',
      message: 'Recording settings are required',
      timestamp: new Date().toISOString(),
    };
  }

  if (settings.frameRate <= 0 || settings.frameRate > 60) {
    return {
      code: 'INVALID_FRAME_RATE',
      message: 'Frame rate must be between 1 and 60 fps',
      timestamp: new Date().toISOString(),
    };
  }

  if (settings.type === 'screen' && !settings.screenId) {
    return {
      code: 'MISSING_SCREEN_ID',
      message: 'Screen ID is required for screen recording',
      timestamp: new Date().toISOString(),
    };
  }

  if (settings.type === 'webcam' && !settings.cameraId) {
    return {
      code: 'MISSING_CAMERA_ID',
      message: 'Camera ID is required for webcam recording',
      timestamp: new Date().toISOString(),
    };
  }

  if (settings.type === 'pip') {
    if (!settings.screenId) {
      return {
        code: 'MISSING_SCREEN_ID',
        message: 'Screen ID is required for PiP recording',
        timestamp: new Date().toISOString(),
      };
    }
    if (!settings.cameraId) {
      return {
        code: 'MISSING_CAMERA_ID',
        message: 'Camera ID is required for PiP recording',
        timestamp: new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Get default recording settings based on type
 */
export function getDefaultRecordingSettings(type: RecordingType): RecordingSettings {
  switch (type) {
    case 'screen':
      return createScreenRecordingSettings('');
    case 'webcam':
      return createWebcamRecordingSettings('');
    case 'pip':
      return createPiPRecordingSettings('', '');
    default:
      throw new Error(`Unknown recording type: ${type}`);
  }
}

/**
 * Format recording duration for display
 */
export function formatRecordingDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if recording is active
 */
export function isRecordingActive(session: RecordingSession | null): boolean {
  return session?.status === 'recording';
}

/**
 * Check if recording can be started
 */
export function canStartRecording(session: RecordingSession | null): boolean {
  return !session || session.status === 'idle' || session.status === 'error';
}

/**
 * Check if recording can be stopped
 */
export function canStopRecording(session: RecordingSession | null): boolean {
  return session?.status === 'recording' || session?.status === 'preparing';
}
