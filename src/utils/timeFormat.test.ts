import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatTimeShort,
  formatDuration,
  parseTime,
  timeToPixels,
  pixelsToTime,
  snapToGrid,
  calculateDuration,
  isTimeInRange,
  clampTime,
} from '../utils/timeFormat';

describe('Time Formatting Utilities', () => {
  describe('formatTime', () => {
    it('should format seconds to HH:MM:SS.mmm format', () => {
      expect(formatTime(0)).toBe('00:00:00.000');
      expect(formatTime(30)).toBe('00:00:30.000');
      expect(formatTime(90)).toBe('00:01:30.000');
      expect(formatTime(3661.5)).toBe('01:01:01.500');
      expect(formatTime(3661.123)).toBe('01:01:01.123');
    });

    it('should handle negative values', () => {
      expect(formatTime(-5)).toBe('00:00:00.000');
    });

    it('should handle decimal seconds', () => {
      expect(formatTime(1.5)).toBe('00:00:01.500');
      expect(formatTime(1.123)).toBe('00:00:01.123');
    });
  });

  describe('formatTimeShort', () => {
    it('should format seconds to MM:SS format', () => {
      expect(formatTimeShort(0)).toBe('00:00');
      expect(formatTimeShort(30)).toBe('00:30');
      expect(formatTimeShort(90)).toBe('01:30');
      expect(formatTimeShort(3661)).toBe('61:01');
    });

    it('should handle negative values', () => {
      expect(formatTimeShort(-5)).toBe('00:00');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds to human-readable duration', () => {
      expect(formatDuration(0)).toBe('0 seconds');
      expect(formatDuration(1)).toBe('1 second');
      expect(formatDuration(30)).toBe('30 seconds');
      expect(formatDuration(60)).toBe('1 minute');
      expect(formatDuration(90)).toBe('1 minute, 30 seconds');
      expect(formatDuration(3661)).toBe('1 hour, 1 minute, 1 second');
    });

    it('should handle negative values', () => {
      expect(formatDuration(-5)).toBe('0 seconds');
    });
  });

  describe('parseTime', () => {
    it('should parse time strings to seconds', () => {
      expect(parseTime('30')).toBe(30);
      expect(parseTime('1:30')).toBe(90);
      expect(parseTime('1:01:30')).toBe(3690);
      expect(parseTime('0:30')).toBe(30);
      expect(parseTime('0:00:30')).toBe(30);
    });

    it('should handle invalid input', () => {
      expect(parseTime('')).toBe(0);
      expect(parseTime('invalid')).toBe(0);
      expect(parseTime('1:2:3:4')).toBe(0);
    });
  });

  describe('timeToPixels', () => {
    it('should convert time to pixels', () => {
      expect(timeToPixels(10, 100)).toBe(1000);
      expect(timeToPixels(5, 50)).toBe(250);
      expect(timeToPixels(0, 100)).toBe(0);
    });
  });

  describe('pixelsToTime', () => {
    it('should convert pixels to time', () => {
      expect(pixelsToTime(1000, 100)).toBe(10);
      expect(pixelsToTime(250, 50)).toBe(5);
      expect(pixelsToTime(0, 100)).toBe(0);
    });
  });

  describe('snapToGrid', () => {
    it('should snap time to grid', () => {
      expect(snapToGrid(10.3, 0.1)).toBe(10.3);
      expect(snapToGrid(10.35, 0.1)).toBeCloseTo(10.4, 0);
      expect(snapToGrid(10.25, 0.1)).toBeCloseTo(10.3, 1);
      expect(snapToGrid(10.5, 1)).toBe(11);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration from start and end times', () => {
      expect(calculateDuration(0, 10)).toBe(10);
      expect(calculateDuration(5, 15)).toBe(10);
      expect(calculateDuration(10, 5)).toBe(0); // Negative duration becomes 0
    });
  });

  describe('isTimeInRange', () => {
    it('should check if time is within range', () => {
      expect(isTimeInRange(5, 0, 10)).toBe(true);
      expect(isTimeInRange(0, 0, 10)).toBe(true);
      expect(isTimeInRange(10, 0, 10)).toBe(true);
      expect(isTimeInRange(-1, 0, 10)).toBe(false);
      expect(isTimeInRange(11, 0, 10)).toBe(false);
    });
  });

  describe('clampTime', () => {
    it('should clamp time to valid range', () => {
      expect(clampTime(5, 0, 10)).toBe(5);
      expect(clampTime(-1, 0, 10)).toBe(0);
      expect(clampTime(11, 0, 10)).toBe(10);
    });
  });
});
