import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import {
  RecordingState,
  RecordingActions,
  RecordingSession,
  RecordingSettings,
  RecordingProgress,
  AvailableDevices,
  ScreenInfo,
  CameraInfo,
  AppError,
  createAppError,
  createRecordingSession,
  createRecordingProgress,
  validateRecordingSettings,
  getDefaultRecordingSettings,
  isRecordingActive,
  canStartRecording,
  canStopRecording,
  RecordingType,
  RecordingStatus
} from '@/types';

// ============================================================================
// RECORDING STORE INTERFACE
// ============================================================================

interface RecordingStore extends RecordingState, RecordingActions {}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createInitialDevices = (): AvailableDevices => ({
  screens: [],
  cameras: [],
  isLoading: false,
  error: null,
});

const createInitialProgress = (): RecordingProgress | null => null;

const createInitialSession = (): RecordingSession | null => null;

// ============================================================================
// RECORDING STORE IMPLEMENTATION
// ============================================================================

export const useRecordingStore = create<RecordingStore>()(
  devtools(
    (set, get) => ({
      // ========================================================================
      // INITIAL STATE
      // ========================================================================
      
      // Current recording session
      currentSession: createInitialSession(),
      
      // Available devices
      devices: createInitialDevices(),
      
      // Recording settings
      settings: null,
      
      // Recording progress
      progress: createInitialProgress(),
      
      // UI state
      isDialogOpen: false,
      isRecordingIndicatorVisible: false,
      
      // Error state
      error: null,

      // ========================================================================
      // DEVICE MANAGEMENT ACTIONS
      // ========================================================================

      loadDevices: async () => {
        set((state) => ({
          devices: { ...state.devices, isLoading: true, error: null },
          error: null,
        }));

        try {
          // Load screens
          const screens: ScreenInfo[] = await invoke('get_available_screens');
          
          // Load cameras
          const cameras: CameraInfo[] = await invoke('get_available_cameras');

          set((state) => ({
            devices: {
              screens,
              cameras,
              isLoading: false,
              error: null,
            },
            error: null,
          }));
        } catch (error) {
          const appError = createAppError(
            'DEVICE_LOAD_FAILED',
            'Failed to load recording devices',
            error instanceof Error ? error.message : 'Unknown error'
          );

          set((state) => ({
            devices: { ...state.devices, isLoading: false, error: appError },
            error: appError,
          }));
        }
      },

      refreshDevices: async () => {
        await get().loadDevices();
      },

      selectScreen: (screenId: string) => {
        set((state) => {
          if (!state.settings) return state;

          const updatedSettings = { ...state.settings };
          
          if ('screenId' in updatedSettings) {
            updatedSettings.screenId = screenId;
          }

          return {
            settings: updatedSettings as RecordingSettings,
          };
        });
      },

      selectCamera: (cameraId: string) => {
        set((state) => {
          if (!state.settings) return state;

          const updatedSettings = { ...state.settings };
          
          if ('cameraId' in updatedSettings) {
            updatedSettings.cameraId = cameraId;
          }

          return {
            settings: updatedSettings as RecordingSettings,
          };
        });
      },

      // ========================================================================
      // RECORDING SESSION MANAGEMENT ACTIONS
      // ========================================================================

      startRecording: async (settings: RecordingSettings) => {
        // Validate settings
        const validationError = validateRecordingSettings(settings);
        if (validationError) {
          set({ error: validationError });
          return;
        }

        // Check if recording can be started
        const currentSession = get().currentSession;
        if (!canStartRecording(currentSession)) {
          const error = createAppError(
            'RECORDING_IN_PROGRESS',
            'Cannot start recording while another recording is active',
            `Current session status: ${currentSession?.status}`
          );
          set({ error });
          return;
        }

        // Create new session
        const session = createRecordingSession(settings.type, settings);
        
        set((state) => ({
          currentSession: { ...session, status: 'preparing' },
          settings,
          error: null,
        }));

        try {
          // Start recording via Tauri command
          const result = await invoke('start_recording', { settings });
          
          if (result && typeof result === 'object' && 'filePath' in result) {
            set((state) => ({
              currentSession: state.currentSession ? {
                ...state.currentSession,
                status: 'recording',
                filePath: result.filePath as string,
              } : null,
              progress: createRecordingProgress(session.id, { isRecording: true }),
              isRecordingIndicatorVisible: true,
              error: null,
            }));
          } else {
            throw new Error('Invalid response from recording command');
          }
        } catch (error) {
          const appError = createAppError(
            'RECORDING_START_FAILED',
            'Failed to start recording',
            error instanceof Error ? error.message : 'Unknown error'
          );

          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              status: 'error',
              error: appError,
            } : null,
            error: appError,
          }));
        }
      },

      stopRecording: async () => {
        const currentSession = get().currentSession;
        if (!currentSession || !canStopRecording(currentSession)) {
          const error = createAppError(
            'NO_ACTIVE_RECORDING',
            'No active recording to stop',
            'Current session status: ' + (currentSession?.status || 'null')
          );
          set({ error });
          return;
        }

        set((state) => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            status: 'stopping',
          } : null,
        }));

        try {
          // Stop recording via Tauri command
          await invoke('stop_recording', { sessionId: currentSession.id });
          
          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              status: 'idle',
            } : null,
            progress: null,
            isRecordingIndicatorVisible: false,
            error: null,
          }));
        } catch (error) {
          const appError = createAppError(
            'RECORDING_STOP_FAILED',
            'Failed to stop recording',
            error instanceof Error ? error.message : 'Unknown error'
          );

          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              status: 'error',
              error: appError,
            } : null,
            error: appError,
          }));
        }
      },

      pauseRecording: async () => {
        const currentSession = get().currentSession;
        if (!currentSession || currentSession.status !== 'recording') {
          const error = createAppError(
            'NO_ACTIVE_RECORDING',
            'No active recording to pause',
            'Current session status: ' + (currentSession?.status || 'null')
          );
          set({ error });
          return;
        }

        try {
          // Pause recording via Tauri command
          await invoke('pause_recording', { sessionId: currentSession.id });
          
          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              status: 'idle', // For MVP, treat pause as stop
            } : null,
            progress: null,
            isRecordingIndicatorVisible: false,
            error: null,
          }));
        } catch (error) {
          const appError = createAppError(
            'RECORDING_PAUSE_FAILED',
            'Failed to pause recording',
            error instanceof Error ? error.message : 'Unknown error'
          );

          set({ error: appError });
        }
      },

      resumeRecording: async () => {
        const currentSession = get().currentSession;
        if (!currentSession || currentSession.status !== 'idle') {
          const error = createAppError(
            'NO_PAUSED_RECORDING',
            'No paused recording to resume',
            'Current session status: ' + (currentSession?.status || 'null')
          );
          set({ error });
          return;
        }

        try {
          // Resume recording via Tauri command
          await invoke('resume_recording', { sessionId: currentSession.id });
          
          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              status: 'recording',
            } : null,
            progress: state.progress ? { ...state.progress, isRecording: true } : null,
            isRecordingIndicatorVisible: true,
            error: null,
          }));
        } catch (error) {
          const appError = createAppError(
            'RECORDING_RESUME_FAILED',
            'Failed to resume recording',
            error instanceof Error ? error.message : 'Unknown error'
          );

          set({ error: appError });
        }
      },

      // ========================================================================
      // SETTINGS MANAGEMENT ACTIONS
      // ========================================================================

      updateSettings: (settingsUpdate: Partial<RecordingSettings>) => {
        set((state) => {
          if (!state.settings) {
            // If no settings exist, create default based on type
            const type = settingsUpdate.type || 'screen';
            const newSettings = getDefaultRecordingSettings(type);
            return {
              settings: { ...newSettings, ...settingsUpdate } as RecordingSettings,
            };
          }

          return {
            settings: { ...state.settings, ...settingsUpdate } as RecordingSettings,
          };
        });
      },

      resetSettings: () => {
        set({ settings: null });
      },

      // ========================================================================
      // UI STATE MANAGEMENT ACTIONS
      // ========================================================================

      openRecordingDialog: () => {
        set({ isDialogOpen: true, error: null });
      },

      closeRecordingDialog: () => {
        set({ isDialogOpen: false, error: null });
      },

      showRecordingIndicator: () => {
        set({ isRecordingIndicatorVisible: true });
      },

      hideRecordingIndicator: () => {
        set({ isRecordingIndicatorVisible: false });
      },

      // ========================================================================
      // PROGRESS TRACKING ACTIONS
      // ========================================================================

      updateProgress: (progressUpdate: Partial<RecordingProgress>) => {
        set((state) => {
          if (!state.progress) {
            const currentSession = state.currentSession;
            if (!currentSession) return state;

            return {
              progress: createRecordingProgress(currentSession.id, progressUpdate),
            };
          }

          return {
            progress: { ...state.progress, ...progressUpdate },
          };
        });
      },

      // ========================================================================
      // ERROR HANDLING ACTIONS
      // ========================================================================

      setError: (error: AppError | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      // ========================================================================
      // CLEANUP ACTIONS
      // ========================================================================

      cleanup: () => {
        set({
          currentSession: createInitialSession(),
          devices: createInitialDevices(),
          settings: null,
          progress: createInitialProgress(),
          isDialogOpen: false,
          isRecordingIndicatorVisible: false,
          error: null,
        });
      },
    }),
    {
      name: 'recording-store',
      partialize: (state) => ({
        // Only persist essential state, not temporary UI state
        settings: state.settings,
        devices: state.devices,
      }),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const useRecordingSession = () => useRecordingStore((state) => state.currentSession);
export const useRecordingDevices = () => useRecordingStore((state) => state.devices);
export const useRecordingSettings = () => useRecordingStore((state) => state.settings);
export const useRecordingProgress = () => useRecordingStore((state) => state.progress);
export const useRecordingError = () => useRecordingStore((state) => state.error);
export const useIsRecordingActive = () => useRecordingStore((state) => isRecordingActive(state.currentSession));
export const useCanStartRecording = () => useRecordingStore((state) => canStartRecording(state.currentSession));
export const useCanStopRecording = () => useRecordingStore((state) => canStopRecording(state.currentSession));
export const useIsDialogOpen = () => useRecordingStore((state) => state.isDialogOpen);
export const useIsRecordingIndicatorVisible = () => useRecordingStore((state) => state.isRecordingIndicatorVisible);

// ============================================================================
// COMPUTED SELECTORS
// ============================================================================

export const useRecordingDuration = () => 
  useRecordingStore((state) => state.progress?.duration || 0);

export const useRecordingFileSize = () => 
  useRecordingStore((state) => state.progress?.fileSize || 0);

export const useAvailableScreens = () => 
  useRecordingStore((state) => state.devices.screens);

export const useAvailableCameras = () => 
  useRecordingStore((state) => state.devices.cameras);

export const useIsDevicesLoading = () => 
  useRecordingStore((state) => state.devices.isLoading);

export const useSelectedScreen = () => 
  useRecordingStore((state) => {
    if (!state.settings || !('screenId' in state.settings)) return null;
    return state.devices.screens.find(screen => screen.id === state.settings!.screenId) || null;
  });

export const useSelectedCamera = () => 
  useRecordingStore((state) => {
    if (!state.settings || !('cameraId' in state.settings)) return null;
    return state.devices.cameras.find(camera => camera.id === state.settings!.cameraId) || null;
  });
