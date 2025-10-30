/**
 * WebcamRecorder Component
 * 
 * Handles webcam recording using Web APIs (getUserMedia + MediaRecorder).
 * This component provides a complete webcam recording workflow that integrates
 * with the media library and recording store.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { useWebcamRecording } from '@/hooks/useWebcamRecording';
import { WebcamRecorder as WebcamRecorderUtil } from '@/utils/recordingUtils';
import { WebcamRecordingSettings, AppError, createAppError } from '@/types';
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
  const [webcamRecorder, setWebcamRecorder] = useState<WebcamRecorderUtil | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const [screenSessionId, setScreenSessionId] = useState<string | null>(null);

  // Refs for cleanup and recording
  const isMountedRef = useRef(true);
  const webcamChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
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
        videoBitsPerSecond: getVideoBitrate(settings.quality),
        audioBitsPerSecond: settings.audioEnabled ? 128000 : 0,
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
  }, [webcamStream, webcamRecorder, settings.quality, settings.audioEnabled, onError]);

  // ========================================================================
  // RECORDING FUNCTIONS
  // ========================================================================
  
  const startWebcamRecording = async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);
      setRecordingError(null);
      setRecordingDuration(0);
      setFileSize(0);
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

      // Start webcam recording (Frontend/Web APIs)
      webcamRecorder.onDataAvailable = (chunk: Blob) => {
        webcamChunksRef.current.push(chunk);
        setFileSize(prev => prev + chunk.size);
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

      // Start duration tracking
      recordingIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setRecordingDuration(prev => prev + 1);
        }
      }, 1000);

      onRecordingStart?.();

    } catch (error) {
      const appError = createAppError(
        'recording',
        'Failed to start webcam recording',
        error instanceof Error ? error.message : 'Unknown error'
      );
      setRecordingError(appError);
      onError?.(appError);
      setIsRecording(false);
    }
  };

  const stopWebcamRecording = async () => {
    if (!isRecording) return;

    try {
      // Stop duration tracking
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Stop webcam recording
      if (webcamRecorder) {
        await webcamRecorder.stopRecording();
      }

      // Create final video file
      if (webcamChunksRef.current.length > 0) {
        const finalBlob = new Blob(webcamChunksRef.current, { type: 'video/webm' });
        const fileUrl = URL.createObjectURL(finalBlob);
        
        // Create a download link for the file
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `webcam_recording_${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        onRecordingStop?.(fileUrl);
      }

      setIsRecording(false);
      setRecordingDuration(0);
      setFileSize(0);
      webcamChunksRef.current = [];

    } catch (error) {
      const appError = createAppError(
        'WEBCAM_RECORDING_STOP_FAILED',
        'Failed to stop webcam recording',
        error instanceof Error ? error.message : 'Unknown error'
      );
      setRecordingError(appError);
      onError?.(appError);
    }
  };

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================
  
  const getVideoBitrate = (quality: string): number => {
    switch (quality) {
      case 'low': return 1000000;    // 1 Mbps
      case 'medium': return 2500000; // 2.5 Mbps
      case 'high': return 5000000;   // 5 Mbps
      default: return 2500000;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getStatusMessage = () => {
    if (recordingError) return `Error: ${recordingError.message}`;
    if (isRecording) return `Recording... ${formatDuration(recordingDuration)}`;
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
    <div className="webcam-recorder">
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
          onClick={isRecording ? stopWebcamRecording : startWebcamRecording}
          disabled={!webcamRecorder && !recordingError}
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
          <>
            <div className="webcam-recorder-info-item">
              <span className="webcam-recorder-info-label">Duration:</span>
              <span className="webcam-recorder-info-value">{formatDuration(recordingDuration)}</span>
            </div>
            <div className="webcam-recorder-info-item">
              <span className="webcam-recorder-info-label">Size:</span>
              <span className="webcam-recorder-info-value">{formatFileSize(fileSize)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WebcamRecorder;