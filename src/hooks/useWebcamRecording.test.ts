/**
 * useWebcamRecording Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebcamRecording } from './useWebcamRecording';
import { createAppError } from '@/types';

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
  },
});

// Mock MediaStream
const mockMediaStream = {
  getTracks: jest.fn(() => [
    { kind: 'video', stop: jest.fn() },
    { kind: 'audio', stop: jest.fn() },
  ]),
} as unknown as MediaStream;

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
  value: jest.fn(() => true),
});

describe('useWebcamRecording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    mockEnumerateDevices.mockResolvedValue([
      {
        deviceId: 'camera1',
        kind: 'videoinput',
        label: 'Test Camera 1',
      },
      {
        deviceId: 'camera2',
        kind: 'videoinput',
        label: 'Test Camera 2',
      },
    ]);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWebcamRecording());

      expect(result.current.availableCameras).toEqual([]);
      expect(result.current.selectedCameraId).toBeNull();
      expect(result.current.isEnumerating).toBe(false);
      expect(result.current.stream).toBeNull();
      expect(result.current.isStreamActive).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasPermission).toBeNull();
    });

    it('should automatically enumerate cameras on mount', async () => {
      renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(mockEnumerateDevices).toHaveBeenCalled();
      });
    });
  });

  describe('camera enumeration', () => {
    it('should enumerate cameras successfully', async () => {
      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
        expect(result.current.availableCameras[0]).toEqual({
          id: 'camera1',
          name: 'Test Camera 1',
          isDefault: true,
          isAvailable: true,
          capabilities: {
            maxWidth: 1920,
            maxHeight: 1080,
            supportedFormats: ['video/webm', 'video/mp4'],
            hasAudio: true,
          },
        });
        expect(result.current.selectedCameraId).toBe('camera1');
        expect(result.current.hasPermission).toBe(true);
        expect(result.current.isEnumerating).toBe(false);
      });
    });

    it('should handle enumeration errors', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.code).toBe('CAMERA_ENUMERATION_FAILED');
        expect(result.current.hasPermission).toBe(false);
        expect(result.current.isEnumerating).toBe(false);
      });
    });

    it('should handle missing MediaDevices API', async () => {
      // @ts-ignore
      delete navigator.mediaDevices;

      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.code).toBe('MEDIA_DEVICES_NOT_SUPPORTED');
      });
    });
  });

  describe('camera selection', () => {
    it('should select camera successfully', async () => {
      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
      });

      act(() => {
        result.current.selectCamera('camera2');
      });

      expect(result.current.selectedCameraId).toBe('camera2');
    });

    it('should restart stream when selecting different camera', async () => {
      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
      });

      // Start preview first
      act(() => {
        result.current.startPreview();
      });

      await waitFor(() => {
        expect(result.current.isStreamActive).toBe(true);
      });

      // Select different camera
      act(() => {
        result.current.selectCamera('camera2');
      });

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(2); // Once for initial preview, once for new camera
      });
    });
  });

  describe('stream management', () => {
    it('should start preview successfully', async () => {
      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
      });

      act(() => {
        result.current.startPreview();
      });

      await waitFor(() => {
        expect(result.current.isStreamActive).toBe(true);
        expect(result.current.stream).toBe(mockMediaStream);
        expect(result.current.hasPermission).toBe(true);
      });
    });

    it('should handle preview start errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Camera access denied'));

      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
      });

      act(() => {
        result.current.startPreview();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.code).toBe('CAMERA_ACCESS_FAILED');
        expect(result.current.hasPermission).toBe(false);
        expect(result.current.isStreamActive).toBe(false);
      });
    });

    it('should stop preview successfully', async () => {
      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
      });

      // Start preview
      act(() => {
        result.current.startPreview();
      });

      await waitFor(() => {
        expect(result.current.isStreamActive).toBe(true);
      });

      // Stop preview
      act(() => {
        result.current.stopPreview();
      });

      expect(result.current.isStreamActive).toBe(false);
      expect(result.current.stream).toBeNull();
    });

    it('should not start preview without selected camera', async () => {
      const { result } = renderHook(() => useWebcamRecording());

      // Set selected camera to null
      act(() => {
        result.current.selectCamera('');
      });

      act(() => {
        result.current.startPreview();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.code).toBe('NO_CAMERA_SELECTED');
      });
    });
  });

  describe('error handling', () => {
    it('should clear errors', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useWebcamRecording());

      await waitFor(() => {
        expect(result.current.availableCameras).toHaveLength(2);
      });

      // Start preview
      act(() => {
        result.current.startPreview();
      });

      await waitFor(() => {
        expect(result.current.isStreamActive).toBe(true);
      });

      // Unmount
      unmount();

      // Verify tracks were stopped
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[1].stop).toHaveBeenCalled();
    });
  });
});
