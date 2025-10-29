import { create } from 'zustand';
import { ExportProgress, ExportSettings } from '@/types/export';

// ============================================================================
// EXPORT STORE
// ============================================================================
// Manages export state, progress tracking, and export operations

interface ExportState {
  // Export state
  isExporting: boolean;
  isProgressVisible: boolean;
  progress: ExportProgress | null;
  
  // Export settings
  settings: ExportSettings | null;
  
  // Actions
  startExport: (settings: ExportSettings) => void;
  updateProgress: (progress: ExportProgress) => void;
  completeExport: () => void;
  cancelExport: () => void;
  showProgress: () => void;
  hideProgress: () => void;
  setError: (error: string) => void;
  resetExport: () => void;
}

export const useExportStore = create<ExportState>((set, get) => ({
  // Initial state
  isExporting: false,
  isProgressVisible: false,
  progress: null,
  settings: null,

  // Actions
  startExport: (settings: ExportSettings) => {
    set({
      isExporting: true,
      isProgressVisible: true,
      settings,
      progress: {
        progress: 0,
        current_step: 'Preparing export...',
        estimated_time_remaining: 0,
        error: null,
        current_frame: undefined,
        total_frames: undefined,
        fps: undefined,
        bitrate: undefined,
        time: undefined,
      },
    });
  },

  updateProgress: (progress: ExportProgress) => {
    set({ progress });
  },

  completeExport: () => {
    set({
      isExporting: false,
      progress: get().progress ? {
        ...get().progress!,
        progress: 100,
        current_step: 'Export completed',
        estimated_time_remaining: 0,
      } : null,
    });
  },

  cancelExport: () => {
    set({
      isExporting: false,
      progress: get().progress ? {
        ...get().progress!,
        current_step: 'Export cancelled',
        error: 'Export cancelled by user',
      } : null,
    });
  },

  showProgress: () => {
    set({ isProgressVisible: true });
  },

  hideProgress: () => {
    set({ isProgressVisible: false });
  },

  setError: (error: string) => {
    set({
      isExporting: false,
      progress: get().progress ? {
        ...get().progress!,
        error,
        current_step: 'Export failed',
      } : null,
    });
  },

  resetExport: () => {
    set({
      isExporting: false,
      isProgressVisible: false,
      progress: null,
      settings: null,
    });
  },
}));

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const exportUtils = {
  /**
   * Format time duration in seconds to HH:MM:SS format
   */
  formatTime: (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Format file size in bytes to human readable format
   */
  formatFileSize: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  },

  /**
   * Calculate estimated file size based on settings and duration
   */
  estimateFileSize: (settings: ExportSettings, durationSeconds: number): number => {
    // Base bitrate estimates (kbps)
    const bitrateMap = {
      low: 1000,
      medium: 2500,
      high: 5000,
    };
    
    const baseBitrate = bitrateMap[settings.quality] || 2500;
    
    // Adjust for codec
    const codecMultiplier = {
      h264: 1.0,
      h265: 0.7,
      prores: 2.0,
    };
    
    const bitrate = baseBitrate * (codecMultiplier[settings.codec] || 1.0);
    
    // Convert to bytes (bitrate is in kbps, duration in seconds)
    return (bitrate * 1000 * durationSeconds) / 8;
  },

  /**
   * Get export status message based on progress
   */
  getStatusMessage: (progress: ExportProgress): string => {
    if (progress.error) {
      return `Error: ${progress.error}`;
    }
    
    if (progress.progress >= 100) {
      return 'Export completed successfully!';
    }
    
    return progress.current_step;
  },

  /**
   * Check if export is in progress
   */
  isExportInProgress: (state: ExportState): boolean => {
    return state.isExporting && state.progress !== null && !state.progress.error;
  },

  /**
   * Check if export has completed successfully
   */
  isExportComplete: (state: ExportState): boolean => {
    return !state.isExporting && state.progress !== null && 
           state.progress.progress >= 100 && !state.progress.error;
  },

  /**
   * Check if export has failed
   */
  isExportFailed: (state: ExportState): boolean => {
    return state.progress !== null && !!state.progress.error;
  },
};