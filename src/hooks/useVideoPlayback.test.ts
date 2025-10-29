import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useVideoPlayback } from './useVideoPlayback';
import { useTimelineStore } from '@/stores/timelineStore';
import { useMediaStore } from '@/stores/mediaStore';

// Mock the stores
vi.mock('@/stores/timelineStore');
vi.mock('@/stores/mediaStore');
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://localhost/${path}`)
}));

// Mock MediaError
Object.defineProperty(global, 'MediaError', {
  value: {
    MEDIA_ERR_NETWORK: 2,
    MEDIA_ERR_DECODE: 3,
    MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
    MEDIA_ERR_ABORTED: 1
  },
  writable: true
});

const mockUseTimelineStore = useTimelineStore as any;
const mockUseMediaStore = useMediaStore as any;

describe('useVideoPlayback', () => {
  const mockSetPlayhead = vi.fn();
  const mockPause = vi.fn();
  const mockGetClipById = vi.fn();

  const mockClip = {
    id: 'clip1',
    mediaClipId: 'media1',
    startTime: 0,
    duration: 10,
    trimStart: 0,
    trimEnd: 10,
    trackId: 'track1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseTimelineStore.mockReturnValue({
      playhead: 0,
      isPlaying: false,
      tracks: [{ id: 'track1', name: 'Track 1', clips: [mockClip] }],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });
    
    mockUseMediaStore.mockReturnValue({
      getClipById: mockGetClipById,
    });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useVideoPlayback());

    expect(result.current.videoRef).toBeDefined();
    expect(result.current.isVideoLoaded).toBe(false);
    expect(result.current.currentClip).toBe(null);
    expect(result.current.videoError).toBe(null);
    expect(result.current.isMuted).toBe(false);
    expect(typeof result.current.handleMuteToggle).toBe('function');
    expect(typeof result.current.handleVideoLoad).toBe('function');
    expect(typeof result.current.handleVideoError).toBe('function');
    expect(typeof result.current.handleTimeUpdate).toBe('function');
    expect(typeof result.current.handleVideoEnded).toBe('function');
    expect(typeof result.current.syncVideoWithTimeline).toBe('function');
    expect(typeof result.current.updateVideoSource).toBe('function');
    expect(typeof result.current.startSyncLoop).toBe('function');
    expect(typeof result.current.stopSyncLoop).toBe('function');
    expect(typeof result.current.getSyncLoopMetrics).toBe('function');
    expect(typeof result.current.forceSyncUpdate).toBe('function');
    expect(typeof result.current.retryVideoLoad).toBe('function');
    expect(typeof result.current.clearVideoError).toBe('function');
    expect(typeof result.current.checkCodecCompatibility).toBe('function');
  });

  it('should handle mute toggle', () => {
    const { result } = renderHook(() => useVideoPlayback());

    act(() => {
      result.current.handleMuteToggle(true);
    });

    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.handleMuteToggle(false);
    });

    expect(result.current.isMuted).toBe(false);
  });

  it('should handle video load', () => {
    const { result } = renderHook(() => useVideoPlayback());

    act(() => {
      result.current.handleVideoLoad();
    });

    expect(result.current.isVideoLoaded).toBe(true);
    expect(result.current.videoError).toBe(null);
  });

  it('should handle video error', () => {
    const { result } = renderHook(() => useVideoPlayback());
    const mockEvent = {
      currentTarget: {
        error: {
          code: 4,
          message: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
        },
        src: 'test.mp4',
        currentSrc: 'test.mp4',
        networkState: 3,
        readyState: 0
      }
    } as any;

    act(() => {
      result.current.handleVideoError(mockEvent);
    });

    expect(result.current.videoError?.message).toBe('MEDIA_ERR_SRC_NOT_SUPPORTED');
    expect(result.current.isVideoLoaded).toBe(false);
  });

  it('should handle video error without error object', () => {
    const { result } = renderHook(() => useVideoPlayback());
    const mockEvent = {
      currentTarget: {
        error: null,
        src: 'test.mp4',
        currentSrc: 'test.mp4',
        networkState: 3,
        readyState: 0
      }
    } as any;

    act(() => {
      result.current.handleVideoError(mockEvent);
    });

    expect(result.current.videoError?.message).toBe('Unknown video error');
    expect(result.current.isVideoLoaded).toBe(false);
  });

  it('should update video source with valid clip', async () => {
    const mockClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      trackId: 'track1'
    };

    const mockMediaClip = {
      id: 'media1',
      filepath: '/path/to/video.mp4',
      filename: 'video.mp4',
      metadata: {
        duration: 10,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        fileSize: 1000000,
        thumbnailPath: '/path/to/thumb.jpg'
      },
      createdAt: '2024-01-01T00:00:00Z',
      isLoading: false
    };

    // Set up the mock before rendering the hook
    mockGetClipById.mockReturnValue(mockMediaClip);

    const { result } = renderHook(() => useVideoPlayback());

    // Mock the video ref before calling updateVideoSource
    const mockVideo = {
      src: '',
      load: vi.fn(),
      pause: vi.fn(),
      currentTime: 0
    };
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.updateVideoSource(mockClip);
    });

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.currentClip).toStrictEqual(mockClip);
    });

    // Check if getClipById was called
    expect(mockGetClipById).toHaveBeenCalledWith('media1');
    expect(result.current.videoError).toBe(null);
  });

  it('should clear video source when clip is null', async () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock the video ref
    const mockVideo = {
      src: '',
      load: vi.fn(),
      pause: vi.fn(),
      currentTime: 0
    };
    (result.current.videoRef as any).current = mockVideo;

    // First set a clip
    const mockClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      trackId: 'track1'
    };

    const mockMediaClip = {
      id: 'media1',
      filepath: '/path/to/video.mp4',
      filename: 'video.mp4',
      metadata: {
        duration: 10,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        fileSize: 1000000,
        thumbnailPath: '/path/to/thumb.jpg'
      },
      createdAt: '2024-01-01T00:00:00Z',
      isLoading: false
    };

    mockGetClipById.mockReturnValue(mockMediaClip);

    act(() => {
      result.current.updateVideoSource(mockClip);
    });

    await waitFor(() => {
      expect(result.current.currentClip).toStrictEqual(mockClip);
    });

    // Mock timeline store to have no tracks when clearing
    mockUseTimelineStore.mockReturnValue({
      playhead: 0,
      isPlaying: false,
      tracks: [],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });

    // Then clear it
    act(() => {
      result.current.updateVideoSource(null);
    });

    await waitFor(() => {
      expect(result.current.currentClip).toBe(null);
    });
  });

  it('should handle time update with valid clip', async () => {
    const testClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 5,
      duration: 10,
      trimStart: 1,
      trimEnd: 9,
      trackId: 'track1'
    };

    const mockMediaClip = {
      id: 'media1',
      filepath: '/path/to/video.mp4',
      filename: 'video.mp4',
      metadata: {
        duration: 10,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        fileSize: 1000000,
        thumbnailPath: '/path/to/thumb.jpg'
      },
      createdAt: '2024-01-01T00:00:00Z',
      isLoading: false
    };

    mockGetClipById.mockReturnValue(mockMediaClip);

    // Mock timeline store to use the test clip
    mockUseTimelineStore.mockReturnValue({
      playhead: 5,
      isPlaying: false,
      tracks: [{ id: 'track1', name: 'Track 1', clips: [testClip] }],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });

    const { result } = renderHook(() => useVideoPlayback());

    // Mock video element with a time that will result in a significant difference
    const mockVideo = {
      currentTime: 3, // This will result in timelineTime = 5 + 3 - 1 = 7, different from playhead = 5
      src: '',
      load: vi.fn(),
      pause: vi.fn()
    };

    // Set up the clip first
    act(() => {
      result.current.updateVideoSource(testClip);
    });

    await waitFor(() => {
      expect(result.current.currentClip).toStrictEqual(testClip);
    });

    // Mock the video ref AFTER calling updateVideoSource, with the desired currentTime
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.handleTimeUpdate();
    });

    // Should call setPlayhead with calculated timeline time
    // timelineTime = clip.startTime + videoTime - clip.trimStart
    // timelineTime = 5 + 3 - 1 = 7 (video.currentTime is 3, not set by updateVideoSource)
    expect(mockSetPlayhead).toHaveBeenCalledWith(7);
  });

  it('should not update playhead if time difference is too small', async () => {
    const testClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 5,
      duration: 10,
      trimStart: 1,
      trimEnd: 9,
      trackId: 'track1'
    };

    // Mock video element with time that would result in very small difference
    const mockVideo = {
      currentTime: 1.001 // This would result in timelineTime = 5.001, very close to playhead = 5
    };

    // Mock timeline store to use the test clip
    mockUseTimelineStore.mockReturnValue({
      playhead: 5,
      isPlaying: false,
      tracks: [{ id: 'track1', name: 'Track 1', clips: [testClip] }],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });

    const { result } = renderHook(() => useVideoPlayback());

    // Set up the clip and playhead
    act(() => {
      result.current.updateVideoSource(testClip);
    });

    await waitFor(() => {
      expect(result.current.currentClip).toStrictEqual(testClip);
    });

    // Mock the video ref AFTER calling updateVideoSource
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.handleTimeUpdate();
    });

    // Should not call setPlayhead due to small difference
    expect(mockSetPlayhead).not.toHaveBeenCalled();
  });

  it('should handle video ended with next clip', () => {
    const mockClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      trackId: 'track1'
    };

    const mockNextClip = {
      id: 'clip2',
      mediaClipId: 'media2',
      startTime: 10,
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      trackId: 'track1'
    };

    const mockMediaClip = {
      id: 'media1',
      filepath: '/path/to/video.mp4',
      filename: 'video.mp4',
      metadata: {
        duration: 10,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        fileSize: 1000000,
        thumbnailPath: '/path/to/thumb.jpg'
      },
      createdAt: '2024-01-01T00:00:00Z',
      isLoading: false
    };

    mockGetClipById.mockReturnValue(mockMediaClip);

    // Mock tracks with next clip
    mockUseTimelineStore.mockReturnValue({
      playhead: 0,
      isPlaying: false,
      tracks: [{
        id: 'track1',
        name: 'Track 1',
        clips: [mockClip, mockNextClip],
        isMuted: false,
        volume: 1.0
      }],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });

    const { result } = renderHook(() => useVideoPlayback());

    // Mock the video ref
    const mockVideo = {
      currentTime: 2,
      src: '',
      load: vi.fn(),
      pause: vi.fn()
    };
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.updateVideoSource(mockClip);
    });

    act(() => {
      result.current.handleVideoEnded();
    });

    expect(mockSetPlayhead).toHaveBeenCalledWith(10); // Next clip start time
  });

  it('should handle video ended without next clip', async () => {
    const mockClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      trackId: 'track1'
    };

    const mockMediaClip = {
      id: 'media1',
      filepath: '/path/to/video.mp4',
      filename: 'video.mp4',
      metadata: {
        duration: 10,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        fileSize: 1000000,
        thumbnailPath: '/path/to/thumb.jpg'
      },
      createdAt: '2024-01-01T00:00:00Z',
      isLoading: false
    };

    mockGetClipById.mockReturnValue(mockMediaClip);

    const { result } = renderHook(() => useVideoPlayback());

    // Mock the video ref
    const mockVideo = {
      currentTime: 2,
      src: '',
      load: vi.fn(),
      pause: vi.fn()
    };
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.updateVideoSource(mockClip);
    });

    await waitFor(() => {
      expect(result.current.currentClip).toStrictEqual(mockClip);
    });

    act(() => {
      result.current.handleVideoEnded();
    });

    expect(mockPause).toHaveBeenCalled();
    expect(mockSetPlayhead).toHaveBeenCalledWith(10); // Clip end time
  });

  it('should handle sync loop start and stop', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock requestAnimationFrame
    const mockRequestAnimationFrame = vi.fn((callback) => {
      setTimeout(callback, 16); // Simulate 60fps
      return 1;
    });
    const mockCancelAnimationFrame = vi.fn();
    
    global.requestAnimationFrame = mockRequestAnimationFrame;
    global.cancelAnimationFrame = mockCancelAnimationFrame;

    act(() => {
      result.current.startSyncLoop();
    });

    expect(mockRequestAnimationFrame).toHaveBeenCalled();

    act(() => {
      result.current.stopSyncLoop();
    });

    expect(mockCancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('should handle enhanced video synchronization', () => {
    const mockClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 5,
      duration: 10,
      trimStart: 2,
      trimEnd: 12,
      trackId: 'track1'
    };

    mockUseTimelineStore.mockReturnValue({
      playhead: 7,
      isPlaying: false,
      tracks: [{ id: 'track1', name: 'Track 1', clips: [mockClip] }],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });

    const { result } = renderHook(() => useVideoPlayback());

    // Set up video ref
    const mockVideo = {
      currentTime: 1, // Should be 4 (7 - 5 + 2)
      pause: vi.fn(),
      src: '',
      load: vi.fn()
    };
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.updateVideoSource(mockClip);
    });

    // Test syncVideoWithTimeline with same clip but wrong position
    act(() => {
      result.current.syncVideoWithTimeline();
    });

    // Should seek to correct position
    expect(mockVideo.currentTime).toBe(4);
  });

  it('should provide sync loop metrics', () => {
    const { result } = renderHook(() => useVideoPlayback());

    const metrics = result.current.getSyncLoopMetrics();
    
    expect(metrics).toHaveProperty('isRunning');
    expect(metrics).toHaveProperty('frameCount');
    expect(metrics).toHaveProperty('currentFps');
    expect(metrics).toHaveProperty('lastUpdateTime');
    expect(metrics).toHaveProperty('timeSinceLastUpdate');
    expect(typeof metrics.isRunning).toBe('boolean');
    expect(typeof metrics.frameCount).toBe('number');
    expect(typeof metrics.currentFps).toBe('number');
  });

  it('should force sync update', async () => {
    const testClip = {
      id: 'clip1',
      mediaClipId: 'media1',
      startTime: 5,
      duration: 10,
      trimStart: 1,
      trimEnd: 9,
      trackId: 'track1'
    };

    mockUseTimelineStore.mockReturnValue({
      playhead: 5,
      isPlaying: false,
      tracks: [{ id: 'track1', name: 'Track 1', clips: [testClip] }],
      setPlayhead: mockSetPlayhead,
      pause: mockPause,
    });

    const { result } = renderHook(() => useVideoPlayback());

    // Mock video element
    const mockVideo = {
      currentTime: 3,
      src: '',
      load: vi.fn(),
      pause: vi.fn()
    };

    act(() => {
      result.current.updateVideoSource(testClip);
    });

    await waitFor(() => {
      expect(result.current.currentClip).toStrictEqual(testClip);
    });

    // Mock the video ref
    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.forceSyncUpdate();
    });

    // Should call setPlayhead with calculated timeline time
    // timelineTime = 5 + 3 - 1 = 7
    expect(mockSetPlayhead).toHaveBeenCalledWith(7);
  });

  it('should handle sync loop with performance monitoring', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock requestAnimationFrame
    const mockRequestAnimationFrame = vi.fn((callback) => {
      // Simulate multiple frames
      setTimeout(() => callback(performance.now() + 16), 16);
      setTimeout(() => callback(performance.now() + 32), 32);
      return 1;
    });
    const mockCancelAnimationFrame = vi.fn();
    
    global.requestAnimationFrame = mockRequestAnimationFrame;
    global.cancelAnimationFrame = mockCancelAnimationFrame;

    act(() => {
      result.current.startSyncLoop();
    });

    expect(mockRequestAnimationFrame).toHaveBeenCalled();

    // Check metrics
    const metrics = result.current.getSyncLoopMetrics();
    expect(metrics.isRunning).toBe(true);

    act(() => {
      result.current.stopSyncLoop();
    });

    expect(mockCancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('should handle video load start', () => {
    const { result } = renderHook(() => useVideoPlayback());

    act(() => {
      result.current.handleVideoLoadStart();
    });

    expect(result.current.loadingState).toBe('loading');
    expect(result.current.videoError).toBeNull();
    expect(result.current.isVideoLoaded).toBe(false);
  });

  it('should handle video progress updates', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock video element with buffered data
    const mockVideo = {
      buffered: {
        length: 1,
        end: (index: number) => index === 0 ? 5 : 0
      },
      duration: 10,
      networkState: 1,
      readyState: 3
    };

    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.handleVideoProgress();
    });

    expect(result.current.loadingProgress.buffered).toBe(0.5); // 5/10
    expect(result.current.loadingProgress.duration).toBe(10);
    expect(result.current.loadingProgress.loaded).toBe(5);
    expect(result.current.loadingProgress.networkState).toBe(1);
    expect(result.current.loadingProgress.readyState).toBe(3);
  });

  it('should handle video seeking states', () => {
    const { result } = renderHook(() => useVideoPlayback());

    act(() => {
      result.current.handleVideoSeeking();
    });

    expect(result.current.isSeeking).toBe(true);
    expect(result.current.loadingState).toBe('seeking');

    act(() => {
      result.current.handleVideoSeeked();
    });

    expect(result.current.isSeeking).toBe(false);
    expect(result.current.loadingState).toBe('loading'); // isVideoLoaded is false initially
  });

  it('should handle video waiting (buffering)', () => {
    const { result } = renderHook(() => useVideoPlayback());

    act(() => {
      result.current.handleVideoWaiting();
    });

    expect(result.current.isBuffering).toBe(true);
    expect(result.current.loadingState).toBe('buffering');
  });

  it('should handle video can play events', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock video element
    const mockVideo = {
      buffered: { length: 0, end: () => 0 },
      duration: 10,
      networkState: 1,
      readyState: 3
    };

    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.handleVideoCanPlay();
    });

    expect(result.current.isBuffering).toBe(false);
    expect(result.current.loadingState).toBe('loaded');
  });

  it('should retry video load when retry is available', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock video element
    const mockVideo = {
      src: 'test.mp4',
      load: vi.fn()
    };

    (result.current.videoRef as any).current = mockVideo;

    // Create a mock error event to set up error state
    const mockEvent = {
      currentTarget: {
        error: {
          code: 2, // MEDIA_ERR_NETWORK
          message: 'Network error'
        },
        src: 'test.mp4',
        currentSrc: 'test.mp4',
        networkState: 3,
        readyState: 0
      }
    } as any;

    // First trigger an error to set up the error state
    act(() => {
      result.current.handleVideoError(mockEvent);
    });

    // Now test retry
    act(() => {
      result.current.retryVideoLoad();
    });

    expect(result.current.videoError).toBeNull();
    expect(result.current.loadingState).toBe('loading');
    expect(mockVideo.load).toHaveBeenCalled();
  });

  it('should not retry when retry is not available', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Set up error state without retry capability
    const mockError = {
      type: 'format' as const,
      message: 'Format not supported',
      canRetry: false,
      suggestions: ['Convert to MP4']
    };

    act(() => {
      result.current.videoError = mockError;
    });

    // Mock video element
    const mockVideo = {
      src: 'test.mp4',
      load: vi.fn()
    };

    (result.current.videoRef as any).current = mockVideo;

    act(() => {
      result.current.retryVideoLoad();
    });

    // Should not change state
    expect(result.current.videoError).toStrictEqual(mockError);
    expect(mockVideo.load).not.toHaveBeenCalled();
  });

  it('should clear video error', () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Create a mock error event to set up error state
    const mockEvent = {
      currentTarget: {
        error: {
          code: 2, // MEDIA_ERR_NETWORK
          message: 'Network error'
        },
        src: 'test.mp4',
        currentSrc: 'test.mp4',
        networkState: 3,
        readyState: 0
      }
    } as any;

    // First trigger an error to set up the error state
    act(() => {
      result.current.handleVideoError(mockEvent);
    });

    // Now test clear error
    act(() => {
      result.current.clearVideoError();
    });

    expect(result.current.videoError).toBeNull();
    expect(result.current.loadingState).toBe('idle');
  });

  it('should check codec compatibility', async () => {
    const { result } = renderHook(() => useVideoPlayback());

    // Mock the video element creation and events
    const mockVideo = {
      preload: 'metadata',
      src: '',
      load: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Mock document.createElement to return our mock video
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tagName) => {
      if (tagName === 'video') {
        return mockVideo;
      }
      return originalCreateElement.call(document, tagName);
    });

    // Mock successful codec check by triggering canplay event
    setTimeout(() => {
      const canPlayHandler = mockVideo.addEventListener.mock.calls.find(
        call => call[0] === 'canplay'
      )?.[1];
      if (canPlayHandler) {
        canPlayHandler();
      }
    }, 10);

    const isCompatible = await result.current.checkCodecCompatibility('test.mp4');
    
    expect(typeof isCompatible).toBe('boolean');
    expect(mockVideo.addEventListener).toHaveBeenCalledWith('canplay', expect.any(Function));
    expect(mockVideo.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));

    // Restore original createElement
    document.createElement = originalCreateElement;
  }, 10000);
});
