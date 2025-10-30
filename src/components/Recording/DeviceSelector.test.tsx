/**
 * DeviceSelector Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DeviceSelector } from './DeviceSelector';
import { useRecordingStore } from '@/stores/recordingStore';

// Mock the recording store
vi.mock('@/stores/recordingStore');
const mockUseRecordingStore = useRecordingStore as any;

describe('DeviceSelector', () => {
  const mockStore = {
    devices: {
      screens: [
        {
          id: 'screen1',
          name: 'Built-in Retina Display',
          width: 2560,
          height: 1600,
          x: 0,
          y: 0,
          isPrimary: true,
          scaleFactor: 2,
        },
        {
          id: 'screen2',
          name: 'External Display',
          width: 1920,
          height: 1080,
          x: 2560,
          y: 0,
          isPrimary: false,
          scaleFactor: 1,
        },
      ],
      cameras: [
        {
          id: 'camera1',
          name: 'FaceTime HD Camera',
          isDefault: true,
          isAvailable: true,
          capabilities: {
            maxWidth: 1920,
            maxHeight: 1080,
            supportedFormats: ['video/webm', 'video/mp4'],
            hasAudio: true,
          },
        },
        {
          id: 'camera2',
          name: 'USB Camera',
          isDefault: false,
          isAvailable: true,
          capabilities: {
            maxWidth: 1280,
            maxHeight: 720,
            supportedFormats: ['video/webm'],
            hasAudio: false,
          },
        },
      ],
      isLoading: false,
      error: null,
    },
    settings: {
      type: 'pip',
      screenId: 'screen1',
      cameraId: 'camera1',
    } as any,
    selectScreen: vi.fn(),
    selectCamera: vi.fn(),
    refreshDevices: vi.fn(),
  };

  const defaultProps = {
    recordingType: 'pip' as const,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRecordingStore.mockReturnValue(mockStore);
  });

  it('renders screen selector for screen and pip recording', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('Screen to Record')).toBeInTheDocument();
    expect(screen.getByText('Built-in Retina Display')).toBeInTheDocument();
    expect(screen.getByText('External Display')).toBeInTheDocument();
  });

  it('renders camera selector for webcam and pip recording', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('Camera to Record')).toBeInTheDocument();
    expect(screen.getByText('FaceTime HD Camera')).toBeInTheDocument();
    expect(screen.getByText('USB Camera')).toBeInTheDocument();
  });

  it('does not render screen selector for webcam recording', () => {
    render(<DeviceSelector {...defaultProps} recordingType="webcam" />);
    
    expect(screen.queryByText('Screen to Record')).not.toBeInTheDocument();
    expect(screen.getByText('Camera to Record')).toBeInTheDocument();
  });

  it('does not render camera selector for screen recording', () => {
    render(<DeviceSelector {...defaultProps} recordingType="screen" />);
    
    expect(screen.getByText('Screen to Record')).toBeInTheDocument();
    expect(screen.queryByText('Camera to Record')).not.toBeInTheDocument();
  });

  it('shows loading state when devices are loading', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      devices: {
        ...mockStore.devices,
        isLoading: true,
      },
    });

    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('Loading screens...')).toBeInTheDocument();
    expect(screen.getByText('Loading cameras...')).toBeInTheDocument();
  });

  it('shows error state when there is an error', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      devices: {
        ...mockStore.devices,
        error: {
          code: 'DEVICE_LOAD_FAILED',
          message: 'Failed to load devices',
          timestamp: new Date().toISOString(),
        },
      },
    });

    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('Failed to load screens: Failed to load devices')).toBeInTheDocument();
    expect(screen.getByText('Failed to load cameras: Failed to load devices')).toBeInTheDocument();
  });

  it('shows empty state when no devices available', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      devices: {
        screens: [],
        cameras: [],
        isLoading: false,
        error: null,
      },
    });

    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('No screens available')).toBeInTheDocument();
    expect(screen.getByText('No cameras available')).toBeInTheDocument();
  });

  it('selects screen when screen option is clicked', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    const externalDisplay = screen.getByText('External Display');
    fireEvent.click(externalDisplay);
    
    expect(mockStore.selectScreen).toHaveBeenCalledWith('screen2');
  });

  it('selects camera when camera option is clicked', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    const usbCamera = screen.getByText('USB Camera');
    fireEvent.click(usbCamera);
    
    expect(mockStore.selectCamera).toHaveBeenCalledWith('camera2');
  });

  it('shows selected screen with correct styling', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    const builtInDisplay = screen.getByText('Built-in Retina Display').closest('button');
    expect(builtInDisplay).toHaveClass('device-selector-option-selected');
  });

  it('shows selected camera with correct styling', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    const faceTimeCamera = screen.getByText('FaceTime HD Camera').closest('button');
    expect(faceTimeCamera).toHaveClass('device-selector-option-selected');
  });

  it('shows device details correctly', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('2560×1600 • Primary')).toBeInTheDocument();
    expect(screen.getByText('1920×1080 • Secondary')).toBeInTheDocument();
    expect(screen.getByText('1920×1080 • With Audio')).toBeInTheDocument();
    expect(screen.getByText('1280×720 • Video Only')).toBeInTheDocument();
  });

  it('shows default/primary badges', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('refreshes devices when refresh button is clicked', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    const refreshButton = screen.getByText('Refresh Devices');
    fireEvent.click(refreshButton);
    
    expect(mockStore.refreshDevices).toHaveBeenCalled();
  });

  it('disables options when disabled prop is true', () => {
    render(<DeviceSelector {...defaultProps} disabled={true} />);
    
    const screenOptions = screen.getAllByRole('button').filter(button => 
      button.textContent?.includes('Display')
    );
    screenOptions.forEach(option => {
      expect(option).toBeDisabled();
    });
  });

  it('disables refresh button when disabled', () => {
    render(<DeviceSelector {...defaultProps} disabled={true} />);
    
    const refreshButton = screen.getByText('Refresh Devices');
    expect(refreshButton).toBeDisabled();
  });

  it('disables refresh button when loading', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      devices: {
        ...mockStore.devices,
        isLoading: true,
      },
    });

    render(<DeviceSelector {...defaultProps} />);
    
    const refreshButton = screen.getByText('Refresh Devices');
    expect(refreshButton).toBeDisabled();
  });

  it('loads devices on mount if not already loaded', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      devices: {
        screens: [],
        cameras: [],
        isLoading: false,
        error: null,
      },
    });

    render(<DeviceSelector {...defaultProps} />);
    
    expect(mockStore.refreshDevices).toHaveBeenCalled();
  });

  it('does not load devices if already loaded', () => {
    render(<DeviceSelector {...defaultProps} />);
    
    expect(mockStore.refreshDevices).not.toHaveBeenCalled();
  });
});
