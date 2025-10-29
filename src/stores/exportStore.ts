import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ExportSettings, ExportProgress, AppError } from '@/types';

// ============================================================================
// EXPORT STORE INTERFACE
// ============================================================================

interface ExportStore {
  // State
  isExporting: boolean;
  progress: ExportProgress;
  settings: ExportSettings | null;
  error: AppError | null;
  
  // Actions - Export Control
  startExport: (settings: ExportSettings) => void;
  updateProgress: (progress: Partial<ExportProgress>) => void;
  completeExport: () => void;
  cancelExport: () => void;
  resetExport: () => void;
  
  // Actions - Settings Management
  setSettings: (settings: ExportSettings) => void;
  updateSettings: (updates: Partial<ExportSettings>) => void;
  clearSettings: () => void;
  
  // Actions - Error Handling
  setError: (error: AppError | null) => void;
  clearError: () => void;
  
  // Computed values
  canExport: boolean;
  isProgressVisible: boolean;
  estimatedTimeRemaining: number;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_EXPORT_PROGRESS: ExportProgress = {
  isExporting: false,
  progress: 0,
  currentStep: '',
  estimatedTimeRemaining: 0,
  error: null,
};

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  outputPath: '',
  filename: 'exported-video',
  resolution: 'source',
  quality: 'medium',
  format: 'mp4',
  codec: 'h264',
};

// ============================================================================
// EXPORT STORE IMPLEMENTATION
// ============================================================================

