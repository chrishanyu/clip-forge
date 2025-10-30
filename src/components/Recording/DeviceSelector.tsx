/**
 * DeviceSelector Component
 * 
 * Handles selection of screen and camera devices for recording.
 * Integrates with the unified recording approach where both devices
 * are selected together for Picture-in-Picture recording.
 */

import React, { useEffect } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { RecordingType } from '@/types';
import './DeviceSelector.css';

// ============================================================================
// COMPONENT INTERFACE
// ============================================================================

interface DeviceSelectorProps {
  recordingType: RecordingType;
  disabled?: boolean;
}

export type { DeviceSelectorProps };

// ============================================================================
// DEVICE SELECTOR COMPONENT
// ============================================================================

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({ 
  recordingType, 
  disabled = false 
}) => {
  // ========================================================================
  // STORE HOOKS
  // ========================================================================
  
  const {
    devices,
    settings,
    selectScreen,
    selectCamera,
    refreshDevices,
  } = useRecordingStore();

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getSelectedScreen = () => {
    if (!settings || !('screenId' in settings)) return null;
    return devices.screens.find(screen => screen.id === settings.screenId) || null;
  };

  const getSelectedCamera = () => {
    if (!settings || !('cameraId' in settings)) return null;
    return devices.cameras.find(camera => camera.id === settings.cameraId) || null;
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  const handleScreenSelect = (screenId: string) => {
    selectScreen(screenId);
  };

  const handleCameraSelect = (cameraId: string) => {
    selectCamera(cameraId);
  };

  const handleRefreshDevices = () => {
    refreshDevices();
  };

  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  useEffect(() => {
    if (devices.screens.length === 0 && devices.cameras.length === 0) {
      refreshDevices();
    }
  }, [devices.screens.length, devices.cameras.length, refreshDevices]);

  // Auto-select first available devices
  useEffect(() => {
    if (devices.screens.length > 0 && !getSelectedScreen()) {
      const firstScreen = devices.screens[0];
      selectScreen(firstScreen.id);
    }
  }, [devices.screens, getSelectedScreen, selectScreen]);

  useEffect(() => {
    if (devices.cameras.length > 0 && !getSelectedCamera()) {
      const firstCamera = devices.cameras[0];
      selectCamera(firstCamera.id);
    }
  }, [devices.cameras, getSelectedCamera, selectCamera]);

  const shouldShowScreenSelector = () => {
    return recordingType === 'screen' || recordingType === 'pip';
  };

  const shouldShowCameraSelector = () => {
    return recordingType === 'webcam' || recordingType === 'pip';
  };

  const getDeviceDisplayName = (device: any) => {
    if (device.isPrimary || device.isDefault) {
      return `${device.name} (Default)`;
    }
    return device.name;
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <div className="device-selector">
      {/* Screen Selector */}
      {shouldShowScreenSelector() && (
        <div className="device-selector-group">
          <label className="device-selector-label">
            Screen to Record
            {recordingType === 'pip' && <span className="device-selector-required">*</span>}
          </label>
          
          {devices.isLoading ? (
            <div className="device-selector-loading">
              <span className="device-selector-loading-spinner"></span>
              <span>Loading screens...</span>
            </div>
          ) : devices.error ? (
            <div className="device-selector-error">
              <span className="device-selector-error-icon">⚠️</span>
              <span>Failed to load screens: {devices.error.message}</span>
            </div>
          ) : (
            <select
              className="device-selector-dropdown"
              value={getSelectedScreen()?.id || ''}
              onChange={(e) => handleScreenSelect(e.target.value)}
              disabled={disabled || devices.screens.length === 0}
            >
              {devices.screens.length === 0 ? (
                <option value="" disabled>No screens available</option>
              ) : (
                <>
                  <option value="" disabled>Select a screen...</option>
                  {devices.screens.map((screen) => (
                    <option key={screen.id} value={screen.id}>
                      {getDeviceDisplayName(screen)}{screen.isPrimary ? ' (Primary)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          )}
        </div>
      )}

      {/* Camera Selector */}
      {shouldShowCameraSelector() && (
        <div className="device-selector-group">
          <label className="device-selector-label">
            Camera to Record
            {recordingType === 'pip' && <span className="device-selector-required">*</span>}
          </label>
          
          {devices.isLoading ? (
            <div className="device-selector-loading">
              <span className="device-selector-loading-spinner"></span>
              <span>Loading cameras...</span>
            </div>
          ) : devices.error ? (
            <div className="device-selector-error">
              <span className="device-selector-error-icon">⚠️</span>
              <span>Failed to load cameras: {devices.error.message}</span>
            </div>
          ) : (
            <select
              className="device-selector-dropdown"
              value={getSelectedCamera()?.id || ''}
              onChange={(e) => handleCameraSelect(e.target.value)}
              disabled={disabled || devices.cameras.length === 0}
            >
              {devices.cameras.length === 0 ? (
                <option value="" disabled>No cameras available</option>
              ) : (
                <>
                  <option value="" disabled>Select a camera...</option>
                  {devices.cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {getDeviceDisplayName(camera)}{camera.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="device-selector-actions">
        <button
          className="device-selector-refresh"
          onClick={handleRefreshDevices}
          disabled={disabled || devices.isLoading}
        >
          <span className="device-selector-refresh-icon">🔄</span>
          <span>Refresh Devices</span>
        </button>
      </div>
    </div>
  );
};

export default DeviceSelector;
