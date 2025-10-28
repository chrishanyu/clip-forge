import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useExportStore, createDefaultExportSettings, validateExportSettings, formatProgressPercentage, formatEstimatedTime, getExportFilePath, estimateExportTime, canStartExport, getExportStatus } from '../stores/exportStore';
import { createAppError } from '@/types';
import type { ExportSettings } from '@/types';

// Mock Zustand devtools
vi.mock('zustand/middleware', () => ({
  devtools: (fn: any) => fn,
}));

// Mock environment
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

describe('ExportStore', () => {
  // Sample test data
  const sampleSettings: ExportSettings = {
    outputPath: '/Users/test/Desktop',
    filename: 'test-video',
    resolution: '1080p',
    quality: 'high',
    format: 'mp4',
    codec: 'h264',
  };

  beforeEach(() => {
    // Reset store state before each test
    useExportStore.getState().resetExport();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useExportStore.getState();
      expect(state.isExporting).toBe(false);
      expect(state.progress.isExporting).toBe(false);
      expect(state.progress.progress).toBe(0);
      expect(state.progress.currentStep).toBe('');
      expect(state.settings).toBe(null);
      expect(state.error).toBe(null);
    });

    it('should have correct computed values initially', () => {
      const state = useExportStore.getState();
      expect(state.canExport).toBe(false); // No settings
      expect(state.isProgressVisible).toBe(false);
      expect(state.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('Export Control', () => {
    it('should start export with settings', () => {
      const { startExport } = useExportStore.getState();
      
      startExport(sampleSettings);
      
      const state = useExportStore.getState();
      expect(state.isExporting).toBe(true);
      expect(state.settings).toEqual(sampleSettings);
      expect(state.progress.isExporting).toBe(true);
      expect(state.progress.progress).toBe(0);
      expect(state.progress.currentStep).toBe('Preparing export...');
      expect(state.error).toBe(null);
    });

    it('should update progress', () => {
      const { startExport, updateProgress } = useExportStore.getState();
      
      startExport(sampleSettings);
      updateProgress({
        progress: 50,
        currentStep: 'Processing video...',
        estimatedTimeRemaining: 30,
      });
      
      const state = useExportStore.getState();
      expect(state.progress.progress).toBe(50);
      expect(state.progress.currentStep).toBe('Processing video...');
      expect(state.progress.estimatedTimeRemaining).toBe(30);
    });

    it('should complete export', () => {
      const { startExport, completeExport } = useExportStore.getState();
      
      startExport(sampleSettings);
      completeExport();
      
      const state = useExportStore.getState();
      expect(state.isExporting).toBe(false);
      expect(state.progress.isExporting).toBe(false);
      expect(state.progress.progress).toBe(100);
      expect(state.progress.currentStep).toBe('Export completed successfully!');
    });

    it('should cancel export', () => {
      const { startExport, cancelExport } = useExportStore.getState();
      
      startExport(sampleSettings);
      cancelExport();
      
      const state = useExportStore.getState();
      expect(state.isExporting).toBe(false);
      expect(state.progress.isExporting).toBe(false);
      expect(state.progress.progress).toBe(0);
      expect(state.progress.currentStep).toBe('Export cancelled');
    });

    it('should reset export', () => {
      const { startExport, resetExport } = useExportStore.getState();
      
      startExport(sampleSettings);
      resetExport();
      
      const state = useExportStore.getState();
      expect(state.isExporting).toBe(false);
      expect(state.progress).toEqual({
        isExporting: false,
        progress: 0,
        currentStep: '',
        estimatedTimeRemaining: 0,
        error: null,
      });
      expect(state.settings).toBe(null);
      expect(state.error).toBe(null);
    });
  });

  describe('Settings Management', () => {
    it('should set settings', () => {
      const { setSettings } = useExportStore.getState();
      
      setSettings(sampleSettings);
      
      const state = useExportStore.getState();
      expect(state.settings).toEqual(sampleSettings);
    });

    it('should update settings', () => {
      const { setSettings, updateSettings } = useExportStore.getState();
      
      setSettings(sampleSettings);
      updateSettings({ quality: 'medium', resolution: '720p' });
      
      const state = useExportStore.getState();
      expect(state.settings?.quality).toBe('medium');
      expect(state.settings?.resolution).toBe('720p');
      expect(state.settings?.filename).toBe(sampleSettings.filename); // Other fields unchanged
    });

    it('should clear settings', () => {
      const { setSettings, clearSettings } = useExportStore.getState();
      
      setSettings(sampleSettings);
      clearSettings();
      
      const state = useExportStore.getState();
      expect(state.settings).toBe(null);
    });
  });

  describe('Error Handling', () => {
    it('should set error', () => {
      const { setError } = useExportStore.getState();
      const error = createAppError('export', 'Export failed');
      
      setError(error);
      
      const state = useExportStore.getState();
      expect(state.error).toEqual(error);
      expect(state.isExporting).toBe(false);
      expect(state.progress.isExporting).toBe(false);
      expect(state.progress.currentStep).toBe('Export failed');
    });

    it('should clear error', () => {
      const { setError, clearError } = useExportStore.getState();
      const error = createAppError('export', 'Export failed');
      
      setError(error);
      clearError();
      
      const state = useExportStore.getState();
      expect(state.error).toBe(null);
    });
  });

  describe('Computed Values', () => {
    it('should calculate canExport correctly', () => {
      const { setSettings, startExport } = useExportStore.getState();
      
      // No settings - cannot export
      expect(useExportStore.getState().canExport).toBe(false);
      
      // With settings - can export
      setSettings(sampleSettings);
      expect(useExportStore.getState().canExport).toBe(true);
      
      // While exporting - cannot export
      startExport(sampleSettings);
      expect(useExportStore.getState().canExport).toBe(false);
    });

    it('should calculate isProgressVisible correctly', () => {
      const { startExport, updateProgress } = useExportStore.getState();
      
      // Initially not visible
      expect(useExportStore.getState().isProgressVisible).toBe(false);
      
      // While exporting - visible
      startExport(sampleSettings);
      expect(useExportStore.getState().isProgressVisible).toBe(true);
      
      // With progress - visible
      updateProgress({ progress: 25 });
      expect(useExportStore.getState().isProgressVisible).toBe(true);
    });

    it('should return estimated time remaining', () => {
      const { updateProgress } = useExportStore.getState();
      
      updateProgress({ estimatedTimeRemaining: 45 });
      expect(useExportStore.getState().estimatedTimeRemaining).toBe(45);
    });
  });
});

describe('ExportStore Utility Functions', () => {
  // Sample test data for utility functions
  const sampleSettings: ExportSettings = {
    outputPath: '/Users/test/Desktop',
    filename: 'test-video',
    resolution: '1080p',
    quality: 'high',
    format: 'mp4',
    codec: 'h264',
  };

  describe('createDefaultExportSettings', () => {
    it('should create settings with timestamp', () => {
      const settings = createDefaultExportSettings();
      
      expect(settings.outputPath).toBe('');
      expect(settings.filename).toMatch(/^clipforge-export-/);
      expect(settings.resolution).toBe('source');
      expect(settings.quality).toBe('medium');
      expect(settings.format).toBe('mp4');
      expect(settings.codec).toBe('h264');
    });
  });

  describe('validateExportSettings', () => {
    it('should validate correct settings', () => {
      const settings: ExportSettings = {
        outputPath: '/path/to/output',
        filename: 'test-video',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const errors = validateExportSettings(settings);
      expect(errors).toEqual([]);
    });

    it('should detect missing output path', () => {
      const settings: ExportSettings = {
        outputPath: '',
        filename: 'test-video',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const errors = validateExportSettings(settings);
      expect(errors).toContain('Output path is required');
    });

    it('should detect missing filename', () => {
      const settings: ExportSettings = {
        outputPath: '/path/to/output',
        filename: '',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const errors = validateExportSettings(settings);
      expect(errors).toContain('Filename is required');
    });

    it('should detect invalid filename', () => {
      const settings: ExportSettings = {
        outputPath: '/path/to/output',
        filename: 'test/video',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const errors = validateExportSettings(settings);
      expect(errors).toContain('Filename cannot contain path separators');
    });

    it('should detect invalid resolution', () => {
      const settings: ExportSettings = {
        outputPath: '/path/to/output',
        filename: 'test-video',
        resolution: '4k' as any,
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const errors = validateExportSettings(settings);
      expect(errors).toContain('Invalid resolution setting');
    });

    it('should detect invalid quality', () => {
      const settings: ExportSettings = {
        outputPath: '/path/to/output',
        filename: 'test-video',
        resolution: '1080p',
        quality: 'ultra' as any,
        format: 'mp4',
        codec: 'h264',
      };
      
      const errors = validateExportSettings(settings);
      expect(errors).toContain('Invalid quality setting');
    });
  });

  describe('formatProgressPercentage', () => {
    it('should format progress percentage', () => {
      expect(formatProgressPercentage(0)).toBe('0%');
      expect(formatProgressPercentage(50)).toBe('50%');
      expect(formatProgressPercentage(99.7)).toBe('100%');
    });
  });

  describe('formatEstimatedTime', () => {
    it('should format estimated time', () => {
      expect(formatEstimatedTime(0)).toBe('Calculating...');
      expect(formatEstimatedTime(30)).toBe('30s remaining');
      expect(formatEstimatedTime(90)).toBe('1m 30s remaining');
      expect(formatEstimatedTime(120)).toBe('2m 0s remaining');
    });
  });

  describe('getExportFilePath', () => {
    it('should create correct file path', () => {
      const settings: ExportSettings = {
        outputPath: '/Users/test/Desktop',
        filename: 'test-video',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const filePath = getExportFilePath(settings);
      expect(filePath).toBe('/Users/test/Desktop/test-video.mp4');
    });

    it('should handle filename with extension', () => {
      const settings: ExportSettings = {
        outputPath: '/Users/test/Desktop',
        filename: 'test-video.mp4',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      };
      
      const filePath = getExportFilePath(settings);
      expect(filePath).toBe('/Users/test/Desktop/test-video.mp4');
    });
  });

  describe('estimateExportTime', () => {
    it('should estimate export time for different settings', () => {
      const baseDuration = 100; // 100 seconds
      
      // Source resolution, medium quality
      const sourceMedium = estimateExportTime(baseDuration, {
        outputPath: '',
        filename: 'test',
        resolution: 'source',
        quality: 'medium',
        format: 'mp4',
        codec: 'h264',
      });
      expect(sourceMedium).toBeCloseTo(10); // 100 * 0.1 * 1
      
      // 1080p, high quality
      const hdHigh = estimateExportTime(baseDuration, {
        outputPath: '',
        filename: 'test',
        resolution: '1080p',
        quality: 'high',
        format: 'mp4',
        codec: 'h264',
      });
      expect(hdHigh).toBeCloseTo(18); // 100 * 0.1 * 1.2 * 1.5
      
      // 720p, low quality
      const sdLow = estimateExportTime(baseDuration, {
        outputPath: '',
        filename: 'test',
        resolution: '720p',
        quality: 'low',
        format: 'mp4',
        codec: 'h264',
      });
      expect(sdLow).toBeCloseTo(5.6); // 100 * 0.1 * 0.8 * 0.7
    });
  });

  describe('canStartExport', () => {
    it('should check if export can be started', () => {
      // Initially cannot start
      expect(canStartExport()).toBe(false);
      
      // With settings can start
      useExportStore.getState().setSettings(sampleSettings);
      expect(canStartExport()).toBe(true);
      
      // While exporting cannot start
      useExportStore.getState().startExport(sampleSettings);
      expect(canStartExport()).toBe(false);
    });
  });

  describe('getExportStatus', () => {
    it('should return correct status for different states', () => {
      // Reset store state
      useExportStore.getState().resetExport();
      
      // Idle state
      let status = getExportStatus();
      expect(status.status).toBe('idle');
      expect(status.message).toBe('Ready to export');
      expect(status.progress).toBe(0);
      
      // Exporting state
      useExportStore.getState().startExport(sampleSettings);
      status = getExportStatus();
      expect(status.status).toBe('exporting');
      expect(status.message).toBe('Preparing export...');
      expect(status.progress).toBe(0);
      
      // Completed state
      useExportStore.getState().completeExport();
      status = getExportStatus();
      expect(status.status).toBe('completed');
      expect(status.message).toBe('Export completed successfully!');
      expect(status.progress).toBe(100);
      
      // Error state
      const error = createAppError('export', 'Test error');
      useExportStore.getState().setError(error);
      status = getExportStatus();
      expect(status.status).toBe('error');
      expect(status.message).toBe('Test error');
      expect(status.progress).toBe(0);
    });
  });
});
