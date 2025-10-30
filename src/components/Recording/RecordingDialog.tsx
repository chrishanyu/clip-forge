/**
 * RecordingDialog Component
 * 
 * Main recording interface dialog that allows users to select recording devices,
 * configure settings, and start recording. Integrates with the unified recording
 * approach where both screen and webcam are recorded together.
 */

import React, { useEffect, useState } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { DeviceSelector } from './DeviceSelector';
import { CameraPreview } from './CameraPreview';
import { WebcamRecorder } from './WebcamRecorder';
import { RecordingType } from '@/types';
import './RecordingDialog.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export type { RecordingDialogProps };

// ============================================================================
// RECORDING DIALOG COMPONENT
// ============================================================================

export const RecordingDialog: React.FC<RecordingDialogProps> = ({ isOpen, onClose }) => {
  // ========================================================================
  // STORE HOOKS
  // ========================================================================
  
  const {
    settings,
    currentSession,
    error,
    loadDevices,
    updateSettings,
    startRecording,
    clearError,
  } = useRecordingStore();

  // ========================================================================
  // LOCAL STATE
  // ========================================================================
  
  const [recordingType, setRecordingType] = useState<RecordingType>('pip');
  const [isStarting, setIsStarting] = useState(false);

  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  useEffect(() => {
    if (isOpen) {
      loadDevices();
      clearError();
    }
  }, [isOpen, loadDevices, clearError]);
  
  // Ensure camera preview is started for webcam and PiP recording
  useEffect(() => {
    if (isOpen && (recordingType === 'webcam' || recordingType === 'pip')) {
      // The CameraPreview component will handle starting the preview
      // when it detects a selected camera
    }
  }, [isOpen, recordingType]);

  useEffect(() => {
    if (isOpen && !settings) {
      // Initialize default settings based on recording type
      updateSettings({
        type: recordingType,
        quality: 'medium',
        frameRate: 30,
        audioEnabled: true,
      });
    }
  }, [isOpen, settings, recordingType, updateSettings]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  const handleRecordingTypeChange = (type: RecordingType) => {
    setRecordingType(type);
    updateSettings({
      type,
      quality: 'medium',
      frameRate: 30,
      audioEnabled: true,
    });
  };

  const handleStartRecording = async () => {
    if (!settings) return;

    setIsStarting(true);
    try {
      // For screen and PiP recordings, use the Rust backend
      await startRecording(settings);
      // Close the dialog after successfully starting recording
      onClose();
    } catch (error) {
      console.error('Failed to start recording:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    if (!isStarting) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !isStarting) {
      handleClose();
    }
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const canStartRecording = () => {
    if (!settings) return false;
    
    if (recordingType === 'screen' && 'screenId' in settings && !settings.screenId) return false;
    if (recordingType === 'webcam' && 'cameraId' in settings && !settings.cameraId) return false;
    if (recordingType === 'pip' && 'screenId' in settings && 'cameraId' in settings && (!settings.screenId || !settings.cameraId)) return false;
    
    return !isStarting && !currentSession;
  };

  const getRecordingTypeLabel = (type: RecordingType) => {
    switch (type) {
      case 'screen': return 'Screen Only';
      case 'webcam': return 'Webcam Only';
      case 'pip': return 'Screen + Webcam';
      default: return 'Unknown';
    }
  };

  const getRecordingTypeDescription = (type: RecordingType) => {
    switch (type) {
      case 'screen': return 'Record your screen content only';
      case 'webcam': return 'Record your webcam with audio';
      case 'pip': return 'Record both screen and webcam together';
      default: return '';
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  if (!isOpen) return null;

  return (
    <div 
      className="recording-dialog-overlay"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recording-dialog-title"
    >
      <div 
        className="recording-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="recording-dialog-header">
          <h2 id="recording-dialog-title" className="recording-dialog-title">
            Start Recording
          </h2>
          <button
            className="recording-dialog-close"
            onClick={handleClose}
            disabled={isStarting}
            aria-label="Close recording dialog"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="recording-dialog-content">
          {/* Recording Type Selection */}
          <div className="recording-type-section">
            <h3 className="recording-section-title">Recording Type</h3>
            <div className="recording-type-options">
              {(['screen', 'webcam', 'pip'] as RecordingType[]).map((type) => (
                <button
                  key={type}
                  className={`recording-type-option ${recordingType === type ? 'recording-type-option-selected' : ''}`}
                  onClick={() => handleRecordingTypeChange(type)}
                  disabled={isStarting}
                >
                  <div className="recording-type-option-content">
                    <span className="recording-type-option-label">
                      {getRecordingTypeLabel(type)}
                    </span>
                    <span className="recording-type-option-description">
                      {getRecordingTypeDescription(type)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Device Selection */}
          <div className="device-selection-section">
            <DeviceSelector
              recordingType={recordingType}
              disabled={isStarting}
            />
          </div>

          {/* Camera Preview (for pip only - webcam uses WebcamRecorder's own preview) */}
          {recordingType === 'pip' && (
            <div className="camera-preview-section">
              <h3 className="recording-section-title">Camera Preview</h3>
              <CameraPreview
                recordingType={recordingType}
                disabled={isStarting}
              />
            </div>
          )}

          {/* Webcam Recorder (for webcam only) */}
          {/* Keep dialog open during webcam recording so component stays mounted */}
          {recordingType === 'webcam' && settings && 'cameraId' in settings && (
            <WebcamRecorder
              settings={settings as any}
              onRecordingStart={() => {
                // DON'T close dialog - keep it open so WebcamRecorder stays mounted
              }}
              onRecordingStop={() => {
                // Close dialog after recording stops
                onClose();
              }}
              onError={(error) => {
                console.error('Webcam recording error:', error);
              }}
            />
          )}


          {/* Error Display */}
          {error && (
            <div className="recording-dialog-error">
              <span className="recording-dialog-error-icon">⚠️</span>
              <span className="recording-dialog-error-message">
                {error.message}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="recording-dialog-footer">
          <button
            className="recording-dialog-cancel"
            onClick={handleClose}
            disabled={isStarting}
          >
            {recordingType === 'webcam' ? 'Close' : 'Cancel'}
          </button>
          {/* Only show Start Recording button for screen and PiP modes */}
          {/* Webcam mode uses WebcamRecorder's internal button */}
          {recordingType !== 'webcam' && (
            <button
              className="recording-dialog-start"
              onClick={handleStartRecording}
              disabled={!canStartRecording()}
            >
              {isStarting ? 'Starting...' : 'Start Recording'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingDialog;
