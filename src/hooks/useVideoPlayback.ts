import { useRef, useEffect, useState, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useTimelineStore } from '@/stores/timelineStore';
import { useMediaStore } from '@/stores/mediaStore';
import { TimelineClip } from '@/types';

// ============================================================================
// VIDEO PLAYBACK HOOK INTERFACE
// ============================================================================

// Video loading states
export type VideoLoadingState = 
  | 'idle'           // No video loaded
  | 'loading'        // Video is loading
  | 'loaded'         // Video loaded successfully
  | 'error'          // Video failed to load
  | 'buffering'      // Video is buffering
  | 'seeking';       // Video is seeking

// Video error types
export type VideoErrorType = 
  | 'network'        // Network error
  | 'decode'         // Decode error
  | 'format'         // Format not supported
  | 'codec'          // Codec not supported
  | 'unknown';       // Unknown error

export interface VideoError {
  type: VideoErrorType;
  message: string;
  code?: number;
  canRetry: boolean;
  suggestions: string[];
}

export interface VideoLoadingProgress {
  buffered: number;      // Amount buffered (0-1)
  duration: number;      // Total duration in seconds
  loaded: number;        // Amount loaded in seconds
  networkState: number;  // Network state code
  readyState: number;    // Ready state code
}

interface UseVideoPlaybackReturn {
  // Video element ref
  videoRef: React.RefObject<HTMLVideoElement | null>;
  
  // Playback state
  isVideoLoaded: boolean;
  currentClip: TimelineClip | null;
  videoError: VideoError | null;
  isMuted: boolean;
  
  // Enhanced loading states
  loadingState: VideoLoadingState;
  loadingProgress: VideoLoadingProgress;
  isBuffering: boolean;
  isSeeking: boolean;
  
  // Playback controls
  handleMuteToggle: (muted: boolean) => void;
  handleVideoLoad: () => void;
  handleVideoError: (event: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  handleTimeUpdate: () => void;
  handleVideoEnded: () => void;
  handleVideoLoadStart: () => void;
  handleVideoProgress: () => void;
  handleVideoSeeking: () => void;
  handleVideoSeeked: () => void;
  handleVideoWaiting: () => void;
  handleVideoCanPlay: () => void;
  handleVideoCanPlayThrough: () => void;
  
  // Video synchronization
  syncVideoWithTimeline: () => void;
  updateVideoSource: (clip: TimelineClip | null) => void;
  startSyncLoop: () => void;
  stopSyncLoop: () => void;
  getSyncLoopMetrics: () => {
    isRunning: boolean;
    frameCount: number;
    currentFps: number;
    lastUpdateTime: number;
    timeSinceLastUpdate: number;
  };
  forceSyncUpdate: () => void;
  
  // Error handling and recovery
  retryVideoLoad: () => void;
  clearVideoError: () => void;
  checkCodecCompatibility: (src: string) => Promise<boolean>;
}

// ============================================================================
// VIDEO PLAYBACK HOOK
// ============================================================================

/**
 * Custom hook for managing video playback state and timeline synchronization
 * 
 * This hook handles:
 * - Video element management
 * - Timeline synchronization
 * - Playback state management
 * - Error handling
 * - Video source updates
 */
export const useVideoPlayback = (): UseVideoPlaybackReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [currentClip, setCurrentClip] = useState<TimelineClip | null>(null);
  const [videoError, setVideoError] = useState<VideoError | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // Enhanced loading states
  const [loadingState, setLoadingState] = useState<VideoLoadingState>('idle');
  const [loadingProgress, setLoadingProgress] = useState<VideoLoadingProgress>({
    buffered: 0,
    duration: 0,
    loaded: 0,
    networkState: 0,
    readyState: 0
  });
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  
  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  // Timeline store
  const { 
    playhead, 
    isPlaying, 
    tracks,
    setPlayhead,
    pause,
  } = useTimelineStore();
  
