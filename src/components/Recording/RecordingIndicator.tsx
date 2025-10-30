/**
 * RecordingIndicator Component
 * 
 * Floating overlay that displays during active recording sessions.
 * Shows recording status, duration, and provides quick access to stop recording.
 */

import React, { useEffect, useState } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { formatRecordingDuration } from '@/types';
import './RecordingIndicator.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface RecordingIndicatorProps {
  isVisible: boolean;
  onStopRecording?: () => void;
  onMinimize?: () => void;
}

export type { RecordingIndicatorProps };

// ============================================================================
// RECORDING INDICATOR COMPONENT
// ============================================================================

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isVisible,
  onStopRecording,
  onMinimize,
}) => {
  // ========================================================================
  // STORE HOOKS
  // ========================================================================
  
  const {
    currentSession,
    progress,
    stopRecording,
  } = useRecordingStore();

  // ========================================================================
  // LOCAL STATE
  // ========================================================================
  
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  // Update duration from progress or calculate from session start time
  useEffect(() => {
    if (progress?.duration) {
      setDuration(progress.duration);
    } else if (currentSession?.startTime) {
      const startTime = new Date(currentSession.startTime).getTime();
      const now = Date.now();
      setDuration(Math.floor((now - startTime) / 1000));
    }
  }, [progress?.duration, currentSession?.startTime]);

  // Update duration every second when recording
  useEffect(() => {
    if (!isVisible || !currentSession || currentSession.status !== 'recording') {
      return;
    }

    const interval = setInterval(() => {
      if (currentSession.startTime) {
        const startTime = new Date(currentSession.startTime).getTime();
        const now = Date.now();
        setDuration(Math.floor((now - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, currentSession]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  const handleStopRecording = async () => {
    try {
      // For webcam recordings, use the store's stopWebcamRecording
      if (currentSession?.type === 'webcam') {
        await useRecordingStore.getState().stopWebcamRecording();
        onStopRecording?.();
        return;
      }
      
      // For screen/PiP recordings, use the store's stopRecording
      await stopRecording();
      onStopRecording?.();
    } catch (error) {
      console.error('❌ [RecordingIndicator] Failed to stop recording:', error);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
    onMinimize?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleMinimize();
    }
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getRecordingTypeLabel = () => {
    if (!currentSession) return 'Recording';
    
    switch (currentSession.type) {
      case 'screen': return 'Screen Recording';
      case 'webcam': return 'Webcam Recording';
      case 'pip': return 'Screen + Webcam Recording';
      default: return 'Recording';
    }
  };

  const getFileSize = () => {
    if (progress?.fileSize) {
      const mb = (progress.fileSize / (1024 * 1024)).toFixed(1);
      return `${mb} MB`;
    }
    return '';
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  if (!isVisible || !currentSession) {
    return null;
  }

  return (
    <div 
      className={`recording-indicator ${isMinimized ? 'recording-indicator-minimized' : ''}`}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Recording indicator"
    >
      {/* Main Content */}
      <div className="recording-indicator-content">
        {/* Recording Status */}
        <div className="recording-indicator-status">
          <div className="recording-indicator-dot"></div>
          <span className="recording-indicator-label">
            {getRecordingTypeLabel()}
          </span>
        </div>

        {/* Duration and File Size */}
        <div className="recording-indicator-info">
          <span className="recording-indicator-duration">
            {formatRecordingDuration(duration)}
          </span>
          {getFileSize() && (
            <span className="recording-indicator-filesize">
              {getFileSize()}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="recording-indicator-controls">
          <button
            className="recording-indicator-minimize"
            onClick={handleMinimize}
            title={isMinimized ? 'Expand' : 'Minimize'}
            aria-label={isMinimized ? 'Expand recording indicator' : 'Minimize recording indicator'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          
          <button
            className="recording-indicator-stop"
            onClick={handleStopRecording}
            title="Stop Recording"
            aria-label="Stop recording"
          >
            <span className="recording-indicator-stop-icon">⏹️</span>
            <span className="recording-indicator-stop-text">Stop</span>
          </button>
        </div>
      </div>

      {/* Minimized State */}
      {isMinimized && (
        <div className="recording-indicator-minimized-content">
          <div className="recording-indicator-minimized-dot"></div>
          <span className="recording-indicator-minimized-duration">
            {formatRecordingDuration(duration)}
          </span>
        </div>
      )}
    </div>
  );
};

export default RecordingIndicator;
