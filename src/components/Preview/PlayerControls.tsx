import React, { useState, useRef, useEffect } from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import { formatTimeShort } from '@/utils/timeFormat';
import './PlayerControls.css';

// ============================================================================
// PLAYER CONTROLS COMPONENT
// ============================================================================

interface PlayerControlsProps {
  className?: string;
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: (muted: boolean) => void;
}

export type { PlayerControlsProps };

export const PlayerControls: React.FC<PlayerControlsProps> = ({ 
  className = '',
  onVolumeChange,
  onMuteToggle
}) => {
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  
  // Timeline store
  const {
    playhead,
    isPlaying,
    tracks,
    togglePlayback,
    seekToStart,
    seekToEnd,
    skipForward,
    skipBackward,
    setPlayhead
  } = useTimelineStore();

  // ============================================================================
  // TIMELINE DURATION CALCULATION
  // ============================================================================

  const getTimelineDuration = (): number => {
    let maxEndTime = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const clipEndTime = clip.startTime + clip.duration;
        if (clipEndTime > maxEndTime) {
          maxEndTime = clipEndTime;
        }
      }
    }
    return maxEndTime;
  };

  const timelineDuration = getTimelineDuration();
  const hasContent = timelineDuration > 0;

  // ============================================================================
  // VOLUME CONTROL HANDLERS
  // ============================================================================

  const handleVolumeChange = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    onVolumeChange?.(clampedVolume);
    
    // Update muted state
    if (clampedVolume === 0 && !isMuted) {
      setIsMuted(true);
      onMuteToggle?.(true);
    } else if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
      onMuteToggle?.(false);
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    onMuteToggle?.(newMuted);
    
    if (newMuted) {
      setVolume(0);
      onVolumeChange?.(0);
    } else {
      // Restore to previous volume or default
      const restoredVolume = volume === 0 ? 0.8 : volume;
      setVolume(restoredVolume);
      onVolumeChange?.(restoredVolume);
    }
  };

  const handleVolumeSliderClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeSliderRef.current) return;
    
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newVolume = percentage;
    
    handleVolumeChange(newVolume);
  };

  const handleVolumeSliderMouseDown = () => {
    setIsDragging(true);
  };

  const handleVolumeSliderMouseMove = (event: MouseEvent) => {
    if (!isDragging || !volumeSliderRef.current) return;
    
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
    const newVolume = percentage;
    
    handleVolumeChange(newVolume);
  };

  const handleVolumeSliderMouseUp = () => {
    setIsDragging(false);
  };

  // Volume slider mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleVolumeSliderMouseMove);
      document.addEventListener('mouseup', handleVolumeSliderMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleVolumeSliderMouseMove);
        document.removeEventListener('mouseup', handleVolumeSliderMouseUp);
      };
    }
  }, [isDragging]);

  // ============================================================================
  // SEEK HANDLERS
  // ============================================================================

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!hasContent) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * timelineDuration;
    
    setPlayhead(newTime);
  };

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when no input is focused
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
        case 'KeyM':
          event.preventDefault();
          handleMuteToggle();
          break;
        case 'ArrowUp':
          event.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, skipBackward, skipForward, seekToStart, seekToEnd, handleMuteToggle, volume]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const progressPercentage = hasContent ? (playhead / timelineDuration) * 100 : 0;

  return (
    <div className={`player-controls ${className}`}>
      {/* Main Controls Row */}
      <div className="controls-row">
        {/* Play/Pause Button */}
        <button
          className="control-button play-button"
          onClick={togglePlayback}
          disabled={!hasContent}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Time Display */}
        <div className="time-display">
          <span className="current-time">
            {formatTimeShort(playhead)}
          </span>
          <span className="time-separator">/</span>
          <span className="total-time">
            {formatTimeShort(timelineDuration)}
          </span>
        </div>

        {/* Skip Buttons */}
        <div className="skip-buttons">
          <button
            className="control-button skip-button"
            onClick={() => skipBackward(5)}
            disabled={!hasContent}
            aria-label="Skip backward 5 seconds"
          >
            <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 18V6l-5.5 5.5L4 10l8-8 8 8-1.5 1.5L13 6v12z"/>
            </svg>
            <span className="skip-text">5</span>
          </button>
          
          <button
            className="control-button skip-button"
            onClick={() => skipForward(5)}
            disabled={!hasContent}
            aria-label="Skip forward 5 seconds"
          >
            <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 6v12l5.5-5.5L20 14l-8 8-8-8 1.5-1.5L11 18V6z"/>
            </svg>
            <span className="skip-text">5</span>
          </button>
        </div>

        {/* Volume Control */}
        <div className="volume-control">
          <button
            className="control-button volume-button"
            onClick={handleMuteToggle}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : volume < 0.5 ? (
              <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            ) : (
              <svg className="control-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>

          {/* Volume Slider */}
          <div
            className={`volume-slider ${showVolumeSlider ? 'visible' : ''}`}
            ref={volumeSliderRef}
            onClick={handleVolumeSliderClick}
            onMouseDown={handleVolumeSliderMouseDown}
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <div className="volume-track">
              <div 
                className="volume-fill" 
                style={{ width: `${volume * 100}%` }}
              />
              <div 
                className="volume-thumb" 
                style={{ left: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timeline Duration */}
        <div className="timeline-info">
          {hasContent ? (
            <span className="timeline-duration">
              {formatTimeShort(timelineDuration)}
            </span>
          ) : (
            <span className="no-content">No content</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div 
        className="progress-bar"
        onClick={handleSeek}
        role="progressbar"
        aria-valuenow={playhead}
        aria-valuemin={0}
        aria-valuemax={timelineDuration}
        aria-label="Timeline progress"
      >
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          />
          <div 
            className="progress-thumb" 
            style={{ left: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
