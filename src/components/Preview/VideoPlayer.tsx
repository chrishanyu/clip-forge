import React, { useEffect } from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { PlayerControls } from './PlayerControls';
import './VideoPlayer.css';

// ============================================================================
// VIDEO PLAYER COMPONENT
// ============================================================================

interface VideoPlayerProps {
  className?: string;
}

export type { VideoPlayerProps };

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ className = '' }) => {
  // Use the video playback hook for all video-related logic
  const {
    videoRef,
    currentClip,
    videoError,
    isMuted,
    loadingState,
    loadingProgress,
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
    retryVideoLoad,
    clearVideoError,
  } = useVideoPlayback();
  
  // Timeline store for keyboard shortcuts
  const { 
    togglePlayback,
    seekToStart,
    seekToEnd,
    skipForward,
    skipBackward
  } = useTimelineStore();

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when video player is focused or no input is focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayback();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          skipBackward(5);
          break;
        case 'ArrowRight':
          event.preventDefault();
          skipForward(5);
          break;
        case 'Home':
          event.preventDefault();
          seekToStart();
          break;
        case 'End':
          event.preventDefault();
          seekToEnd();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, skipBackward, skipForward, seekToStart, seekToEnd]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const renderVideoContent = () => {
    if (videoError) {
      return (
        <div className="video-error">
          <div className="error-icon">⚠</div>
          <div className="error-message">{videoError.message}</div>
          <div className="error-type">Error Type: {videoError.type}</div>
          {videoError.suggestions && videoError.suggestions.length > 0 && (
            <div className="error-suggestions">
              <div className="suggestions-title">Suggestions:</div>
              <ul className="suggestions-list">
                {videoError.suggestions.map((suggestion, index) => (
                  <li key={index} className="suggestion-item">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="error-actions">
            {videoError.canRetry && (
              <button 
                className="retry-button"
                onClick={retryVideoLoad}
              >
                Retry
              </button>
            )}
            <button 
              className="dismiss-button"
              onClick={clearVideoError}
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    // Always render the video element, but show placeholder overlay when no clip
    return (
      <>
        <video
          ref={videoRef}
          className="video-element"
          onLoadStart={handleVideoLoadStart}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onProgress={handleVideoProgress}
          onSeeking={handleVideoSeeking}
          onSeeked={handleVideoSeeked}
          onWaiting={handleVideoWaiting}
          onCanPlay={handleVideoCanPlay}
          onCanPlayThrough={handleVideoCanPlayThrough}
          preload="metadata"
          playsInline
          muted={isMuted}
        />
        {!currentClip && (
          <div className="video-placeholder">
            <div className="placeholder-icon">🎬</div>
            <div className="placeholder-text">No video selected</div>
            <div className="placeholder-subtext">Add clips to the timeline to start editing</div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={`video-player ${className}`}>
      <div className="video-container">
        {renderVideoContent()}
        
        {/* Loading overlay */}
        {currentClip && loadingState !== 'loaded' && !videoError && (
          <div className="video-loading">
            <div className="loading-spinner" />
            <div className="loading-text">
              {loadingState === 'loading' && 'Loading video...'}
              {loadingState === 'buffering' && 'Buffering...'}
              {loadingState === 'seeking' && 'Seeking...'}
            </div>
            {loadingProgress.duration > 0 && (
              <div className="loading-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${loadingProgress.buffered * 100}%` }}
                  />
                </div>
                <div className="progress-text">
                  {Math.round(loadingProgress.buffered * 100)}% loaded
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Player Controls */}
      <PlayerControls
        onMuteToggle={handleMuteToggle}
      />
    </div>
  );
};
