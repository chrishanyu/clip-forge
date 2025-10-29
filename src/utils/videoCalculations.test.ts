import { describe, it, expect } from 'vitest';
import {
  calculateAspectRatio,
  getAspectRatioName,
  calculateBitrate,
  formatBitrate,
  getResolutionCategory,
  getResolutionName,
  calculateQualityScore,
  getQualityLevel,
  calculateCompressionRatio,
  estimateExportFileSize,
  estimateProcessingTime,
  validateVideoMetadata,
  getVideoCompatibility,
} from '../utils/videoCalculations';
import { createVideoMetadata } from '@/types/video';

describe('Video Calculation Utilities', () => {
  // Sample video metadata for testing
  const sampleMetadata = createVideoMetadata({
    duration: 60,
    width: 1920,
    height: 1080,
    fps: 30,
    filepath: '/path/to/video.mp4',
    filename: 'video.mp4',
    fileSize: 100000000, // 100MB
    codec: 'h264',
    container: 'mp4',
    thumbnailPath: '/path/to/thumbnail.jpg',
  });

  describe('calculateAspectRatio', () => {
    it('should calculate aspect ratio correctly', () => {
      expect(calculateAspectRatio(1920, 1080)).toBeCloseTo(1.777, 2);
      expect(calculateAspectRatio(1280, 720)).toBeCloseTo(1.777, 2);
      expect(calculateAspectRatio(640, 480)).toBeCloseTo(1.333, 2);
      expect(calculateAspectRatio(1000, 1000)).toBe(1);
    });

    it('should handle zero height', () => {
      expect(calculateAspectRatio(1920, 0)).toBe(0);
    });
  });

  describe('getAspectRatioName', () => {
    it('should return common aspect ratio names', () => {
      expect(getAspectRatioName(16/9)).toBe('16:9');
      expect(getAspectRatioName(4/3)).toBe('4:3');
      expect(getAspectRatioName(1)).toBe('1:1');
      expect(getAspectRatioName(21/9)).toBe('21:9');
    });

    it('should return custom ratio for uncommon values', () => {
      expect(getAspectRatioName(1.5)).toBe('3:2');
    });
  });

  describe('calculateBitrate', () => {
    it('should calculate bitrate from file size and duration', () => {
      const bitrate = calculateBitrate(100000000, 60); // 100MB, 60 seconds
      expect(bitrate).toBeCloseTo(13333333, 0); // ~13.3 Mbps
    });

    it('should handle zero duration', () => {
      expect(calculateBitrate(100000000, 0)).toBe(0);
    });
  });

  describe('formatBitrate', () => {
    it('should format bitrate for display', () => {
      expect(formatBitrate(1000)).toBe('1 Kbps');
      expect(formatBitrate(1000000)).toBe('1 Mbps');
      expect(formatBitrate(1000000000)).toBe('1 Gbps');
      expect(formatBitrate(1000000000000)).toBe('1000 Gbps');
    });
  });

  describe('getResolutionCategory', () => {
    it('should categorize resolutions correctly', () => {
      expect(getResolutionCategory(640, 480)).toBe('HD');
      expect(getResolutionCategory(1280, 720)).toBe('HD');
      expect(getResolutionCategory(1920, 1080)).toBe('FHD');
      expect(getResolutionCategory(2560, 1440)).toBe('QHD');
      expect(getResolutionCategory(3840, 2160)).toBe('4K');
      expect(getResolutionCategory(7680, 4320)).toBe('8K+');
    });
  });

  describe('getResolutionName', () => {
    it('should return common resolution names', () => {
      expect(getResolutionName(1920, 1080)).toBe('1080p');
      expect(getResolutionName(1280, 720)).toBe('720p');
      expect(getResolutionName(3840, 2160)).toBe('4K');
      expect(getResolutionName(2560, 1440)).toBe('1440p');
    });

    it('should return custom resolution for uncommon sizes', () => {
      expect(getResolutionName(1000, 500)).toBe('1000x500');
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score for high-quality video', () => {
      const score = calculateQualityScore(sampleMetadata);
      expect(score).toBeGreaterThan(60); // Should be good quality
    });

    it('should calculate lower score for low-quality video', () => {
      const lowQualityMetadata = createVideoMetadata({
        duration: 60,
        width: 640,
        height: 480,
        fps: 15,
        filepath: '/path/to/video.mp4',
        filename: 'video.mp4',
        fileSize: 10000000, // 10MB
        codec: 'mpeg',
        container: 'avi',
        thumbnailPath: '/path/to/thumbnail.jpg',
      });
      
      const score = calculateQualityScore(lowQualityMetadata);
      expect(score).toBeLessThan(40);
    });
  });

  describe('getQualityLevel', () => {
    it('should return appropriate quality levels', () => {
      expect(getQualityLevel(95)).toBe('Excellent');
      expect(getQualityLevel(80)).toBe('Very Good');
      expect(getQualityLevel(65)).toBe('Good');
      expect(getQualityLevel(45)).toBe('Fair');
      expect(getQualityLevel(25)).toBe('Poor');
      expect(getQualityLevel(10)).toBe('Very Poor');
    });
  });

  describe('calculateCompressionRatio', () => {
    it('should calculate compression ratio', () => {
      expect(calculateCompressionRatio(100000000, 50000000)).toBe(0.5);
      expect(calculateCompressionRatio(100000000, 100000000)).toBe(1);
      expect(calculateCompressionRatio(0, 50000000)).toBe(0);
    });
  });

  describe('estimateExportFileSize', () => {
    it('should estimate export file size for different settings', () => {
      const size1080pHigh = estimateExportFileSize(60, '1080p', 'high');
      const size720pMedium = estimateExportFileSize(60, '720p', 'medium');
      
      expect(size1080pHigh).toBeGreaterThan(size720pMedium);
      expect(size1080pHigh).toBeGreaterThan(0);
    });
  });

  describe('estimateProcessingTime', () => {
    it('should estimate processing time for different settings', () => {
      const time1080pHigh = estimateProcessingTime(60, '1080p', 'high');
      const time720pLow = estimateProcessingTime(60, '720p', 'low');
      
      expect(time1080pHigh).toBeGreaterThan(time720pLow);
      expect(time1080pHigh).toBeGreaterThan(0);
    });
  });

  describe('validateVideoMetadata', () => {
    it('should validate correct metadata', () => {
      const errors = validateVideoMetadata(sampleMetadata);
      expect(errors).toEqual([]);
    });

    it('should detect invalid metadata', () => {
      const invalidMetadata = createVideoMetadata({
        duration: -1,
        width: 0,
        height: 0,
        fps: 0,
        filepath: '',
        filename: '',
        fileSize: 0,
        codec: 'h264',
        container: 'mp4',
        thumbnailPath: '/path/to/thumbnail.jpg',
      });
      
      const errors = validateVideoMetadata(invalidMetadata);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Duration must be greater than 0');
      expect(errors).toContain('Width and height must be greater than 0');
    });
  });

  describe('getVideoCompatibility', () => {
    it('should return supported for common formats', () => {
      const compatibility = getVideoCompatibility('mp4', 'h264');
      expect(compatibility.isSupported).toBe(true);
    });

    it('should return unsupported for uncommon formats', () => {
      const compatibility = getVideoCompatibility('flv', 'mpeg');
      expect(compatibility.isSupported).toBe(false);
      expect(compatibility.warning).toBeDefined();
      expect(compatibility.recommendation).toBeDefined();
    });
  });
});
