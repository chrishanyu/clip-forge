import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecordingStore } from './recordingStore';
import { 
  createRecordingSession, 
  createScreenRecordingSettings, 
  createWebcamRecordingSettings, 
  createPiPRecordingSettings,
  createRecordingProgress,
  createAppError,
  type ScreenInfo,
  type CameraInfo,
  type RecordingSettings
} from '@/types';

// Mock Zustand devtools
vi.mock('zustand/middleware', () => ({
  devtools: (fn: any) => fn,
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock environment
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

describe('RecordingStore', () => {
  // Sample test data
  const sampleScreen: ScreenInfo = {
    id: 'screen-1',
    name: 'Built-in Retina Display',
    width: 2560,
    height: 1600,
    x: 0,
    y: 0,
    isPrimary: true,
    scaleFactor: 2,
  };

  const sampleCamera: CameraInfo = {
    id: 'camera-1',
    name: 'FaceTime HD Camera',
    isDefault: true,
    isAvailable: true,
    capabilities: {
      maxWidth: 1920,
      maxHeight: 1080,
      supportedFormats: ['mp4', 'mov'],
      hasAudio: true,
    },
  };

  const sampleScreenSettings: RecordingSettings = createScreenRecordingSettings('screen-1', {
    quality: 'medium',
    frameRate: 30,
    audioEnabled: false,
  });

  const sampleWebcamSettings: RecordingSettings = createWebcamRecordingSettings('camera-1', {
    quality: 'high',
    frameRate: 30,
    audioEnabled: true,
    showPreview: true,
  });

  const samplePiPSettings: RecordingSettings = createPiPRecordingSettings('screen-1', 'camera-1', {
    quality: 'medium',
    frameRate: 30,
    audioEnabled: true,
    pipPosition: 'bottom-right',
    pipSize: 'medium',
  });

  beforeEach(() => {
    // Reset store state before each test
    useRecordingStore.getState().cleanup();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have null current session initially', () => {
      const state = useRecordingStore.getState();
      expect(state.currentSession).toBeNull();
    });

    it('should have empty devices initially', () => {
      const state = useRecordingStore.getState();
      expect(state.devices.screens).toEqual([]);
      expect(state.devices.cameras).toEqual([]);
      expect(state.devices.isLoading).toBe(false);
      expect(state.devices.error).toBeNull();
    });

    it('should have null settings initially', () => {
      const state = useRecordingStore.getState();
      expect(state.settings).toBeNull();
    });

    it('should have null progress initially', () => {
      const state = useRecordingStore.getState();
      expect(state.progress).toBeNull();
    });

    it('should have closed dialog initially', () => {
      const state = useRecordingStore.getState();
      expect(state.isDialogOpen).toBe(false);
    });

    it('should have hidden recording indicator initially', () => {
      const state = useRecordingStore.getState();
      expect(state.isRecordingIndicatorVisible).toBe(false);
    });

    it('should have null error initially', () => {
      const state = useRecordingStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('Device Management', () => {
    it('should load devices successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce([sampleScreen]);
      (invoke as any).mockResolvedValueOnce([sampleCamera]);

      await useRecordingStore.getState().loadDevices();

      const state = useRecordingStore.getState();
      expect(state.devices.screens).toEqual([sampleScreen]);
      expect(state.devices.cameras).toEqual([sampleCamera]);
      expect(state.devices.isLoading).toBe(false);
      expect(state.devices.error).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should handle device loading errors', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockRejectedValueOnce(new Error('Device access denied'));

      await useRecordingStore.getState().loadDevices();

      const state = useRecordingStore.getState();
      expect(state.devices.screens).toEqual([]);
      expect(state.devices.cameras).toEqual([]);
      expect(state.devices.isLoading).toBe(false);
      expect(state.devices.error).toBeTruthy();
      expect(state.devices.error?.code).toBe('DEVICE_LOAD_FAILED');
      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('DEVICE_LOAD_FAILED');
    });

    it('should refresh devices', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce([sampleScreen]);
      (invoke as any).mockResolvedValueOnce([sampleCamera]);

      await useRecordingStore.getState().refreshDevices();

      const state = useRecordingStore.getState();
      expect(state.devices.screens).toEqual([sampleScreen]);
      expect(state.devices.cameras).toEqual([sampleCamera]);
    });

    it('should select screen', () => {
      useRecordingStore.getState().updateSettings(sampleScreenSettings);
      useRecordingStore.getState().selectScreen('screen-2');

      const state = useRecordingStore.getState();
      expect(state.settings).toMatchObject({
        type: 'screen',
        screenId: 'screen-2',
      });
    });

    it('should select camera', () => {
      useRecordingStore.getState().updateSettings(sampleWebcamSettings);
      useRecordingStore.getState().selectCamera('camera-2');

      const state = useRecordingStore.getState();
      expect(state.settings).toMatchObject({
        type: 'webcam',
        cameraId: 'camera-2',
      });
    });
  });

  describe('Recording Session Management', () => {
    it('should start screen recording successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording.mp4' });

      await useRecordingStore.getState().startRecording(sampleScreenSettings);

      const state = useRecordingStore.getState();
      expect(state.currentSession).toBeTruthy();
      expect(state.currentSession?.type).toBe('screen');
      expect(state.currentSession?.status).toBe('recording');
      expect(state.currentSession?.filePath).toBe('/path/to/recording.mp4');
      expect(state.progress).toBeTruthy();
      expect(state.progress?.isRecording).toBe(true);
      expect(state.isRecordingIndicatorVisible).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should start webcam recording successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/webcam.mp4' });

      await useRecordingStore.getState().startRecording(sampleWebcamSettings);

      const state = useRecordingStore.getState();
      expect(state.currentSession).toBeTruthy();
      expect(state.currentSession?.type).toBe('webcam');
      expect(state.currentSession?.status).toBe('recording');
      expect(state.currentSession?.filePath).toBe('/path/to/webcam.mp4');
    });

    it('should start PiP recording successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/pip.mp4' });

      await useRecordingStore.getState().startRecording(samplePiPSettings);

      const state = useRecordingStore.getState();
      expect(state.currentSession).toBeTruthy();
      expect(state.currentSession?.type).toBe('pip');
      expect(state.currentSession?.status).toBe('recording');
    });

    it('should handle recording start errors', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockRejectedValueOnce(new Error('Permission denied'));

      await useRecordingStore.getState().startRecording(sampleScreenSettings);

      const state = useRecordingStore.getState();
      expect(state.currentSession?.status).toBe('error');
      expect(state.currentSession?.error).toBeTruthy();
      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('RECORDING_START_FAILED');
    });

    it('should validate recording settings before starting', async () => {
      const invalidSettings = createScreenRecordingSettings('', {
        frameRate: 0, // Invalid frame rate
      });

      await useRecordingStore.getState().startRecording(invalidSettings);

      const state = useRecordingStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('INVALID_FRAME_RATE');
    });

    it('should not start recording if one is already active', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording1.mp4' });

      // Start first recording
      await useRecordingStore.getState().startRecording(sampleScreenSettings);
      
      // Try to start second recording
      await useRecordingStore.getState().startRecording(sampleWebcamSettings);

      const state = useRecordingStore.getState();
      expect(state.currentSession?.type).toBe('screen'); // Should still be first recording
      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('RECORDING_IN_PROGRESS');
    });

    it('should stop recording successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording.mp4' });
      (invoke as any).mockResolvedValueOnce({ success: true });

      // Start recording first
      await useRecordingStore.getState().startRecording(sampleScreenSettings);
      
      // Stop recording
      await useRecordingStore.getState().stopRecording();

      const state = useRecordingStore.getState();
      expect(state.currentSession?.status).toBe('idle');
      expect(state.progress).toBeNull();
      expect(state.isRecordingIndicatorVisible).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle recording stop errors', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording.mp4' });
      (invoke as any).mockRejectedValueOnce(new Error('Stop failed'));

      // Start recording first
      await useRecordingStore.getState().startRecording(sampleScreenSettings);
      
      // Try to stop recording
      await useRecordingStore.getState().stopRecording();

      const state = useRecordingStore.getState();
      expect(state.currentSession?.status).toBe('error');
      expect(state.currentSession?.error).toBeTruthy();
      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('RECORDING_STOP_FAILED');
    });

    it('should not stop recording if none is active', async () => {
      await useRecordingStore.getState().stopRecording();

      const state = useRecordingStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('NO_ACTIVE_RECORDING');
    });

    it('should pause recording successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording.mp4' });
      (invoke as any).mockResolvedValueOnce({ success: true });

      // Start recording first
      await useRecordingStore.getState().startRecording(sampleScreenSettings);
      
      // Pause recording
      await useRecordingStore.getState().pauseRecording();

      const state = useRecordingStore.getState();
      expect(state.currentSession?.status).toBe('idle');
      expect(state.progress).toBeNull();
      expect(state.isRecordingIndicatorVisible).toBe(false);
    });

    it('should resume recording successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording.mp4' });
      (invoke as any).mockResolvedValueOnce({ success: true });
      (invoke as any).mockResolvedValueOnce({ success: true });

      // Start recording first
      await useRecordingStore.getState().startRecording(sampleScreenSettings);
      
      // Pause recording
      await useRecordingStore.getState().pauseRecording();
      
      // Resume recording
      await useRecordingStore.getState().resumeRecording();

      const state = useRecordingStore.getState();
      expect(state.currentSession?.status).toBe('recording');
      expect(state.progress?.isRecording).toBe(true);
      expect(state.isRecordingIndicatorVisible).toBe(true);
    });
  });

  describe('Settings Management', () => {
    it('should update settings', () => {
      useRecordingStore.getState().updateSettings(sampleScreenSettings);

      const state = useRecordingStore.getState();
      expect(state.settings).toEqual(sampleScreenSettings);
    });

    it('should update partial settings', () => {
      useRecordingStore.getState().updateSettings(sampleScreenSettings);
      useRecordingStore.getState().updateSettings({ quality: 'high' });

      const state = useRecordingStore.getState();
      expect(state.settings).toMatchObject({
        ...sampleScreenSettings,
        quality: 'high',
      });
    });

    it('should create default settings when updating from null', () => {
      useRecordingStore.getState().updateSettings({ type: 'webcam', cameraId: 'camera-1' });

      const state = useRecordingStore.getState();
      expect(state.settings).toMatchObject({
        type: 'webcam',
        cameraId: 'camera-1',
        quality: 'medium',
        frameRate: 30,
        audioEnabled: true,
        showPreview: true,
      });
    });

    it('should reset settings', () => {
      useRecordingStore.getState().updateSettings(sampleScreenSettings);
      useRecordingStore.getState().resetSettings();

      const state = useRecordingStore.getState();
      expect(state.settings).toBeNull();
    });
  });

  describe('UI State Management', () => {
    it('should open recording dialog', () => {
      useRecordingStore.getState().openRecordingDialog();

      const state = useRecordingStore.getState();
      expect(state.isDialogOpen).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should close recording dialog', () => {
      useRecordingStore.getState().openRecordingDialog();
      useRecordingStore.getState().closeRecordingDialog();

      const state = useRecordingStore.getState();
      expect(state.isDialogOpen).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should show recording indicator', () => {
      useRecordingStore.getState().showRecordingIndicator();

      const state = useRecordingStore.getState();
      expect(state.isRecordingIndicatorVisible).toBe(true);
    });

    it('should hide recording indicator', () => {
      useRecordingStore.getState().showRecordingIndicator();
      useRecordingStore.getState().hideRecordingIndicator();

      const state = useRecordingStore.getState();
      expect(state.isRecordingIndicatorVisible).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    it('should update progress', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      (invoke as any).mockResolvedValueOnce({ filePath: '/path/to/recording.mp4' });

      // Start recording to create session
      await useRecordingStore.getState().startRecording(sampleScreenSettings);
      
      // Update progress
      useRecordingStore.getState().updateProgress({
        duration: 30,
        fileSize: 1024000,
        frameCount: 900,
      });

      const state = useRecordingStore.getState();
      expect(state.progress).toMatchObject({
        duration: 30,
        fileSize: 1024000,
        frameCount: 900,
      });
    });

    it('should create progress if none exists', () => {
      const session = createRecordingSession('screen', sampleScreenSettings);
      useRecordingStore.setState({ currentSession: session });

      useRecordingStore.getState().updateProgress({
        duration: 15,
        fileSize: 512000,
      });

      const state = useRecordingStore.getState();
      expect(state.progress).toMatchObject({
        sessionId: session.id,
        duration: 15,
        fileSize: 512000,
        frameCount: 0,
        isRecording: false,
      });
    });
  });

  describe('Error Handling', () => {
    it('should set error', () => {
      const error = createAppError('TEST_ERROR', 'Test error message');
      useRecordingStore.getState().setError(error);

      const state = useRecordingStore.getState();
      expect(state.error).toEqual(error);
    });

    it('should clear error', () => {
      const error = createAppError('TEST_ERROR', 'Test error message');
      useRecordingStore.getState().setError(error);
      useRecordingStore.getState().clearError();

      const state = useRecordingStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should reset all state', () => {
      // Set some state
      useRecordingStore.getState().updateSettings(sampleScreenSettings);
      useRecordingStore.getState().openRecordingDialog();
      useRecordingStore.getState().showRecordingIndicator();
      useRecordingStore.getState().setError(createAppError('TEST', 'Test'));

      // Cleanup
      useRecordingStore.getState().cleanup();

      const state = useRecordingStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.devices.screens).toEqual([]);
      expect(state.devices.cameras).toEqual([]);
      expect(state.settings).toBeNull();
      expect(state.progress).toBeNull();
      expect(state.isDialogOpen).toBe(false);
      expect(state.isRecordingIndicatorVisible).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('should provide recording session selector', () => {
      const session = createRecordingSession('screen', sampleScreenSettings);
      useRecordingStore.setState({ currentSession: session });

      const selectedSession = useRecordingStore.getState().currentSession;
      expect(selectedSession).toEqual(session);
    });

    it('should provide devices selector', () => {
      const devices = {
        screens: [sampleScreen],
        cameras: [sampleCamera],
        isLoading: false,
        error: null,
      };
      useRecordingStore.setState({ devices });

      const selectedDevices = useRecordingStore.getState().devices;
      expect(selectedDevices).toEqual(devices);
    });

    it('should provide settings selector', () => {
      useRecordingStore.setState({ settings: sampleScreenSettings });

      const selectedSettings = useRecordingStore.getState().settings;
      expect(selectedSettings).toEqual(sampleScreenSettings);
    });

    it('should provide progress selector', () => {
      const progress = createRecordingProgress('session-1', {
        duration: 30,
        fileSize: 1024000,
        isRecording: true,
      });
      useRecordingStore.setState({ progress });

      const selectedProgress = useRecordingStore.getState().progress;
      expect(selectedProgress).toEqual(progress);
    });

    it('should provide error selector', () => {
      const error = createAppError('TEST_ERROR', 'Test error message');
      useRecordingStore.setState({ error });

      const selectedError = useRecordingStore.getState().error;
      expect(selectedError).toEqual(error);
    });
  });
});
