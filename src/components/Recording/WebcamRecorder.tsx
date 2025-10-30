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
  // RENDER
  // ========================================================================
  
  return (
    <div className="webcam-recorder">
      {/* Camera Preview - hide during recording since store manages its own stream */}
      {!isRecording && (
        <CameraPreview
          recordingType="webcam"
          disabled={false}
        />
      )}

      <div className="webcam-recorder-controls">
        <button
          className={`webcam-recorder-button ${isRecording ? 'webcam-recorder-button-stop' : 'webcam-recorder-button-start'}`}
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isRecording ? false : !settings.cameraId || !!recordingError}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
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
    </div>
  );
};

export default WebcamRecorder;
