import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  formatFileSizeCompact,
  parseFileSize,
  calculateTotalFileSize,
  calculateAverageFileSize,
  getFileSizeCategory,
  isFileSizeWithinLimits,
  getFileSizeWarning,
  formatFileSizeWithColor,
} from '../utils/fileSize';

describe('File Size Utilities', () => {
  describe('formatFileSize', () => {
    it('should format bytes to human-readable file size', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should handle custom decimal places', () => {
      expect(formatFileSize(1536, 0)).toBe('2 KB');
      expect(formatFileSize(1536, 1)).toBe('1.5 KB');
      expect(formatFileSize(1536, 3)).toBe('1.5 KB');
    });
  });

  describe('formatFileSizeCompact', () => {
    it('should format bytes to compact file size', () => {
      expect(formatFileSizeCompact(0)).toBe('0 B');
      expect(formatFileSizeCompact(1024)).toBe('1 K');
      expect(formatFileSizeCompact(1024 * 1024)).toBe('1 M');
      expect(formatFileSizeCompact(1024 * 1024 * 1024)).toBe('1 G');
      expect(formatFileSizeCompact(1536)).toBe('2 K');
    });
  });

  describe('parseFileSize', () => {
    it('should parse file size strings to bytes', () => {
      expect(parseFileSize('1 KB')).toBe(1024);
      expect(parseFileSize('1.5 MB')).toBe(1024 * 1024 * 1.5);
      expect(parseFileSize('2 GB')).toBe(1024 * 1024 * 1024 * 2);
      expect(parseFileSize('500 B')).toBe(500);
    });

    it('should handle case insensitive units', () => {
      expect(parseFileSize('1 kb')).toBe(1024);
      expect(parseFileSize('1 Mb')).toBe(1024 * 1024);
      expect(parseFileSize('1 gb')).toBe(1024 * 1024 * 1024);
    });

    it('should handle invalid input', () => {
      expect(parseFileSize('')).toBe(0);
      expect(parseFileSize('invalid')).toBe(0);
      expect(parseFileSize('1.5')).toBe(0);
    });
  });

  describe('calculateTotalFileSize', () => {
    it('should calculate total file size from array', () => {
      expect(calculateTotalFileSize([1024, 2048, 3072])).toBe(6144);
      expect(calculateTotalFileSize([])).toBe(0);
    });
  });

  describe('calculateAverageFileSize', () => {
    it('should calculate average file size from array', () => {
      expect(calculateAverageFileSize([1024, 2048, 3072])).toBe(2048);
      expect(calculateAverageFileSize([])).toBe(0);
    });
  });

  describe('getFileSizeCategory', () => {
    it('should categorize file sizes', () => {
      expect(getFileSizeCategory(500)).toBe('tiny');
      expect(getFileSizeCategory(1024)).toBe('small');
      expect(getFileSizeCategory(1024 * 1024 * 50)).toBe('medium');
      expect(getFileSizeCategory(1024 * 1024 * 500)).toBe('large');
      expect(getFileSizeCategory(1024 * 1024 * 1024)).toBe('huge');
    });
  });

  describe('isFileSizeWithinLimits', () => {
    it('should check if file size is within limits', () => {
      expect(isFileSizeWithinLimits(1024, 2048)).toBe(true);
      expect(isFileSizeWithinLimits(2048, 1024)).toBe(false);
      expect(isFileSizeWithinLimits(1024, 1024)).toBe(true);
    });
  });

  describe('getFileSizeWarning', () => {
    it('should return warning for oversized files', () => {
      const warning = getFileSizeWarning(2048, 1024);
      expect(warning).toContain('exceeds recommended limit');
    });

    it('should return null for files within limits', () => {
      expect(getFileSizeWarning(1024, 2048)).toBe(null);
    });
  });

  describe('formatFileSizeWithColor', () => {
    it('should return size and color class', () => {
      const result = formatFileSizeWithColor(1024);
      expect(result.size).toBe('1 K');
      expect(result.colorClass).toBe('text-green-600');
    });

    it('should return appropriate color for different sizes', () => {
      expect(formatFileSizeWithColor(500).colorClass).toBe('text-gray-500');
      expect(formatFileSizeWithColor(1024 * 1024 * 1024).colorClass).toBe('text-red-600');
    });
  });
});
