/**
 * Recording Utilities Tests
 */

import {
  WebcamRecorder,
  validateRecordingConstraints,
  getOptimalWebcamConstraints,
  isMediaRecorderSupported,
  getSupportedMimeTypes,
  formatFileSize,
  formatDuration,
} from './recordingUtils';
import { createAppError } from '@/types';

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: jest.fn(() => mockMediaRecorder),
});

Object.defineProperty(MediaRecorder, 'isTypeSupported', {
  writable: true,
  value: jest.fn(),
});

// Mock MediaStream
const mockMediaStream = {
  getTracks: jest.fn(() => [
    { kind: 'video', stop: jest.fn() },
    { kind: 'audio', stop: jest.fn() },
  ]),
} as unknown as MediaStream;

describe('WebcamRecorder', () => {
  let recorder: WebcamRecorder;

  beforeEach(() => {
    jest.clearAllMocks();
    recorder = new WebcamRecorder();
    MediaRecorder.isTypeSupported = jest.fn(() => true);
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      expect(recorder).toBeInstanceOf(WebcamRecorder);
    });

    it('should initialize with custom options', () => {
      const customRecorder = new WebcamRecorder({
        mimeType: 'video/mp4',
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 256000,
      });
      expect(customRecorder).toBeInstanceOf(WebcamRecorder);
    });

    it('should initialize with media stream', async () => {
      await recorder.initialize(mockMediaStream);
      expect(recorder.isCurrentlyRecording()).toBe(false);
    });

    it('should throw error for unsupported MIME type', async () => {
      MediaRecorder.isTypeSupported = jest.fn(() => false);

      await expect(recorder.initialize(mockMediaStream)).rejects.toThrow('Unsupported recording format');
    });
  });

  describe('recording control', () => {
    beforeEach(async () => {
      await recorder.initialize(mockMediaStream);
    });

    it('should start recording', () => {
      recorder.start();
      expect(mockMediaRecorder.start).toHaveBeenCalledWith(1000);
      expect(recorder.isCurrentlyRecording()).toBe(true);
    });

    it('should throw error when starting without initialization', () => {
      const newRecorder = new WebcamRecorder();
      expect(() => newRecorder.start()).toThrow('Cannot start recording');
    });

    it('should throw error when already recording', () => {
      recorder.start();
      expect(() => recorder.start()).toThrow('Cannot start recording');
    });

    it('should stop recording and return blob', async () => {
      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      const mockChunk = { data: mockBlob, timestamp: Date.now(), size: 9 };

      // Mock the dataavailable event
      let dataAvailableHandler: ((event: any) => void) | null = null;
      mockMediaRecorder.addEventListener.mockImplementation((event: string, handler: any) => {
        if (event === 'dataavailable') {
          dataAvailableHandler = handler;
        }
      });

      recorder.start();

      // Simulate data available event
      if (dataAvailableHandler) {
        dataAvailableHandler({ data: mockBlob });
      }

      // Mock stop event
      let stopHandler: (() => void) | null = null;
      mockMediaRecorder.addEventListener.mockImplementation((event: string, handler: any) => {
        if (event === 'stop') {
          stopHandler = handler;
        }
      });

      const stopPromise = recorder.stop();

      // Simulate stop event
      if (stopHandler) {
        stopHandler();
      }

      const result = await stopPromise;
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('video/webm');
    });

    it('should pause recording', () => {
      recorder.start();
      recorder.pause();
      expect(mockMediaRecorder.pause).toHaveBeenCalled();
    });

    it('should resume recording', () => {
      recorder.start();
      recorder.pause();
      recorder.resume();
      expect(mockMediaRecorder.resume).toHaveBeenCalled();
    });

    it('should get recording duration', () => {
      const startTime = Date.now();
      recorder.start();
      
      // Mock Date.now to return a later time
      jest.spyOn(Date, 'now').mockReturnValue(startTime + 5000);
      
      expect(recorder.getDuration()).toBe(5000);
    });

    it('should get data size', () => {
      const mockBlob1 = new Blob(['data1'], { type: 'video/webm' });
      const mockBlob2 = new Blob(['data2'], { type: 'video/webm' });

      let dataAvailableHandler: ((event: any) => void) | null = null;
      mockMediaRecorder.addEventListener.mockImplementation((event: string, handler: any) => {
        if (event === 'dataavailable') {
          dataAvailableHandler = handler;
        }
      });

      recorder.start();

      if (dataAvailableHandler) {
        dataAvailableHandler({ data: mockBlob1 });
        dataAvailableHandler({ data: mockBlob2 });
      }

      expect(recorder.getDataSize()).toBe(10); // 5 + 5 bytes
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await recorder.initialize(mockMediaStream);
      recorder.start();
      
      recorder.cleanup();
      
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[1].stop).toHaveBeenCalled();
      expect(recorder.isCurrentlyRecording()).toBe(false);
    });
  });
});

