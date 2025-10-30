/**
 * CameraPreview Component
 * 
 * Displays live camera feed for webcam recording preview.
 * Integrates with the useWebcamRecording hook to provide
 * real-time camera preview functionality.
 */

import React, { useEffect, useRef } from 'react';
import { useWebcamRecording } from '@/hooks/useWebcamRecording';
import { useRecordingStore } from '@/stores/recordingStore';
import { RecordingType } from '@/types';
import './CameraPreview.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface CameraPreviewProps {
  recordingType: RecordingType;
  disabled?: boolean;
}

export type { CameraPreviewProps };

// ============================================================================
// CAMERA PREVIEW COMPONENT
// ============================================================================

export const CameraPreview: React.FC<CameraPreviewProps> = ({ 
  recordingType, 
  disabled = false 
}) => {
  // ========================================================================
  // HOOKS
  // ========================================================================
  
  const {
    stream,
    isStreamActive,
    error,
    startPreview,
    stopPreview,
    clearError,
  } = useWebcamRecording();


  const { settings, devices } = useRecordingStore();
  
  // Get camera info from recording store
  const availableCameras = devices.cameras;
  const selectedCameraId = settings && 'cameraId' in settings ? settings.cameraId : null;
  const videoRef = useRef<HTMLVideoElement>(null);

  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  // Update video source when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);


  // Start preview when camera is selected and not disabled
  useEffect(() => {
    if (selectedCameraId && !disabled && !isStreamActive) {
      startPreview(selectedCameraId);
    } else if (disabled && isStreamActive) {
      stopPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId, disabled, isStreamActive]); // startPreview and stopPreview are stable callbacks

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stopPreview is a stable callback, only run cleanup on unmount

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  const handleVideoClick = () => {
    if (!disabled && !isStreamActive && selectedCameraId) {
      startPreview(selectedCameraId);
    }
  };

  const handleError = () => {
    // Video error handling is managed by the hook
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getPreviewStatus = () => {
    if (disabled) return 'disabled';
    if (error) return 'error';
    if (!selectedCameraId) return 'no-camera';
    if (isStreamActive) return 'active';
    return 'inactive';
  };

  const getStatusMessage = () => {
    const status = getPreviewStatus();
    
    switch (status) {
      case 'disabled':
        return 'Camera preview disabled';
      case 'error':
        return `Camera error: ${error?.message || 'Unknown error'}`;
      case 'no-camera':
        return 'No camera selected';
      case 'inactive':
        return 'Click to start preview';
      case 'active':
        return stream ? 'Live preview' : 'Preview ready';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    const status = getPreviewStatus();
    
    switch (status) {
      case 'disabled':
        return '🚫';
      case 'error':
        return '⚠️';
      case 'no-camera':
        return '📷';
      case 'inactive':
        return '▶️';
      case 'active':
        return '🔴';
      default:
        return '';
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  const status = getPreviewStatus();
  const statusMessage = getStatusMessage();
  const statusIcon = getStatusIcon();

  return (
    <div className={`camera-preview ${status}`}>
      {/* Video Element */}
      <div className="camera-preview-container">
        {stream ? (
          <video
            ref={videoRef}
            className="camera-preview-video"
            autoPlay
            muted
            playsInline
            onError={handleError}
            onClick={handleVideoClick}
            aria-label="Camera preview"
          />
        ) : (
          <div 
            className="camera-preview-placeholder"
            onClick={(e) => {
              e.stopPropagation();
              handleVideoClick();
            }}
            style={{ 
              cursor: 'pointer',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div className="camera-preview-placeholder-icon">📷</div>
            <div className="camera-preview-placeholder-text">
              Camera Preview
              <br />
              <small>Click to start preview</small>
            </div>
          </div>
        )}
        
        {/* Overlay */}
        <div 
          className="camera-preview-overlay"
          style={{ 
            pointerEvents: stream ? 'auto' : 'none' 
          }}
        >
          <div className="camera-preview-status">
            <span className="camera-preview-status-icon">
              {statusIcon}
            </span>
            <span className="camera-preview-status-message">
              {statusMessage}
            </span>
          </div>
          
          {status === 'error' && (
            <button
              className="camera-preview-retry"
              onClick={() => {
                clearError();
                if (selectedCameraId) {
                  startPreview(selectedCameraId);
                }
              }}
              disabled={disabled}
            >
              <span className="camera-preview-retry-icon">🔄</span>
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default CameraPreview;
