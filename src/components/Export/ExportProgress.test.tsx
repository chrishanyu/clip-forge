import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportProgress } from './ExportProgress';
import { useExportStore } from '@/stores/exportStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Mock the stores
vi.mock('@/stores/exportStore');
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

// Mock the CSS import
vi.mock('./ExportProgress.css', () => ({}));

const mockUseExportStore = vi.mocked(useExportStore);
const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe('ExportProgress', () => {
  const mockOnClose = vi.fn();
  const mockOnCancel = vi.fn();

  const mockStoreActions = {
    updateProgress: vi.fn(),
    completeExport: vi.fn(),
    cancelExport: vi.fn(),
    setError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock export store
    mockUseExportStore.mockReturnValue({
      isExporting: false,
      isProgressVisible: false,
      progress: null,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    // Mock Tauri APIs
    mockInvoke.mockResolvedValue({});
    mockListen.mockResolvedValue(vi.fn());
  });

  it('renders when visible with progress data', () => {
    const mockProgress = {
      progress: 50,
      current_step: 'Encoding video...',
      estimated_time_remaining: 120,
      error: null,
      current_frame: 1000,
      total_frames: 2000,
      fps: 30.5,
      bitrate: 2500,
      time: '00:00:33.33',
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('Export Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Encoding video...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(
      <ExportProgress 
        isVisible={false} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.queryByText('Export Progress')).not.toBeInTheDocument();
  });

  it('does not render when no progress data', () => {
    mockUseExportStore.mockReturnValue({
      isExporting: false,
      isProgressVisible: true,
      progress: null,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.queryByText('Export Progress')).not.toBeInTheDocument();
  });

  it('displays progress bar with correct width', () => {
    const mockProgress = {
      progress: 75,
      current_step: 'Processing...',
      estimated_time_remaining: 60,
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    const progressFill = screen.getByRole('progressbar', { hidden: true });
    expect(progressFill).toHaveStyle({ width: '75%' });
  });

  it('displays frame information when available', () => {
    const mockProgress = {
      progress: 50,
      current_step: 'Encoding...',
      estimated_time_remaining: 120,
      error: null,
      current_frame: 1500,
      total_frames: 3000,
      fps: 25.0,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('1500 / 3000')).toBeInTheDocument();
    expect(screen.getByText('25.0')).toBeInTheDocument();
  });

  it('displays bitrate information when available', () => {
    const mockProgress = {
      progress: 30,
      current_step: 'Encoding...',
      estimated_time_remaining: 180,
      error: null,
      bitrate: 5000,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('5000 kbps')).toBeInTheDocument();
  });

  it('displays time position when available', () => {
    const mockProgress = {
      progress: 40,
      current_step: 'Encoding...',
      estimated_time_remaining: 150,
      error: null,
      time: '00:01:23.45',
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('00:01:23.45')).toBeInTheDocument();
  });

  it('shows error message when export fails', () => {
    const mockProgress = {
      progress: 25,
      current_step: 'Export failed',
      estimated_time_remaining: 0,
      error: 'FFmpeg error: Invalid input file',
    };

    mockUseExportStore.mockReturnValue({
      isExporting: false,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('FFmpeg error: Invalid input file')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('shows success message when export completes', () => {
    const mockProgress = {
      progress: 100,
      current_step: 'Export completed',
      estimated_time_remaining: 0,
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: false,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('Export completed successfully!')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('calls cancel export when cancel button is clicked', async () => {
    const mockProgress = {
      progress: 50,
      current_step: 'Encoding...',
      estimated_time_remaining: 120,
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('cancel_export', { exportId: 'current' });
      expect(mockStoreActions.cancelExport).toHaveBeenCalled();
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  it('handles cancel export error', async () => {
    const mockProgress = {
      progress: 50,
      current_step: 'Encoding...',
      estimated_time_remaining: 120,
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    mockInvoke.mockRejectedValue(new Error('Cancel failed'));

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockStoreActions.setError).toHaveBeenCalledWith('Failed to cancel export');
    });
  });

  it('calls onClose when close button is clicked', () => {
    const mockProgress = {
      progress: 100,
      current_step: 'Export completed',
      estimated_time_remaining: 0,
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: false,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    const closeButton = screen.getByText('Done');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables cancel button when not exporting', () => {
    const mockProgress = {
      progress: 0,
      current_step: 'Preparing...',
      estimated_time_remaining: 0,
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: false,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
  });

  it('formats time correctly', () => {
    const mockProgress = {
      progress: 50,
      current_step: 'Encoding...',
      estimated_time_remaining: 3661, // 1 hour, 1 minute, 1 second
      error: null,
    };

    mockUseExportStore.mockReturnValue({
      isExporting: true,
      isProgressVisible: true,
      progress: mockProgress,
      settings: null,
      startExport: vi.fn(),
      updateProgress: mockStoreActions.updateProgress,
      completeExport: mockStoreActions.completeExport,
      cancelExport: mockStoreActions.cancelExport,
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      setError: mockStoreActions.setError,
      resetExport: vi.fn(),
    });

    render(
      <ExportProgress 
        isVisible={true} 
        onClose={mockOnClose} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('1:01:01')).toBeInTheDocument();
  });
});
