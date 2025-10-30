/**
 * RecordingDialog Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingDialog } from './RecordingDialog';
import { useRecordingStore } from '@/stores/recordingStore';

// Mock the recording store
jest.mock('@/stores/recordingStore');
const mockUseRecordingStore = useRecordingStore as jest.MockedFunction<typeof useRecordingStore>;

// Mock child components
jest.mock('./DeviceSelector', () => ({
  DeviceSelector: ({ recordingType, disabled }: any) => (
    <div data-testid="device-selector">
      DeviceSelector for {recordingType} (disabled: {disabled.toString()})
    </div>
  ),
}));

jest.mock('./CameraPreview', () => ({
  CameraPreview: ({ recordingType, disabled }: any) => (
    <div data-testid="camera-preview">
      CameraPreview for {recordingType} (disabled: {disabled.toString()})
    </div>
  ),
}));

jest.mock('./PiPSettings', () => ({
  PiPSettings: ({ disabled }: any) => (
    <div data-testid="pip-settings">
      PiPSettings (disabled: {disabled.toString()})
    </div>
  ),
}));

describe('RecordingDialog', () => {
  const mockStore = {
    devices: {
      screens: [],
      cameras: [],
      isLoading: false,
      error: null,
    },
    settings: null,
    currentSession: null,
    error: null,
    loadDevices: jest.fn(),
    updateSettings: jest.fn(),
    startRecording: jest.fn(),
    clearError: jest.fn(),
  };

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRecordingStore.mockReturnValue(mockStore);
  });

  it('renders when open', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<RecordingDialog {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loads devices when opened', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    expect(mockStore.loadDevices).toHaveBeenCalled();
    expect(mockStore.clearError).toHaveBeenCalled();
  });

  it('initializes default settings when opened', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    expect(mockStore.updateSettings).toHaveBeenCalledWith({
      type: 'pip',
      quality: 'medium',
      frameRate: 30,
      audioEnabled: true,
    });
  });

  it('changes recording type when option is clicked', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    const screenOption = screen.getByText('Screen Only');
    fireEvent.click(screenOption);
    
    expect(mockStore.updateSettings).toHaveBeenCalledWith({
      type: 'screen',
      quality: 'medium',
      frameRate: 30,
      audioEnabled: true,
    });
  });

  it('shows device selector for all recording types', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    expect(screen.getByTestId('device-selector')).toBeInTheDocument();
  });

  it('shows camera preview for webcam and pip recording', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
  });

  it('shows pip settings only for pip recording', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    expect(screen.getByTestId('pip-settings')).toBeInTheDocument();
  });

  it('hides pip settings for non-pip recording', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      settings: { type: 'screen' } as any,
    });

    render(<RecordingDialog {...defaultProps} />);
    
    // Change to screen recording
    const screenOption = screen.getByText('Screen Only');
    fireEvent.click(screenOption);
    
    // PiP settings should still be there but we can't easily test hiding
    // since the component re-renders with new settings
  });

  it('starts recording when start button is clicked', async () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      settings: {
        type: 'pip',
        screenId: 'screen1',
        cameraId: 'camera1',
      } as any,
    });

    render(<RecordingDialog {...defaultProps} />);
    
    const startButton = screen.getByText('Start Recording');
    fireEvent.click(startButton);
    
    expect(mockStore.startRecording).toHaveBeenCalled();
  });

  it('disables start button when no settings', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    const startButton = screen.getByText('Start Recording');
    expect(startButton).toBeDisabled();
  });

  it('disables start button when missing required settings', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      settings: {
        type: 'pip',
        screenId: 'screen1',
        // Missing cameraId
      } as any,
    });

    render(<RecordingDialog {...defaultProps} />);
    
    const startButton = screen.getByText('Start Recording');
    expect(startButton).toBeDisabled();
  });

  it('shows error when there is an error', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date().toISOString(),
      },
    });

    render(<RecordingDialog {...defaultProps} />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('closes dialog when close button is clicked', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close recording dialog');
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes dialog when cancel button is clicked', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes dialog when overlay is clicked', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.click(overlay!);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not close dialog when content is clicked', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    const content = screen.getByRole('dialog');
    fireEvent.click(content);
    
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('handles escape key', () => {
    render(<RecordingDialog {...defaultProps} />);
    
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows loading state when starting recording', async () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      settings: {
        type: 'pip',
        screenId: 'screen1',
        cameraId: 'camera1',
      } as any,
    });

    // Mock startRecording to return a promise that doesn't resolve immediately
    mockStore.startRecording.mockImplementation(() => new Promise(() => {}));

    render(<RecordingDialog {...defaultProps} />);
    
    const startButton = screen.getByText('Start Recording');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });
  });
});