export const useExportStore = create<ExportStore>()(
  devtools(
    (set, _get) => ({
      // Initial state
      isExporting: false,
      progress: { ...DEFAULT_EXPORT_PROGRESS },
      settings: null,
      error: null,
      
      // Actions - Export Control
      startExport: (settings: ExportSettings) => {
        set(
          {
            isExporting: true,
            settings,
            progress: {
              isExporting: true,
              progress: 0,
              currentStep: 'Preparing export...',
              estimatedTimeRemaining: 0,
              error: null,
            },
            error: null,
            canExport: false,
            isProgressVisible: true,
            estimatedTimeRemaining: 0,
          },
          false,
          'exportStore/startExport'
        );
      },
      
      updateProgress: (progressUpdate: Partial<ExportProgress>) => {
        set(
          (state) => ({
            progress: {
              ...state.progress,
              ...progressUpdate,
            },
            estimatedTimeRemaining: progressUpdate.estimatedTimeRemaining ?? state.estimatedTimeRemaining,
          }),
          false,
          'exportStore/updateProgress'
        );
      },
      
      completeExport: () => {
        set(
          {
            isExporting: false,
            progress: {
              isExporting: false,
              progress: 100,
              currentStep: 'Export completed successfully!',
              estimatedTimeRemaining: 0,
              error: null,
            },
            canExport: false,
            isProgressVisible: true,
            estimatedTimeRemaining: 0,
          },
          false,
          'exportStore/completeExport'
        );
      },
      
      cancelExport: () => {
        set(
          {
            isExporting: false,
            progress: {
              isExporting: false,
              progress: 0,
              currentStep: 'Export cancelled',
              estimatedTimeRemaining: 0,
              error: null,
            },
            error: null,
            canExport: false,
            isProgressVisible: false,
            estimatedTimeRemaining: 0,
          },
          false,
          'exportStore/cancelExport'
        );
      },
      
      resetExport: () => {
        set(
          {
            isExporting: false,
            progress: { ...DEFAULT_EXPORT_PROGRESS },
            settings: null,
            error: null,
            canExport: false,
            isProgressVisible: false,
            estimatedTimeRemaining: 0,
          },
          false,
          'exportStore/resetExport'
        );
      },
      
      // Actions - Settings Management
      setSettings: (settings: ExportSettings) => {
        set(
          (state) => ({
            settings,
            canExport: !state.isExporting && state.error === null,
          }),
          false,
          'exportStore/setSettings'
        );
      },
      
      updateSettings: (updates: Partial<ExportSettings>) => {
        set(
          (state) => ({
            settings: state.settings ? { ...state.settings, ...updates } : null,
          }),
          false,
          'exportStore/updateSettings'
        );
      },
      
      clearSettings: () => {
        set({ settings: null }, false, 'exportStore/clearSettings');
      },
      
      // Actions - Error Handling
      setError: (error: AppError | null) => {
        set(
          {
            error,
            isExporting: false,
            progress: {
              isExporting: false,
              progress: 0,
              currentStep: error ? 'Export failed' : '',
              estimatedTimeRemaining: 0,
              error: error?.message || null,
            },
            canExport: false,
            isProgressVisible: false,
            estimatedTimeRemaining: 0,
          },
          false,
          'exportStore/setError'
        );
      },
      
      clearError: () => {
        set({ error: null }, false, 'exportStore/clearError');
      },
      
      // Computed values (as regular properties, not getters)
      canExport: false,
      isProgressVisible: false,
      estimatedTimeRemaining: 0,
    }),
    {
      name: 'export-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// SELECTOR HOOKS FOR PERFORMANCE
// ============================================================================

export const useIsExporting = () => useExportStore((state) => state.isExporting);
export const useExportProgress = () => useExportStore((state) => state.progress);
export const useExportSettings = () => useExportStore((state) => state.settings);
export const useExportError = () => useExportStore((state) => state.error);

export const useExportStats = () =>
  useExportStore((state) => ({
    canExport: state.canExport,
    isProgressVisible: state.isProgressVisible,
    estimatedTimeRemaining: state.estimatedTimeRemaining,
  }));

// ============================================================================
// ACTION HOOKS FOR CONVENIENCE
// ============================================================================

export const useExportActions = () =>
  useExportStore((state) => ({
    startExport: state.startExport,
    updateProgress: state.updateProgress,
    completeExport: state.completeExport,
    cancelExport: state.cancelExport,
    resetExport: state.resetExport,
    setSettings: state.setSettings,
    updateSettings: state.updateSettings,
    clearSettings: state.clearSettings,
    setError: state.setError,
    clearError: state.clearError,
  }));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default export settings with current timestamp
 */
export const createDefaultExportSettings = (): ExportSettings => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    filename: `clipforge-export-${timestamp}`,
  };
};

/**
 * Validate export settings
 */
export const validateExportSettings = (settings: ExportSettings): string[] => {
  const errors: string[] = [];
  
  if (!settings.outputPath.trim()) {
    errors.push('Output path is required');
  }
  
  if (!settings.filename.trim()) {
    errors.push('Filename is required');
  }
  
  if (settings.filename.includes('/') || settings.filename.includes('\\')) {
    errors.push('Filename cannot contain path separators');
  }
  
  if (!['source', '1080p', '720p'].includes(settings.resolution)) {
    errors.push('Invalid resolution setting');
  }
  
  if (!['high', 'medium', 'low'].includes(settings.quality)) {
    errors.push('Invalid quality setting');
  }
  
  return errors;
};

/**
 * Format progress percentage for display
 */
export const formatProgressPercentage = (progress: number): string => {
  return `${Math.round(progress)}%`;
};

/**
 * Format estimated time remaining for display
 */
export const formatEstimatedTime = (seconds: number): string => {
  if (seconds <= 0) return 'Calculating...';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s remaining`;
  } else {
    return `${remainingSeconds}s remaining`;
  }
};

/**
 * Get export file path from settings
 */
export const getExportFilePath = (settings: ExportSettings): string => {
  const filename = settings.filename.endsWith('.mp4') 
    ? settings.filename 
    : `${settings.filename}.mp4`;
  
  return `${settings.outputPath}/${filename}`.replace(/\/+/g, '/');
};

/**
 * Estimate export time based on timeline duration and settings
 */
export const estimateExportTime = (
  timelineDuration: number,
  settings: ExportSettings
): number => {
  // Rough estimation based on resolution and quality
  let multiplier = 1;
  
  // Resolution impact
  switch (settings.resolution) {
    case '1080p':
      multiplier *= 1.2;
      break;
    case '720p':
      multiplier *= 0.8;
      break;
    case 'source':
    default:
      multiplier *= 1;
      break;
  }
  
  // Quality impact
  switch (settings.quality) {
    case 'high':
      multiplier *= 1.5;
      break;
    case 'medium':
      multiplier *= 1;
      break;
    case 'low':
      multiplier *= 0.7;
      break;
  }
  
  // Base estimation: 0.1x real-time for simple concatenation
  return timelineDuration * 0.1 * multiplier;
};

/**
 * Check if export can be started
 */
export const canStartExport = (): boolean => {
  const state = useExportStore.getState();
  return state.canExport;
};

/**
 * Get current export status for UI display
 */
export const getExportStatus = (): {
  status: 'idle' | 'preparing' | 'exporting' | 'completed' | 'cancelled' | 'error';
  message: string;
  progress: number;
} => {
  const state = useExportStore.getState();
  
  if (state.error) {
    return {
      status: 'error',
      message: state.error.message,
      progress: 0,
    };
  }
  
  if (state.isExporting) {
    return {
      status: 'exporting',
      message: state.progress.currentStep,
      progress: state.progress.progress,
    };
  }
  
  if (state.progress.progress === 100) {
    return {
      status: 'completed',
      message: 'Export completed successfully!',
      progress: 100,
    };
  }
  
  if (state.progress.currentStep === 'Export cancelled') {
    return {
      status: 'cancelled',
      message: 'Export was cancelled',
      progress: 0,
    };
  }
  
  return {
    status: 'idle',
    message: 'Ready to export',
    progress: 0,
  };
};
