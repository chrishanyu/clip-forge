/**
 * RecordingButton Component
 * 
 * A prominent recording button for the application header that opens the
 * recording dialog and provides visual feedback for recording state.
 */

import React from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import './RecordingButton.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface RecordingButtonProps {
  className?: string;
}

export type { RecordingButtonProps };

// ============================================================================
// RECORDING BUTTON COMPONENT
// ============================================================================

export const RecordingButton: React.FC<RecordingButtonProps> = ({ className = '' }) => {
  // ========================================================================
  // STORE HOOKS
  // ========================================================================
  
  const {
    isDialogOpen,
    currentSession,
    openRecordingDialog,
    closeRecordingDialog,
  } = useRecordingStore();

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================
  
  const isRecording = currentSession?.status === 'recording';
  const isPreparing = currentSession?.status === 'preparing';
  const isStopping = currentSession?.status === 'stopping';
  const isError = currentSession?.status === 'error';
  
  const isActive = isRecording || isPreparing || isStopping;
  const isDisabled = isError || isDialogOpen;

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  const handleClick = () => {
    if (isDialogOpen) {
      closeRecordingDialog();
    } else {
      openRecordingDialog();
    }
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getButtonText = () => {
    if (isRecording) return 'Recording...';
    if (isPreparing) return 'Preparing...';
    if (isStopping) return 'Stopping...';
    if (isDialogOpen) return 'Close';
    return 'Record';
  };

  const getButtonIcon = () => {
    if (isRecording) return '⏹️';
    if (isPreparing) return '⏳';
    if (isStopping) return '⏹️';
    if (isDialogOpen) return '✕';
    return '🔴';
  };

  const getButtonTitle = () => {
    if (isRecording) return 'Stop recording (click to open dialog)';
    if (isPreparing) return 'Preparing recording...';
    if (isStopping) return 'Stopping recording...';
    if (isDialogOpen) return 'Close recording dialog';
    if (isError) return 'Recording error - click to retry';
    return 'Start recording screen and webcam';
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <button
      className={`recording-button ${isActive ? 'recording-button-active' : ''} ${isDisabled ? 'recording-button-disabled' : ''} ${className}`}
      onClick={handleClick}
      disabled={isDisabled}
      title={getButtonTitle()}
      aria-label={getButtonTitle()}
    >
      <span className="recording-button-icon">
        {getButtonIcon()}
      </span>
      <span className="recording-button-text">
        {getButtonText()}
      </span>
      {isRecording && (
        <span className="recording-button-indicator" aria-hidden="true">
          ●
        </span>
      )}
    </button>
  );
};

export default RecordingButton;