  // Media store for getting video files
  const { getClipById } = useMediaStore();

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Create a detailed video error from a MediaError
   */
  const createVideoError = (error: MediaError | null, video: HTMLVideoElement): VideoError => {
    if (!error) {
      return {
        type: 'unknown',
        message: 'Unknown video error',
        canRetry: true,
        suggestions: ['Try refreshing the page', 'Check your internet connection']
      };
    }

    const errorType: VideoErrorType = 
      error.code === MediaError.MEDIA_ERR_NETWORK ? 'network' :
      error.code === MediaError.MEDIA_ERR_DECODE ? 'decode' :
      error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? 'format' :
      'unknown';

    const suggestions = getErrorSuggestions(errorType, video);
    
    return {
      type: errorType,
      message: error.message || 'Video playback error',
      code: error.code,
      canRetry: errorType !== 'format' && retryCount < maxRetries,
      suggestions: suggestions || []
    };
  };

  /**
   * Get suggestions for different error types
   */
  const getErrorSuggestions = (errorType: VideoErrorType, video: HTMLVideoElement): string[] => {
    const suggestions: string[] = [];
    
    switch (errorType) {
      case 'network':
        suggestions.push('Check your internet connection');
        suggestions.push('Try refreshing the page');
        suggestions.push('Check if the video file is accessible');
        break;
      case 'decode':
        suggestions.push('The video file may be corrupted');
        suggestions.push('Try a different video file');
        suggestions.push('Check if the video format is supported');
        break;
      case 'format':
        suggestions.push('This video format is not supported');
        suggestions.push('Try converting to MP4 format');
        suggestions.push('Check browser compatibility');
        break;
      case 'codec':
        suggestions.push('Video codec is not supported');
        suggestions.push('Try H.264 encoded video');
        suggestions.push('Update your browser');
        break;
      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Check your internet connection');
    }

    // Add format-specific suggestions
    const src = video.src || video.currentSrc;
    if (src) {
      const extension = src.split('.').pop()?.toLowerCase();
      if (extension && !['mp4', 'webm', 'ogg'].includes(extension)) {
        suggestions.push(`Consider converting ${extension.toUpperCase()} to MP4`);
      }
    }

    return suggestions;
  };

