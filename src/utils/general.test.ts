import { describe, it, expect, vi } from 'vitest';
import {
  generateId,
  debounce,
  throttle,
  deepClone,
  deepEqual,
  formatNumber,
  clamp,
  lerp,
  degreesToRadians,
  radiansToDegrees,
  roundToDecimals,
  isInRange,
  getFileExtension,
  removeFileExtension,
  sanitizeFilename,
  isValidUrl,
  isValidEmail,
  generateRandomColor,
  hexToRgb,
  rgbToHex,
  sleep,
  retryWithBackoff,
} from '../utils/general';

describe('General Utilities', () => {
  describe('generateId', () => {
    it('should generate random ID of specified length', () => {
      const id = generateId(8);
      expect(id).toHaveLength(8);
      expect(typeof id).toBe('string');
    });

    it('should generate different IDs', () => {
      const id1 = generateId(8);
      const id2 = generateId(8);
      expect(id1).not.toBe(id2);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', async () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it('should clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone dates', () => {
      const date = new Date('2023-01-01');
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });
  });

  describe('deepEqual', () => {
    it('should compare primitive values', () => {
      expect(deepEqual(42, 42)).toBe(true);
      expect(deepEqual('hello', 'hello')).toBe(true);
      expect(deepEqual(42, 43)).toBe(false);
    });

    it('should compare objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    });

    it('should compare arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('clamp', () => {
    it('should clamp values to range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(11, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('degreesToRadians', () => {
    it('should convert degrees to radians', () => {
      expect(degreesToRadians(0)).toBe(0);
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI);
    });
  });

  describe('radiansToDegrees', () => {
    it('should convert radians to degrees', () => {
      expect(radiansToDegrees(0)).toBe(0);
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
      expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360);
    });
  });

  describe('roundToDecimals', () => {
    it('should round to specified decimal places', () => {
      expect(roundToDecimals(1.23456, 2)).toBe(1.23);
      expect(roundToDecimals(1.23456, 3)).toBe(1.235);
      expect(roundToDecimals(1.23456, 0)).toBe(1);
    });
  });

  describe('isInRange', () => {
    it('should check if value is in range', () => {
      expect(isInRange(5, 0, 10)).toBe(true);
      expect(isInRange(0, 0, 10)).toBe(true);
      expect(isInRange(10, 0, 10)).toBe(true);
      expect(isInRange(-1, 0, 10)).toBe(false);
      expect(isInRange(11, 0, 10)).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('video.mp4')).toBe('mp4');
      expect(getFileExtension('image.JPG')).toBe('jpg');
      expect(getFileExtension('file')).toBe('');
      expect(getFileExtension('file.')).toBe('');
    });
  });

  describe('removeFileExtension', () => {
    it('should remove file extension', () => {
      expect(removeFileExtension('video.mp4')).toBe('video');
      expect(removeFileExtension('image.JPG')).toBe('image');
      expect(removeFileExtension('file')).toBe('file');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize filename for safe usage', () => {
      expect(sanitizeFilename('file<>:"/\\|?*.txt')).toBe('file_.txt');
      expect(sanitizeFilename('file with spaces.txt')).toBe('file_with_spaces.txt');
      expect(sanitizeFilename('__file__.txt')).toBe('file_.txt');
    });
  });

  describe('isValidUrl', () => {
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('ftp://example.com')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('generateRandomColor', () => {
    it('should generate random hex color', () => {
      const color = generateRandomColor();
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('invalid')).toBe(null);
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    });
  });

  describe('sleep', () => {
    it('should sleep for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(100);
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry function with exponential backoff', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      });

      const result = await retryWithBackoff(mockFn, 3, 10);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw new Error('Persistent error');
      });

      await expect(retryWithBackoff(mockFn, 2, 10)).rejects.toThrow('Persistent error');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});
