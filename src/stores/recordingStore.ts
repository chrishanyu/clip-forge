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
  RecordingStatus,
  WebcamRecordingSettings
} from '@/types';
import { useMediaStore } from './mediaStore';
import { WebcamRecorder } from '@/utils/recordingUtils';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_RECORDING_DURATION = 3600; // 1 hour in seconds

// ============================================================================
// WEBCAM RECORDING STATE (App-level, not component-level)
// ============================================================================

interface WebcamRecordingState {
  webcamStream: MediaStream | null;
  webcamRecorder: WebcamRecorder | null;
  webcamRecordingInterval: NodeJS.Timeout | null;
}

// ============================================================================
// RECORDING STORE INTERFACE
// ============================================================================

interface RecordingStore extends RecordingState, RecordingActions, WebcamRecordingState {
  // Webcam recording methods
  startWebcamRecording: (settings: WebcamRecordingSettings) => Promise<void>;
  stopWebcamRecording: () => Promise<void>;
}

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

      // Webcam recording state (app-level)
      webcamStream: null,
      webcamRecorder: null,
      webcamRecordingInterval: null,

      // ========================================================================
      // DEVICE MANAGEMENT ACTIONS
      // ========================================================================

      loadDevices: async () => {
        set((state) => ({
          devices: { ...state.devices, isLoading: true, error: null },
          error: null,
        }));

        try {
          // Load screens from backend (Rust)
          const screens: ScreenInfo[] = await invoke('get_available_screens');
          
          // Load cameras using Web APIs
          let cameras: CameraInfo[] = [];
          
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            try {
              // First, we need to request camera permission to get camera labels
              // Without this, enumerateDevices returns devices but with empty labels
              let tempStream: MediaStream | null = null;
              
              try {
                // Request basic camera access to unlock device labels
                tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
              } catch (permError) {
                console.warn('⚠️ Camera permission denied or no camera available:', permError);
                // Continue anyway - we might still get device IDs without labels
              }
              
              // Now enumerate devices - labels should be available
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoDevices = devices.filter(device => device.kind === 'videoinput');
              
              cameras = videoDevices.map((device, index) => ({
                id: device.deviceId,
                name: device.label || `Camera ${index + 1}`,
                isDefault: index === 0,
                isAvailable: true,
                capabilities: {
                  maxWidth: 1920,
                  maxHeight: 1080,
                  supportedFormats: ['mp4', 'webm'],
                  hasAudio: false,
                },
              }));
              
              // Clean up temporary stream
              if (tempStream) {
                tempStream.getTracks().forEach(track => track.stop());
              }
            } catch (error) {
              console.error('❌ Error enumerating cameras:', error);
            }
          } else {
            console.error('❌ navigator.mediaDevices or enumerateDevices not available!');
          }

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
            'device',
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
            'Recording Already in Progress',
            'Please stop the current recording before starting a new one.'
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
          let errorMessage = 'An unknown error occurred while starting the recording.';
          if (error instanceof Error) {
            // Make error messages more user-friendly
            if (error.message.includes('permission')) {
              errorMessage = 'Recording permission was denied. Please grant screen/camera permissions in your system settings.';
            } else if (error.message.includes('device')) {
              errorMessage = 'Selected recording device is not available or is in use by another application.';
            } else {
              errorMessage = error.message;
            }
          }
          
          const appError = createAppError(
            'RECORDING_START_FAILED',
            'Failed to Start Recording',
            errorMessage
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
            'No Active Recording',
            'There is no active recording to stop.'
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
          // Stop recording via Tauri command - returns file path and thumbnail path
          const result = await invoke<{ session_id: string; file_path?: string; thumbnail_path?: string; status: string }>('stop_recording', { sessionId: currentSession.id });
          
          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              status: 'idle',
              filePath: result.file_path,
            } : null,
            progress: null,
            isRecordingIndicatorVisible: false,
            error: null,
          }));

          // Automatically add the recorded video to the media library
          if (result.file_path) {
            try {
              await useMediaStore.getState().importVideo(result.file_path);
              console.log('✅ Recording automatically added to media library');
              if (result.thumbnail_path) {
                console.log('✅ Thumbnail generated:', result.thumbnail_path);
              }
            } catch (importError) {
              console.error('⚠️ Failed to auto-import recording to media library:', importError);
              // Don't fail the stop operation if import fails
              // User can manually import if needed
            }
          }
        } catch (error) {
          const appError = createAppError(
            'RECORDING_STOP_FAILED',
            'Failed to Stop Recording',
            error instanceof Error ? error.message : 'An error occurred while stopping the recording. The recording file may still have been saved.'
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
            'No Active Recording',
            'There is no active recording to pause.'
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
            'Failed to Pause Recording',
            error instanceof Error ? error.message : 'An error occurred while pausing the recording.'
          );

          set({ error: appError });
        }
      },

      resumeRecording: async () => {
        const currentSession = get().currentSession;
        if (!currentSession || currentSession.status !== 'idle') {
          const error = createAppError(
            'NO_PAUSED_RECORDING',
            'No Paused Recording',
            'There is no paused recording to resume.'
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
            'Failed to Resume Recording',
            error instanceof Error ? error.message : 'An error occurred while resuming the recording.'
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

            const newProgress = createRecordingProgress(currentSession.id, progressUpdate);
            
            // Check duration limit
            if (newProgress.duration >= MAX_RECORDING_DURATION) {
              console.warn('⏱️ Recording duration limit reached (1 hour), stopping recording...');
              // Set a user-friendly error message
              set({
                error: createAppError(
                  'RECORDING_DURATION_LIMIT',
                  'Recording Duration Limit Reached',
                  'Your recording has reached the maximum duration of 1 hour and has been automatically stopped.'
                ),
              });
              // Trigger stop recording asynchronously
              setTimeout(() => {
                get().stopRecording();
              }, 0);
            }

            return {
              progress: newProgress,
            };
          }

          const newProgress = { ...state.progress, ...progressUpdate };
          
          // Check duration limit
          if (newProgress.duration >= MAX_RECORDING_DURATION && state.progress.duration < MAX_RECORDING_DURATION) {
            console.warn('⏱️ Recording duration limit reached (1 hour), stopping recording...');
            // Set a user-friendly error message
            set({
              error: createAppError(
                'RECORDING_DURATION_LIMIT',
                'Recording Duration Limit Reached',
                'Your recording has reached the maximum duration of 1 hour and has been automatically stopped.'
              ),
            });
            // Trigger stop recording asynchronously
            setTimeout(() => {
              get().stopRecording();
            }, 0);
          }

          return {
            progress: newProgress,
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
      // WEBCAM RECORDING ACTIONS (App-level)
      // ========================================================================

      startWebcamRecording: async (settings: WebcamRecordingSettings) => {
        const state = get();
        
        // Check if already recording
        if (state.webcamRecorder || state.webcamStream) {
          return;
        }

        try {
          // Get webcam stream
          const constraints: MediaStreamConstraints = {
            video: settings.cameraId ? { deviceId: { exact: settings.cameraId } } : true,
            audio: settings.audioEnabled,
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Create recorder
          const getVideoBitrate = (quality: string): number => {
            switch (quality) {
              case 'low': return 1000000;
              case 'medium': return 2500000;
              case 'high': return 5000000;
              default: return 2500000;
            }
          };

          const recorder = new WebcamRecorder({
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: getVideoBitrate(settings.quality),
            audioBitsPerSecond: settings.audioEnabled ? 128000 : 0,
          });
          
          await recorder.initialize(stream);
          
          // Create session
          const session: RecordingSession = {
            id: `webcam_${Date.now()}`,
            type: 'webcam',
            status: 'recording',
            startTime: new Date().toISOString(),
            settings: settings,
            duration: 0,
          };
          
          // Update state
          set({
            webcamStream: stream,
            webcamRecorder: recorder,
            currentSession: session,
            isRecordingIndicatorVisible: true,
            error: null,
          });
          
          // Start recording
          await recorder.start();
          
          // Start progress tracking
          const interval = setInterval(() => {
            const currentState = get();
            if (currentState.webcamRecorder && currentState.currentSession) {
              const duration = Math.floor(currentState.webcamRecorder.getDuration() / 1000);
              set({
                currentSession: {
                  ...currentState.currentSession,
                  duration,
                }
              });
              
              // Check duration limit
              if (duration >= MAX_RECORDING_DURATION) {
                get().stopWebcamRecording();
              }
            }
          }, 1000);
          
          set({ webcamRecordingInterval: interval });
          
        } catch (error) {
          const appError = createAppError(
            'recording',
            'Failed to start webcam recording',
            error instanceof Error ? error.message : 'Unknown error'
          );
          set({ error: appError });
          
          // Cleanup on error
          const state = get();
          if (state.webcamStream) {
            state.webcamStream.getTracks().forEach(track => track.stop());
          }
          set({
            webcamStream: null,
            webcamRecorder: null,
            currentSession: null,
            isRecordingIndicatorVisible: false,
          });
        }
      },

      stopWebcamRecording: async () => {
        const state = get();
        
        if (!state.webcamRecorder || !state.currentSession) {
          return;
        }

        try {
          // Stop progress tracking
          if (state.webcamRecordingInterval) {
            clearInterval(state.webcamRecordingInterval);
          }
          
          // Stop recorder and get blob
          const recordedBlob = await state.webcamRecorder.stop();
          
          // Save to file
          const timestamp = Date.now();
          const fileName = `webcam_recording_${timestamp}.webm`;
          
          const reader = new FileReader();
          reader.readAsArrayBuffer(recordedBlob);
          
          await new Promise<void>((resolve, reject) => {
            reader.onload = async () => {
              try {
                const buffer = reader.result as ArrayBuffer;
                const uint8Array = Array.from(new Uint8Array(buffer));
                
                const filePath = await invoke<string>('save_webcam_recording', {
                  fileName,
                  data: uint8Array
                });
                
                // Try FFmpeg metadata extraction first
                try {
                  await useMediaStore.getState().importVideo(filePath);
                } catch (importError: any) {
                  // FFmpeg failed (expected for browser-generated WebM)
                  // Create MediaClip manually with the metadata we already have
                  const session = get().currentSession;
                  const mediaClip = {
                    id: `webcam_${Date.now()}`,
                    filepath: filePath,
                    filename: fileName,
                    metadata: {
                      duration: session?.duration || 0,
                      width: 1280,
                      height: 720,
                      fps: 30,
                      filepath: filePath,
                      filename: fileName,
                      fileSize: recordedBlob.size,
                      codec: 'vp9',
                      container: 'webm',
                      thumbnailPath: '', // No thumbnail
                      createdAt: new Date().toISOString(),
                    },
                    createdAt: new Date().toISOString(),
                  };
                  
                  useMediaStore.getState().addClip(mediaClip);
                }
                
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = reject;
          });
          
          // Stop stream
          if (state.webcamStream) {
            state.webcamStream.getTracks().forEach(track => track.stop());
          }
          
          // Clear state
          set({
            webcamStream: null,
            webcamRecorder: null,
            webcamRecordingInterval: null,
            currentSession: null,
            isRecordingIndicatorVisible: false,
          });
          
        } catch (error) {
          const appError = createAppError(
            'recording',
            'Failed to stop webcam recording',
            error instanceof Error ? error.message : 'Unknown error'
          );
          set({ error: appError });
          
          // Cleanup on error
          const currentState = get();
          if (currentState.webcamStream) {
            currentState.webcamStream.getTracks().forEach(track => track.stop());
          }
          if (currentState.webcamRecordingInterval) {
            clearInterval(currentState.webcamRecordingInterval);
          }
          set({
            webcamStream: null,
            webcamRecorder: null,
            webcamRecordingInterval: null,
            currentSession: null,
            isRecordingIndicatorVisible: false,
          });
        }
      },

      // ========================================================================
      // CLEANUP ACTIONS
      // ========================================================================

      cleanup: () => {
        const state = get();
        
        // Stop webcam recording if active
        if (state.webcamStream) {
          state.webcamStream.getTracks().forEach(track => track.stop());
        }
        if (state.webcamRecordingInterval) {
          clearInterval(state.webcamRecordingInterval);
        }
        
        set({
          currentSession: createInitialSession(),
          devices: createInitialDevices(),
          settings: null,
          progress: createInitialProgress(),
          isDialogOpen: false,
          isRecordingIndicatorVisible: false,
          error: null,
          webcamStream: null,
          webcamRecorder: null,
          webcamRecordingInterval: null,
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