describe('validateRecordingConstraints', () => {
  it('should validate valid constraints', () => {
    const constraints: MediaStreamConstraints = {
      video: { width: 1280, height: 720 },
      audio: true,
    };

    const result = validateRecordingConstraints(constraints);
    expect(result).toBeNull();
  });

  it('should reject constraints without video or audio', () => {
    const constraints: MediaStreamConstraints = {};

    const result = validateRecordingConstraints(constraints);
    expect(result).toBeTruthy();
    expect(result?.code).toBe('INVALID_CONSTRAINTS');
  });

  it('should reject invalid video width', () => {
    const constraints: MediaStreamConstraints = {
      video: { width: 0 },
    };

    const result = validateRecordingConstraints(constraints);
    expect(result).toBeTruthy();
    expect(result?.code).toBe('INVALID_VIDEO_WIDTH');
  });

  it('should reject invalid video height', () => {
    const constraints: MediaStreamConstraints = {
      video: { height: -100 },
    };

    const result = validateRecordingConstraints(constraints);
    expect(result).toBeTruthy();
    expect(result?.code).toBe('INVALID_VIDEO_HEIGHT');
  });

  it('should reject invalid frame rate', () => {
    const constraints: MediaStreamConstraints = {
      video: { frameRate: 0 },
    };

    const result = validateRecordingConstraints(constraints);
    expect(result).toBeTruthy();
    expect(result?.code).toBe('INVALID_FRAME_RATE');
  });
});

describe('getOptimalWebcamConstraints', () => {
  it('should return optimal constraints without device ID', () => {
    const constraints = getOptimalWebcamConstraints();

    expect(constraints.video).toEqual({
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    });

    expect(constraints.audio).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
  });

  it('should return optimal constraints with device ID', () => {
    const constraints = getOptimalWebcamConstraints('camera123');

    expect(constraints.video).toEqual({
      deviceId: { exact: 'camera123' },
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    });
  });
});

describe('isMediaRecorderSupported', () => {
  it('should return true when MediaRecorder is supported', () => {
    expect(isMediaRecorderSupported()).toBe(true);
  });

  it('should return false when MediaRecorder is not supported', () => {
    // @ts-ignore
    delete window.MediaRecorder;
    expect(isMediaRecorderSupported()).toBe(false);
  });
});

describe('getSupportedMimeTypes', () => {
  it('should return supported MIME types', () => {
    MediaRecorder.isTypeSupported = jest.fn((mimeType: string) => 
      mimeType.includes('webm') || mimeType.includes('mp4')
    );

    const supportedTypes = getSupportedMimeTypes();
    expect(supportedTypes).toContain('video/webm');
    expect(supportedTypes).toContain('video/mp4');
  });

  it('should return empty array when no types supported', () => {
    MediaRecorder.isTypeSupported = jest.fn(() => false);

    const supportedTypes = getSupportedMimeTypes();
    expect(supportedTypes).toEqual([]);
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('should handle decimal values', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });
});

describe('formatDuration', () => {
  it('should format duration correctly', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(5000)).toBe('00:05');
    expect(formatDuration(65000)).toBe('01:05');
    expect(formatDuration(3665000)).toBe('01:01:05');
  });

  it('should handle hours correctly', () => {
    expect(formatDuration(3600000)).toBe('01:00:00');
    expect(formatDuration(7200000)).toBe('02:00:00');
  });
});
