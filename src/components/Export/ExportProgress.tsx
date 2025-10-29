import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ExportProgress as ExportProgressType } from '@/types/export';
import { useExportStore, exportUtils } from '@/stores/exportStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './ExportProgress.css';

// ============================================================================
// EXPORT PROGRESS COMPONENT
// ============================================================================

interface ExportProgressProps {
  isVisible: boolean;
  onClose: () => void;
  onCancel?: () => void;
}

export type { ExportProgressProps };

export const ExportProgress: React.FC<ExportProgressProps> = ({ 
  isVisible, 
  onClose, 
  onCancel 
}) => {
  const { 
    isExporting, 
    progress, 
    updateProgress, 
    completeExport, 
    cancelExport: storeCancelExport,
    setError 
  } = useExportStore();
  
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Use refs to track if we've already set up listeners
  const hasSetupProgressListener = useRef(false);
  const progressListenerRef = useRef<(() => void) | null>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleCancel = useCallback(async () => {
    try {
      await invoke('cancel_export', { exportId: 'current' });
      storeCancelExport();
      onCancel?.();
    } catch (error) {
      console.error('Failed to cancel export:', error);
      setError('Failed to cancel export');
    }
  }, [storeCancelExport, onCancel, setError]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Listen for export progress events
  useEffect(() => {
    if (!isVisible || hasSetupProgressListener.current) return;

    const setupListener = async () => {
      const unlisten = await listen<ExportProgressType>('export-progress', (event) => {
        const progressData = event.payload;
        updateProgress(progressData);
        
        if (progressData.progress > 0 && !isExporting) {
          setStartTime(new Date());
        }
      });

      hasSetupProgressListener.current = true;
      progressListenerRef.current = unlisten;
    };

    setupListener();

    return () => {
      if (progressListenerRef.current) {
        progressListenerRef.current();
        progressListenerRef.current = null;
        hasSetupProgressListener.current = false;
      }
    };
  }, [isVisible]); // Only depend on isVisible

  // Update elapsed time
  useEffect(() => {
    if (!isExporting || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isExporting, startTime]);


  // Handle export completion or error
  useEffect(() => {
    if (!progress) return;
    
    if (progress.error) {
      setError(progress.error);
    } else if (progress.progress >= 100) {
      completeExport();
      // Auto-close after 2 seconds on success
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [progress?.error, progress?.progress]); // Only depend on specific progress properties

  // Reset state when dialog opens
  useEffect(() => {
    if (isVisible) {
      setStartTime(null);
      setElapsedTime(0);
    } else {
      // Clean up listener when dialog closes
      if (progressListenerRef.current) {
        progressListenerRef.current();
        progressListenerRef.current = null;
        hasSetupProgressListener.current = false;
      }
    }
  }, [isVisible]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isVisible || !progress) return null;

  const isComplete = progress.progress >= 100 && !progress.error;
  const hasError = !!progress.error;

  return (
    <div className="export-progress-overlay">
      <div className="export-progress-modal">
        <div className="export-progress-header">
          <h3>Export Progress</h3>
          {!isComplete && !hasError && (
            <button 
              className="export-progress-cancel"
              onClick={handleCancel}
              disabled={!isExporting}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="export-progress-content">
          {/* Progress Bar */}
          <div className="export-progress-bar-container">
            <div className="export-progress-bar">
              <div 
                className="export-progress-fill"
                style={{ width: `${Math.min(progress.progress, 100)}%` }}
              />
            </div>
            <div className="export-progress-percentage">
              {Math.round(progress.progress)}%
            </div>
          </div>

          {/* Current Step */}
          <div className="export-progress-step">
            <span className="export-progress-step-label">Status:</span>
            <span className="export-progress-step-value">
              {progress.current_step}
            </span>
          </div>

          {/* Progress Details */}
          <div className="export-progress-details">
            {/* Time Information */}
            <div className="export-progress-time">
              <div className="export-progress-time-item">
                <span className="export-progress-time-label">Elapsed:</span>
                <span className="export-progress-time-value">
                  {exportUtils.formatTime(elapsedTime)}
                </span>
              </div>
              {progress.estimated_time_remaining > 0 && (
                <div className="export-progress-time-item">
                  <span className="export-progress-time-label">Remaining:</span>
                  <span className="export-progress-time-value">
                    {exportUtils.formatTime(progress.estimated_time_remaining)}
                  </span>
                </div>
              )}
            </div>

            {/* Frame Information */}
            {(progress.current_frame !== undefined || progress.total_frames !== undefined) && (
              <div className="export-progress-frames">
                <div className="export-progress-frame-item">
                  <span className="export-progress-frame-label">Frame:</span>
                  <span className="export-progress-frame-value">
                    {progress.current_frame || 0}
                    {progress.total_frames && ` / ${progress.total_frames}`}
                  </span>
                </div>
                {progress.fps && (
                  <div className="export-progress-frame-item">
                    <span className="export-progress-frame-label">FPS:</span>
                    <span className="export-progress-frame-value">
                      {progress.fps.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bitrate Information */}
            {progress.bitrate && (
              <div className="export-progress-bitrate">
                <span className="export-progress-bitrate-label">Bitrate:</span>
                <span className="export-progress-bitrate-value">
                  {progress.bitrate.toFixed(0)} kbps
                </span>
              </div>
            )}

            {/* Time Position */}
            {progress.time && (
              <div className="export-progress-position">
                <span className="export-progress-position-label">Position:</span>
                <span className="export-progress-position-value">
                  {progress.time}
                </span>
              </div>
            )}
          </div>

          {/* Error Display */}
          {hasError && (
            <div className="export-progress-error">
              <div className="export-progress-error-icon">⚠️</div>
              <div className="export-progress-error-message">
                {progress.error}
              </div>
            </div>
          )}

          {/* Success Message */}
          {isComplete && !hasError && (
            <div className="export-progress-success">
              <div className="export-progress-success-icon">✅</div>
              <div className="export-progress-success-message">
                Export completed successfully!
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="export-progress-actions">
          {hasError && (
            <button 
              className="export-progress-button export-progress-button-primary"
              onClick={onClose}
            >
              Close
            </button>
          )}
          {isComplete && !hasError && (
            <button 
              className="export-progress-button export-progress-button-primary"
              onClick={onClose}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportProgress;
