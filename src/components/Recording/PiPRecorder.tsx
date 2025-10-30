/**
 * PiPRecorder Component
 * 
 * Handles Picture-in-Picture recording by combining screen recording (Rust/AVFoundation)
 * with webcam recording (frontend/getUserMedia). This component orchestrates both
 * recording approaches to create a unified PiP recording experience.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { useWebcamRecording } from '@/hooks/useWebcamRecording';
import { WebcamRecorder as WebcamRecorderUtil } from '@/utils/recordingUtils';
import { PiPRecordingSettings, AppError, createAppError } from '@/types';
import './PiPRecorder.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface PiPRecorderProps {
  settings: PiPRecordingSettings;
  onRecordingStart?: () => void;
  onRecordingStop?: (filePath: string) => void;
  onError?: (error: AppError) => void;
}

export type { PiPRecorderProps };

// ============================================================================
// PIP RECORDER COMPONENT
// ============================================================================

export const PiPRecorder: React.FC<PiPRecorderProps> = ({
  settings,
  onRecordingStart,
  onRecordingStop,
  onError,
}) => {
  // ========================================================================
  // HOOKS
  // ========================================================================
  
  const { startRecording: startScreenRecording, stopRecording: stopScreenRecording } = useRecordingStore();
  const {
    stream: webcamStream,
    isStreamActive: isWebcamActive,
    startPreview: startWebcamPreview,
    stopPreview: stopWebcamPreview,
    error: webcamError,
    availableCameras,
    enumerateCameras,
  } = useWebcamRecording();

  // ========================================================================
  // STATE
  // ========================================================================
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<AppError | null>(null);
  const [screenSessionId, setScreenSessionId] = useState<string | null>(null);
  const [webcamRecorder, setWebcamRecorder] = useState<WebcamRecorderUtil | null>(null);
  const [combinedFilePath, setCombinedFilePath] = useState<string | null>(null);

  // Refs for cleanup
  const isMountedRef = useRef(true);
  const webcamChunksRef = useRef<Blob[]>([]);

  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (webcamRecorder) {
        webcamRecorder.cleanup();
      }
    };
  }, [webcamRecorder]);

  // Handle webcam errors
  useEffect(() => {
    if (webcamError) {
      const error = createAppError(
        'WEBCAM_RECORDING_ERROR',
        'Webcam recording error',
        webcamError.message
      );
      setRecordingError(error);
      onError?.(error);
    }
  }, [webcamError, onError]);

  // Initialize webcam recorder when stream is available
  useEffect(() => {
    if (webcamStream && !webcamRecorder) {
      const recorder = new WebcamRecorderUtil({
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });
      
      recorder.initialize(webcamStream).then(() => {
        if (isMountedRef.current) {
          setWebcamRecorder(recorder);
        }
      }).catch((error) => {
        const appError = createAppError(
          'recording',
          'Failed to initialize webcam recorder',
          error.message
        );
        setRecordingError(appError);
        onError?.(appError);
      });
    }
  }, [webcamStream, webcamRecorder, onError]);

  // ========================================================================
  // RECORDING FUNCTIONS
  // ========================================================================
  
  const startPiPRecording = async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);
      setRecordingError(null);
      webcamChunksRef.current = [];

      // Enumerate cameras first if not already done
      if (availableCameras.length === 0) {
        await enumerateCameras();
      }

      // Start webcam preview if not already active
      if (!isWebcamActive) {
        await startWebcamPreview();
      }

      // Wait for webcam recorder to be ready
      if (!webcamRecorder) {
        throw new Error('Webcam recorder not initialized');
      }

      // Start screen recording (Backend/AVFoundation)
      const screenSettings = {
        type: 'screen' as const,
        screenId: settings.screenId,
        quality: settings.quality,
        frameRate: settings.frameRate,
        audioEnabled: settings.audioEnabled,
        captureArea: settings.captureArea,
      };

      const screenResult = await startScreenRecording(screenSettings);
      setScreenSessionId(screenResult.sessionId);

      // Start webcam recording (Frontend/Web APIs)
      webcamRecorder.onDataAvailable = (chunk: Blob) => {
        webcamChunksRef.current.push(chunk);
      };

      webcamRecorder.onError = (error: Error) => {
        const appError = createAppError(
          'recording',
          'Webcam recording error',
          error.message
        );
        setRecordingError(appError);
        onError?.(appError);
      };

      await webcamRecorder.startRecording();

      onRecordingStart?.();

    } catch (error) {
      const appError = createAppError(
        'recording',
        'Failed to start PiP recording',
        error instanceof Error ? error.message : 'Unknown error'
      );
      setRecordingError(appError);
      onError?.(appError);
      setIsRecording(false);
    }
  };

  const stopPiPRecording = async () => {
    if (!isRecording) return;

    try {
      // Stop webcam recording
      if (webcamRecorder) {
        await webcamRecorder.stopRecording();
      }

      // Stop screen recording
      if (screenSessionId) {
        await stopScreenRecording(screenSessionId);
      }

      // Combine recordings if we have webcam data
      if (webcamChunksRef.current.length > 0) {
        const combinedBlob = new Blob(webcamChunksRef.current, { type: 'video/webm' });
        const combinedUrl = URL.createObjectURL(combinedBlob);
        setCombinedFilePath(combinedUrl);
        onRecordingStop?.(combinedUrl);
      }

      setIsRecording(false);
      setScreenSessionId(null);
      webcamChunksRef.current = [];

    } catch (error) {
      const appError = createAppError(
        'PIP_RECORDING_STOP_FAILED',
        'Failed to stop PiP recording',
        error instanceof Error ? error.message : 'Unknown error'
      );
      setRecordingError(appError);
      onError?.(appError);
    }
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getStatusMessage = () => {
    if (recordingError) return `Error: ${recordingError.message}`;
    if (isRecording) return 'Recording PiP...';
    if (!webcamRecorder) return 'Initializing webcam...';
    return 'Ready to record';
  };

  const getStatusIcon = () => {
    if (recordingError) return '⚠️';
    if (isRecording) return '🔴';
    if (!webcamRecorder) return '⏳';
    return '✅';
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <div className="pip-recorder">
      <div className="pip-recorder-header">
        <h3 className="pip-recorder-title">Picture-in-Picture Recording</h3>
        <div className="pip-recorder-status">
          <span className="pip-recorder-status-icon">{getStatusIcon()}</span>
          <span className="pip-recorder-status-message">{getStatusMessage()}</span>
        </div>
      </div>

      <div className="pip-recorder-controls">
        <button
          className={`pip-recorder-button ${isRecording ? 'pip-recorder-button-stop' : 'pip-recorder-button-start'}`}
          onClick={isRecording ? stopPiPRecording : startPiPRecording}
          disabled={!webcamRecorder && !recordingError}
        >
          <span className="pip-recorder-button-icon">
            {isRecording ? '⏹️' : '🔴'}
          </span>
          <span className="pip-recorder-button-text">
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </span>
        </button>
      </div>

      {recordingError && (
        <div className="pip-recorder-error">
          <span className="pip-recorder-error-icon">⚠️</span>
          <span className="pip-recorder-error-message">
            {recordingError.message}
          </span>
        </div>
      )}

      {isRecording && (
        <div className="pip-recorder-indicator">
          <div className="pip-recorder-indicator-dot"></div>
          <span className="pip-recorder-indicator-text">Recording in progress...</span>
        </div>
      )}

      <div className="pip-recorder-info">
        <div className="pip-recorder-info-item">
          <span className="pip-recorder-info-label">Screen:</span>
          <span className="pip-recorder-info-value">{settings.screenId}</span>
        </div>
        <div className="pip-recorder-info-item">
          <span className="pip-recorder-info-label">Camera:</span>
          <span className="pip-recorder-info-value">{settings.cameraId}</span>
        </div>
        <div className="pip-recorder-info-item">
          <span className="pip-recorder-info-label">Position:</span>
          <span className="pip-recorder-info-value">{settings.pipPosition}</span>
        </div>
        <div className="pip-recorder-info-item">
          <span className="pip-recorder-info-label">Size:</span>
          <span className="pip-recorder-info-value">{settings.pipSize}</span>
        </div>
      </div>
    </div>
  );
};

export default PiPRecorder;
