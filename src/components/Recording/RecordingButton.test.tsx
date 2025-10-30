/**
 * RecordingButton Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordingButton } from './RecordingButton';
import { useRecordingStore } from '@/stores/recordingStore';

// Mock the recording store
jest.mock('@/stores/recordingStore');
const mockUseRecordingStore = useRecordingStore as jest.MockedFunction<typeof useRecordingStore>;

describe('RecordingButton', () => {
  const mockStore = {
    isDialogOpen: false,
    isRecordingIndicatorVisible: false,
    currentSession: null,
    openRecordingDialog: jest.fn(),
    closeRecordingDialog: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRecordingStore.mockReturnValue(mockStore);
  });

  it('renders with default state', () => {
    render(<RecordingButton />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Record')).toBeInTheDocument();
    expect(screen.getByText('🔴')).toBeInTheDocument();
  });

  it('opens dialog when clicked', () => {
    render(<RecordingButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockStore.openRecordingDialog).toHaveBeenCalled();
  });

  it('closes dialog when clicked while dialog is open', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      isDialogOpen: true,
    });

    render(<RecordingButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockStore.closeRecordingDialog).toHaveBeenCalled();
  });

  it('shows recording state when recording', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      currentSession: {
        id: 'test-session',
        type: 'pip',
        settings: {} as any,
        status: 'recording',
        startTime: new Date().toISOString(),
        duration: 0,
      },
    });

    render(<RecordingButton />);
    
    expect(screen.getByText('Recording...')).toBeInTheDocument();
    expect(screen.getByText('⏹️')).toBeInTheDocument();
    expect(screen.getByText('●')).toBeInTheDocument();
  });

  it('shows preparing state when preparing', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      currentSession: {
        id: 'test-session',
        type: 'pip',
        settings: {} as any,
        status: 'preparing',
        startTime: new Date().toISOString(),
        duration: 0,
      },
    });

    render(<RecordingButton />);
    
    expect(screen.getByText('Preparing...')).toBeInTheDocument();
    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  it('shows stopping state when stopping', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      currentSession: {
        id: 'test-session',
        type: 'pip',
        settings: {} as any,
        status: 'stopping',
        startTime: new Date().toISOString(),
        duration: 0,
      },
    });

    render(<RecordingButton />);
    
    expect(screen.getByText('Stopping...')).toBeInTheDocument();
    expect(screen.getByText('⏹️')).toBeInTheDocument();
  });

  it('is disabled when there is an error', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      currentSession: {
        id: 'test-session',
        type: 'pip',
        settings: {} as any,
        status: 'error',
        startTime: new Date().toISOString(),
        duration: 0,
      },
    });

    render(<RecordingButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('is disabled when dialog is open', () => {
    mockUseRecordingStore.mockReturnValue({
      ...mockStore,
      isDialogOpen: true,
    });

    render(<RecordingButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('has correct accessibility attributes', () => {
    render(<RecordingButton />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Start recording screen and webcam');
    expect(button).toHaveAttribute('title', 'Start recording screen and webcam');
  });

  it('applies custom className', () => {
    render(<RecordingButton className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});
