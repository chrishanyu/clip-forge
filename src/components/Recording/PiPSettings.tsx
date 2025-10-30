/**
 * PiPSettings Component
 * 
 * Controls for Picture-in-Picture recording configuration.
 * Allows users to set PiP position, size, and other settings
 * for combined screen and webcam recording.
 */

import React from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { PiPPosition, PiPSize } from '@/types';
import './PiPSettings.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface PiPSettingsProps {
  disabled?: boolean;
}

export type { PiPSettingsProps };

// ============================================================================
// PIP SETTINGS COMPONENT
// ============================================================================

export const PiPSettings: React.FC<PiPSettingsProps> = ({ disabled = false }) => {
  // ========================================================================
  // STORE HOOKS
  // ========================================================================
  
  const { settings, updateSettings } = useRecordingStore();

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  const handlePositionChange = (position: PiPPosition) => {
    if (settings && 'pipPosition' in settings) {
      updateSettings({ pipPosition: position });
    }
  };

  const handleSizeChange = (size: PiPSize) => {
    if (settings && 'pipSize' in settings) {
      updateSettings({ pipSize: size });
    }
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getCurrentPosition = (): PiPPosition => {
    if (settings && 'pipPosition' in settings) {
      return settings.pipPosition;
    }
    return 'bottom-right';
  };

  const getCurrentSize = (): PiPSize => {
    if (settings && 'pipSize' in settings) {
      return settings.pipSize;
    }
    return 'medium';
  };

  const getPositionLabel = (position: PiPPosition): string => {
    switch (position) {
      case 'top-left': return 'Top Left';
      case 'top-right': return 'Top Right';
      case 'bottom-left': return 'Bottom Left';
      case 'bottom-right': return 'Bottom Right';
      default: return 'Unknown';
    }
  };

  const getSizeLabel = (size: PiPSize): string => {
    switch (size) {
      case 'small': return 'Small';
      case 'medium': return 'Medium';
      case 'large': return 'Large';
      default: return 'Unknown';
    }
  };

  const getSizeDescription = (size: PiPSize): string => {
    switch (size) {
      case 'small': return '20% of screen';
      case 'medium': return '30% of screen';
      case 'large': return '40% of screen';
      default: return '';
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  const currentPosition = getCurrentPosition();
  const currentSize = getCurrentSize();

  return (
    <div className="pip-settings">
      {/* Position Settings */}
      <div className="pip-settings-group">
        <label className="pip-settings-label">
          Picture-in-Picture Position
        </label>
        <div className="pip-settings-options">
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as PiPPosition[]).map((position) => (
            <button
              key={position}
              className={`pip-settings-option ${currentPosition === position ? 'pip-settings-option-selected' : ''}`}
              onClick={() => handlePositionChange(position)}
              disabled={disabled}
              title={`Position webcam in ${getPositionLabel(position).toLowerCase()}`}
            >
              <div className="pip-settings-option-preview">
                <div className={`pip-settings-preview-screen pip-settings-preview-${position}`}>
                  <div className="pip-settings-preview-pip"></div>
                </div>
              </div>
              <span className="pip-settings-option-label">
                {getPositionLabel(position)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Size Settings */}
      <div className="pip-settings-group">
        <label className="pip-settings-label">
          Picture-in-Picture Size
        </label>
        <div className="pip-settings-options">
          {(['small', 'medium', 'large'] as PiPSize[]).map((size) => (
            <button
              key={size}
              className={`pip-settings-option ${currentSize === size ? 'pip-settings-option-selected' : ''}`}
              onClick={() => handleSizeChange(size)}
              disabled={disabled}
              title={`${getSizeLabel(size)} size: ${getSizeDescription(size)}`}
            >
              <div className="pip-settings-option-preview">
                <div className={`pip-settings-preview-screen pip-settings-preview-${size}`}>
                  <div className="pip-settings-preview-pip"></div>
                </div>
              </div>
              <div className="pip-settings-option-content">
                <span className="pip-settings-option-label">
                  {getSizeLabel(size)}
                </span>
                <span className="pip-settings-option-description">
                  {getSizeDescription(size)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="pip-settings-preview">
        <div className="pip-settings-preview-label">
          Preview
        </div>
        <div className="pip-settings-preview-container">
          <div className="pip-settings-preview-screen-large">
            <div className="pip-settings-preview-screen-content">
              <div className="pip-settings-preview-screen-text">
                Screen Content
              </div>
            </div>
            <div className={`pip-settings-preview-pip-large pip-settings-preview-pip-${currentPosition} pip-settings-preview-pip-${currentSize}`}>
              <div className="pip-settings-preview-pip-content">
                <div className="pip-settings-preview-pip-text">
                  Webcam
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PiPSettings;
