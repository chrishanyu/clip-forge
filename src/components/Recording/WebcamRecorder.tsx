/**
 * WebcamRecorder Component
 * 
 * Simple UI component for webcam recording. All recording logic is now managed
 * at the app-level in the recording store, so recordings persist even if this
 * component unmounts.
 */

import React from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { WebcamRecordingSettings, AppError } from '@/types';
import { CameraPreview } from './CameraPreview';
import './WebcamRecorder.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface WebcamRecorderProps {
  settings: WebcamRecordingSettings;
  onRecordingStart?: () => void;
  onRecordingStop?: (filePath: string) => void;
  onError?: (error: AppError) => void;
}

export type { WebcamRecorderProps };

// ============================================================================
// WEBCAM RECORDER COMPONENT
// ============================================================================

export const WebcamRecorder: React.FC<WebcamRecorderProps> = ({
  settings,
  onRecordingStart,
  onRecordingStop,
  onError,
}) => {
  // Get recording state and actions from store
  const { currentSession, error, startWebcamRecording, stopWebcamRecording } = useRecordingStore();
  
  const isRecording = currentSession?.type === 'webcam' && currentSession?.status === 'recording';
  const recordingDuration = currentSession?.duration || 0;
  const recordingError = error;

  // ========================================================================
  // HANDLERS
  // ========================================================================
  
  const handleStartRecording = async () => {
    await startWebcamRecording(settings);
    onRecordingStart?.();
  };

  const handleStopRecording = async () => {
    await stopWebcamRecording();
    onRecordingStop?.(''); // FilePath will be auto-imported to media library
  };

  // Notify parent of errors
  React.useEffect(() => {
    if (recordingError && onError) {
      onError(recordingError);
    }
  }, [recordingError, onError]);

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    if (recordingError) return `Error: ${recordingError.message}`;
    if (isRecording) return `Recording... ${formatDuration(recordingDuration)}`;
    return 'Ready to record';
  };

  const getStatusIcon = () => {
    if (recordingError) return '⚠️';
    if (isRecording) return '🔴';
    return '✅';
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <div className="webcam-recorder">
      {/* Camera Preview - hide during recording since store manages its own stream */}
      {!isRecording && (
        <div className="webcam-recorder-preview">
          <CameraPreview
            recordingType="webcam"
            disabled={false}
          />
        </div>
      )}

      <div className="webcam-recorder-header">
        <h3 className="webcam-recorder-title">Webcam Recording</h3>
        <div className="webcam-recorder-status">
          <span className="webcam-recorder-status-icon">{getStatusIcon()}</span>
          <span className="webcam-recorder-status-message">{getStatusMessage()}</span>
        </div>
      </div>

      <div className="webcam-recorder-controls">
        <button
          className={`webcam-recorder-button ${isRecording ? 'webcam-recorder-button-stop' : 'webcam-recorder-button-start'}`}
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isRecording ? false : !settings.cameraId || !!recordingError}
        >
          <span className="webcam-recorder-button-icon">
            {isRecording ? '⏹️' : '🔴'}
          </span>
          <span className="webcam-recorder-button-text">
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </span>
        </button>
      </div>

      {recordingError && (
        <div className="webcam-recorder-error">
          <span className="webcam-recorder-error-icon">⚠️</span>
          <span className="webcam-recorder-error-message">
            {recordingError.message}
          </span>
        </div>
      )}

      {isRecording && (
        <div className="webcam-recorder-indicator">
          <div className="webcam-recorder-indicator-dot"></div>
          <span className="webcam-recorder-indicator-text">Recording in progress...</span>
        </div>
      )}

      <div className="webcam-recorder-info">
        <div className="webcam-recorder-info-item">
          <span className="webcam-recorder-info-label">Camera:</span>
          <span className="webcam-recorder-info-value">{settings.cameraId}</span>
        </div>
        <div className="webcam-recorder-info-item">
          <span className="webcam-recorder-info-label">Quality:</span>
          <span className="webcam-recorder-info-value">{settings.quality}</span>
        </div>
        <div className="webcam-recorder-info-item">
          <span className="webcam-recorder-info-label">Audio:</span>
          <span className="webcam-recorder-info-value">{settings.audioEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        {isRecording && (
          <div className="webcam-recorder-info-item">
            <span className="webcam-recorder-info-label">Duration:</span>
            <span className="webcam-recorder-info-value">{formatDuration(recordingDuration)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebcamRecorder;