  /**
   * Check codec compatibility for a video source
   */
  const checkCodecCompatibility = useCallback(async (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      const handleCanPlay = () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        resolve(true);
      };
      
      const handleError = () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        resolve(false);
      };
      
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      
      video.src = src;
      video.load();
    });
  }, []);

  /**
   * Update loading progress from video element
   */
  const updateLoadingProgress = useCallback((video: HTMLVideoElement) => {
    const buffered = video.buffered;
    const duration = video.duration || 0;
    let loaded = 0;
    
    if (buffered.length > 0) {
      loaded = buffered.end(buffered.length - 1);
    }
    
    setLoadingProgress({
      buffered: duration > 0 ? loaded / duration : 0,
      duration,
      loaded,
      networkState: video.networkState,
      readyState: video.readyState
    });
  }, []);

  // ============================================================================
  // VIDEO SYNCHRONIZATION LOGIC
  // ============================================================================

  /**
   * Get the active clip at the current playhead position
   */
  const getActiveClipAtTime = useCallback((time: number): TimelineClip | null => {
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (time >= clip.startTime && time < clip.startTime + clip.duration) {
          return clip;
        }
      }
    }
    return null;
  }, [tracks]);

  /**
   * Get the next clip after a given time position (gap-skipping)
   */
  const getNextClipAfterTime = useCallback((time: number): TimelineClip | null => {
    let nextClip: TimelineClip | null = null;
    let earliestStartTime = Infinity;

    for (const track of tracks) {
      for (const clip of track.clips) {
        // Find clips that start after the given time
        if (clip.startTime > time && clip.startTime < earliestStartTime) {
          nextClip = clip;
          earliestStartTime = clip.startTime;
        }
      }
    }

    return nextClip;
  }, [tracks]);

  /**
   * Update video source when switching to a different clip
   * @param clip - The clip to load
   * @param targetPlayhead - Optional playhead time to seek to (for gap-skipping)
   */
  const updateVideoSource = useCallback((clip: TimelineClip | null, targetPlayhead?: number) => {
    if (clip) {
      const mediaClip = getClipById(clip.mediaClipId);
      if (mediaClip) {
        setCurrentClip(clip);
        setVideoError(null);

        // Only update video element if ref is available
        if (videoRef.current) {
          // Convert file path to URL using Tauri's convertFileSrc
          const videoUrl = convertFileSrc(mediaClip.filepath);
          videoRef.current.src = videoUrl;
          videoRef.current.load();
          
          // Calculate the time within the clip
          // Use targetPlayhead if provided (for gap-skipping), otherwise use current playhead
          const effectivePlayhead = targetPlayhead !== undefined ? targetPlayhead : playhead;
          const clipTime = effectivePlayhead - clip.startTime + clip.trimStart;
          videoRef.current.currentTime = Math.max(0, clipTime);
        }
      }
    } else {
      // No active clip, just pause video but keep source to show last frame
      setCurrentClip(null);
      if (videoRef.current) {
        videoRef.current.pause();
        // Keep the current source so the player shows the last frame
        // This avoids MEDIA_ERR_SRC_NOT_SUPPORTED errors and provides better UX
      }
    }
  }, [playhead, getClipById]);

  /**
   * Sync video with current timeline state with gap-skipping
   */
  const syncVideoWithTimeline = useCallback(() => {
    const activeClip = getActiveClipAtTime(playhead);
    
    if (activeClip && activeClip !== currentClip) {
      // Switch to new clip
      updateVideoSource(activeClip);
    } else if (!activeClip && currentClip) {
      // No clip at current position (was playing a clip) - implement gap skipping
      const nextClip = getNextClipAfterTime(playhead);
      
      if (nextClip) {
        // Jump to the start of the next clip
        setPlayhead(nextClip.startTime);
        // Pass the target playhead to avoid stale closure issues
        updateVideoSource(nextClip, nextClip.startTime);
      } else {
        // No more clips - clear video
        updateVideoSource(null);
      }
    } else if (!activeClip && !currentClip && isPlaying) {
      // No clip at current position and nothing loaded - find first available clip when starting playback
      const nextClip = getNextClipAfterTime(playhead - 0.01); // -0.01 to handle edge case at clip boundaries
      
      if (nextClip) {
        // Jump to the start of the next clip
        setPlayhead(nextClip.startTime);
        // Pass the target playhead to avoid stale closure issues
        updateVideoSource(nextClip, nextClip.startTime);
      }
      // If no clips exist at all, playback just won't start
    } else if (activeClip && activeClip === currentClip && videoRef.current) {
      // Same clip, but ensure video is at correct position
      const video = videoRef.current;
      const expectedClipTime = playhead - activeClip.startTime + activeClip.trimStart;
      const currentClipTime = video.currentTime;
      
      // Only seek if there's a significant difference (avoid constant seeking)
      if (Math.abs(expectedClipTime - currentClipTime) > 0.1) {
        video.currentTime = Math.max(0, expectedClipTime);
      }
    }
  }, [playhead, currentClip, isPlaying, getActiveClipAtTime, getNextClipAfterTime, updateVideoSource, setPlayhead]);

  // ============================================================================
  // PLAYBACK CONTROL HANDLERS
  // ============================================================================

  /**
   * Handle mute toggle
   */
  const handleMuteToggle = useCallback((muted: boolean) => {
    setIsMuted(muted);
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, []);

  /**
   * Handle video load start event
   */
  const handleVideoLoadStart = useCallback(() => {
    setLoadingState('loading');
    setVideoError(null);
    setIsVideoLoaded(false);
  }, []);

  /**
   * Handle video load event
   */
  const handleVideoLoad = useCallback(() => {
    setIsVideoLoaded(true);
    setVideoError(null);
    setLoadingState('loaded');
    setRetryCount(0);
    
    if (videoRef.current) {
      updateLoadingProgress(videoRef.current);
    }
  }, [updateLoadingProgress]);

  /**
   * Handle video error event
   */
  const handleVideoError = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = event.currentTarget;
    const error = video.error;
    
    console.error('Video error details:', {
      error,
      errorCode: error?.code,
      errorMessage: error?.message,
      videoSrc: video.src,
      videoCurrentSrc: video.currentSrc,
      networkState: video.networkState,
      readyState: video.readyState
    });
    
    const videoError = createVideoError(error, video);
    console.error('Video error:', videoError.message);
    
    setVideoError(videoError);
    setIsVideoLoaded(false);
    setLoadingState('error');
  }, [createVideoError]);

  /**
   * Handle video progress event
   */
  const handleVideoProgress = useCallback(() => {
    if (videoRef.current) {
      updateLoadingProgress(videoRef.current);
    }
  }, [updateLoadingProgress]);

  /**
   * Handle video seeking event
   */
  const handleVideoSeeking = useCallback(() => {
    setIsSeeking(true);
    setLoadingState('seeking');
  }, []);

  /**
   * Handle video seeked event
   */
  const handleVideoSeeked = useCallback(() => {
    setIsSeeking(false);
    setLoadingState(isVideoLoaded ? 'loaded' : 'loading');
  }, [isVideoLoaded]);

  /**
   * Handle video waiting event (buffering)
   */
  const handleVideoWaiting = useCallback(() => {
    setIsBuffering(true);
    setLoadingState('buffering');
  }, []);

  /**
   * Handle video can play event
   */
  const handleVideoCanPlay = useCallback(() => {
    setIsBuffering(false);
    setLoadingState('loaded');
    
    if (videoRef.current) {
      updateLoadingProgress(videoRef.current);
    }
  }, [updateLoadingProgress]);

  /**
   * Handle video can play through event
   */
  const handleVideoCanPlayThrough = useCallback(() => {
    setIsBuffering(false);
    setLoadingState('loaded');
    
    if (videoRef.current) {
      updateLoadingProgress(videoRef.current);
    }
  }, [updateLoadingProgress]);

  /**
   * Handle video time update - sync timeline with video playback
   * This is used as a fallback when requestAnimationFrame loop is not active
   */
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !currentClip || isPlaying) return;

    // Only handle time updates when not playing (seeking, scrubbing)
    // When playing, the requestAnimationFrame loop handles synchronization
    const video = videoRef.current;
    const clipTime = video.currentTime - currentClip.trimStart;
    const timelineTime = currentClip.startTime + clipTime;
    
    // Update timeline playhead with higher precision for seeking
    if (Math.abs(timelineTime - playhead) > 0.05) {
      setPlayhead(timelineTime);
    }
  }, [currentClip, playhead, setPlayhead, isPlaying]);

  /**
   * Handle video ended - move to next clip or end of timeline (with gap-skipping)
   */
  const handleVideoEnded = useCallback(() => {
    if (!currentClip) return;
    
    // Use gap-skipping to find the next clip after current one ends
    const nextClip = getNextClipAfterTime(currentClip.startTime + currentClip.duration - 0.01);
    if (nextClip) {
      setPlayhead(nextClip.startTime);
    } else {
      // End of timeline - pause playback
      pause();
      setPlayhead(currentClip.startTime + currentClip.duration);
    }
  }, [currentClip, getNextClipAfterTime, setPlayhead, pause]);

  // ============================================================================
  // REQUESTANIMATIONFRAME LOOP FOR SMOOTH SYNCHRONIZATION
  // ============================================================================

  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);

  /**
   * Smooth synchronization loop using requestAnimationFrame
   * This provides more responsive timeline updates during playback
   * with performance optimization and frame rate limiting
   */
  const startSyncLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Reset performance tracking
    lastUpdateTimeRef.current = performance.now();
    frameCountRef.current = 0;
    lastFpsTimeRef.current = performance.now();

    const syncLoop = (currentTime: number) => {
      if (!videoRef.current || !currentClip || !isPlaying) {
        animationFrameRef.current = null;
        return;
      }

      // Frame rate limiting - only update every 16ms (60fps max)
      const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
      if (timeSinceLastUpdate < 16) {
        animationFrameRef.current = requestAnimationFrame(syncLoop);
        return;
      }

      // Performance monitoring (optional)
      frameCountRef.current++;
      if (currentTime - lastFpsTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (currentTime - lastFpsTimeRef.current));
        if (fps < 30) {
          console.warn(`Video sync loop running at low FPS: ${fps}`);
        }
        frameCountRef.current = 0;
        lastFpsTimeRef.current = currentTime;
      }

      try {
        const video = videoRef.current;
        
        // Check if video is still valid and playing
        if (video.readyState < 2 || video.paused || video.ended) {
          animationFrameRef.current = null;
          return;
        }

        const clipTime = video.currentTime - currentClip.trimStart;
        const timelineTime = currentClip.startTime + clipTime;
        
        // Update timeline playhead with higher precision (0.05s threshold)
        if (Math.abs(timelineTime - playhead) > 0.05) {
          setPlayhead(timelineTime);
        }

        lastUpdateTimeRef.current = currentTime;
      } catch (error) {
        console.error('Error in video sync loop:', error);
        animationFrameRef.current = null;
        return;
      }

      // Continue the loop
      animationFrameRef.current = requestAnimationFrame(syncLoop);
    };

    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [currentClip, isPlaying, playhead, setPlayhead]);

  const stopSyncLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Get current performance metrics for the sync loop
   */
  const getSyncLoopMetrics = useCallback(() => {
    const now = performance.now();
    const timeSinceLastFps = now - lastFpsTimeRef.current;
    const currentFps = timeSinceLastFps > 0 ? 
      Math.round((frameCountRef.current * 1000) / timeSinceLastFps) : 0;
    
    return {
      isRunning: animationFrameRef.current !== null,
      frameCount: frameCountRef.current,
      currentFps,
      lastUpdateTime: lastUpdateTimeRef.current,
      timeSinceLastUpdate: now - lastUpdateTimeRef.current
    };
  }, []);

  /**
   * Force a sync update (useful for debugging or manual control)
   */
  const forceSyncUpdate = useCallback(() => {
    if (!videoRef.current || !currentClip) return;

    try {
      const video = videoRef.current;
      const clipTime = video.currentTime - currentClip.trimStart;
      const timelineTime = currentClip.startTime + clipTime;
      
      if (Math.abs(timelineTime - playhead) > 0.01) {
        setPlayhead(timelineTime);
      }
    } catch (error) {
      console.error('Error in force sync update:', error);
    }
  }, [currentClip, playhead, setPlayhead]);

  // ============================================================================
  // ERROR HANDLING AND RECOVERY
  // ============================================================================

  /**
   * Retry video load after an error
   */
  const retryVideoLoad = useCallback(() => {
    if (!videoRef.current || !videoError?.canRetry) return;

    setRetryCount(prev => prev + 1);
    setVideoError(null);
    setLoadingState('loading');
    
    const video = videoRef.current;
    const currentSrc = video.src;
    
    // Force reload by clearing and setting src again
    video.removeAttribute('src');
    video.load();
    
    setTimeout(() => {
      video.src = currentSrc;
      video.load();
    }, 100);
  }, [videoError]);

  /**
   * Clear video error and reset state
   */
  const clearVideoError = useCallback(() => {
    setVideoError(null);
    setLoadingState('idle');
    setRetryCount(0);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Sync video with timeline when playhead changes
  useEffect(() => {
    syncVideoWithTimeline();
  }, [syncVideoWithTimeline]);

  // Sync video playback with timeline state
  useEffect(() => {
    if (!videoRef.current || !currentClip) return;


    if (isPlaying) {
      videoRef.current.play().catch((error) => {
        console.error('Failed to play video:', error);
        setVideoError({
          type: 'unknown',
          message: 'Failed to play video',
          canRetry: true,
          suggestions: ['Try refreshing the page', 'Check if the video file is accessible']
        });
        pause(); // Pause timeline if video fails
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, currentClip, pause]);

  // Start/stop sync loop based on playback state
  useEffect(() => {
    if (isPlaying && currentClip) {
      startSyncLoop();
    } else {
      stopSyncLoop();
    }

    return () => {
      stopSyncLoop();
    };
  }, [isPlaying, currentClip, startSyncLoop, stopSyncLoop]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      stopSyncLoop();
    };
  }, [stopSyncLoop]);

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    // Video element ref
    videoRef,
    
    // Playback state
    isVideoLoaded,
    currentClip,
    videoError,
    isMuted,
    
    // Enhanced loading states
    loadingState,
    loadingProgress,
    isBuffering,
    isSeeking,
    
    // Playback controls
    handleMuteToggle,
    handleVideoLoad,
    handleVideoError,
    handleTimeUpdate,
    handleVideoEnded,
    handleVideoLoadStart,
    handleVideoProgress,
    handleVideoSeeking,
    handleVideoSeeked,
    handleVideoWaiting,
    handleVideoCanPlay,
    handleVideoCanPlayThrough,
    
    // Video synchronization
    syncVideoWithTimeline,
    updateVideoSource,
    startSyncLoop,
    stopSyncLoop,
    getSyncLoopMetrics,
    forceSyncUpdate,
    
    // Error handling and recovery
    retryVideoLoad,
    clearVideoError,
    checkCodecCompatibility,
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the active clip at a specific time across all tracks
 */
export const getActiveClipAtTime = (time: number, tracks: any[]): TimelineClip | null => {
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (time >= clip.startTime && time < clip.startTime + clip.duration) {
        return clip;
      }
    }
  }
  return null;
};

/**
 * Calculate the time within a clip based on timeline position
 */
export const calculateClipTime = (timelineTime: number, clip: TimelineClip): number => {
  return Math.max(0, timelineTime - clip.startTime + clip.trimStart);
};

/**
 * Calculate the timeline time based on video currentTime and clip info
 */
export const calculateTimelineTime = (videoTime: number, clip: TimelineClip): number => {
  return clip.startTime + videoTime - clip.trimStart;
};

/**
 * Calculate the video time based on timeline time and clip info
 */
export const calculateVideoTime = (timelineTime: number, clip: TimelineClip): number => {
  return Math.max(0, timelineTime - clip.startTime + clip.trimStart);
};

/**
 * Check if a timeline time is within a clip's bounds
 */
export const isTimeInClip = (timelineTime: number, clip: TimelineClip): boolean => {
  return timelineTime >= clip.startTime && timelineTime < clip.startTime + clip.duration;
};

/**
 * Get the time within a clip for a given timeline time
 */
export const getTimeWithinClip = (timelineTime: number, clip: TimelineClip): number => {
  if (!isTimeInClip(timelineTime, clip)) return 0;
  return Math.max(0, timelineTime - clip.startTime + clip.trimStart);
};

/**
 * Performance monitoring utilities for video sync
 */
export const createPerformanceMonitor = () => {
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;

  const update = () => {
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastTime));
      frameCount = 0;
      lastTime = now;
    }
    return fps;
  };

  const getMetrics = () => ({
    fps,
    frameCount,
    isRunning: frameCount > 0
  });

  return { update, getMetrics };
};
