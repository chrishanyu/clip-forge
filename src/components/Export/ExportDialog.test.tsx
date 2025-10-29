import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportDialog } from './ExportDialog';
import { useTimelineStore } from '@/stores/timelineStore';
import { invoke } from '@tauri-apps/api/core';

// Mock the stores
vi.mock('@/stores/timelineStore');
vi.mock('@tauri-apps/api/core');

// Mock the CSS import
vi.mock('./ExportDialog.css', () => ({}));

const mockUseTimelineStore = vi.mocked(useTimelineStore);
const mockInvoke = vi.mocked(invoke);

describe('ExportDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnExportStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock timeline store with empty tracks
    mockUseTimelineStore.mockReturnValue({
      tracks: [],
      addClipToTrack: vi.fn(),
      removeClipFromTrack: vi.fn(),
      updateClipInTrack: vi.fn(),
      moveClipInTrack: vi.fn(),
      setPlayheadPosition: vi.fn(),
      playheadPosition: 0,
      isPlaying: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seekTo: vi.fn(),
      getActiveClipAtTime: vi.fn(),
      getTimelineDuration: vi.fn(),
      clearTimeline: vi.fn(),
      loadTimeline: vi.fn(),
      saveTimeline: vi.fn(),
    });
  });

  it('renders when open', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    expect(screen.getByText('Export Video')).toBeInTheDocument();
    expect(screen.getByLabelText('Filename')).toBeInTheDocument();
    expect(screen.getByLabelText('Output Location')).toBeInTheDocument();
    expect(screen.getByText('Resolution')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Codec')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ExportDialog 
        isOpen={false} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    expect(screen.queryByText('Export Video')).not.toBeInTheDocument();
  });

  it('initializes with default values', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    expect(screen.getByDisplayValue('exported_video')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1080p')).toBeInTheDocument();
    expect(screen.getByDisplayValue('medium')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mp4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('h264')).toBeInTheDocument();
  });

  it('updates filename when input changes', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const filenameInput = screen.getByLabelText('Filename');
    fireEvent.change(filenameInput, { target: { value: 'my_video' } });

    expect(filenameInput).toHaveValue('my_video');
  });

  it('updates resolution when radio button changes', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const sourceRadio = screen.getByDisplayValue('source');
    fireEvent.click(sourceRadio);

    expect(sourceRadio).toBeChecked();
  });

  it('updates quality when radio button changes', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const highQualityRadio = screen.getByDisplayValue('high');
    fireEvent.click(highQualityRadio);

    expect(highQualityRadio).toBeChecked();
  });

  it('updates format when radio button changes', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const movRadio = screen.getByDisplayValue('mov');
    fireEvent.click(movRadio);

    expect(movRadio).toBeChecked();
  });

  it('updates codec when radio button changes', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const h265Radio = screen.getByDisplayValue('h265');
    fireEvent.click(h265Radio);

    expect(h265Radio).toBeChecked();
  });

  it('calls select_output_path when browse button is clicked', async () => {
    mockInvoke.mockResolvedValue('/path/to/output');
    
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const browseButton = screen.getByText('Browse');
    fireEvent.click(browseButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select_output_path');
    });
  });

  it('updates output path when browse button returns a path', async () => {
    mockInvoke.mockResolvedValue('/path/to/output');
    
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const browseButton = screen.getByText('Browse');
    fireEvent.click(browseButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('/path/to/output')).toBeInTheDocument();
    });
  });

  it('shows validation error when filename is empty', async () => {
    mockUseTimelineStore.mockReturnValue({
      tracks: [{ clips: [] }],
      addClipToTrack: vi.fn(),
      removeClipFromTrack: vi.fn(),
      updateClipInTrack: vi.fn(),
      moveClipInTrack: vi.fn(),
      setPlayheadPosition: vi.fn(),
      playheadPosition: 0,
      isPlaying: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seekTo: vi.fn(),
      getActiveClipAtTime: vi.fn(),
      getTimelineDuration: vi.fn(),
      clearTimeline: vi.fn(),
      loadTimeline: vi.fn(),
      saveTimeline: vi.fn(),
    });

    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const filenameInput = screen.getByLabelText('Filename');
    fireEvent.change(filenameInput, { target: { value: '' } });

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Filename is required')).toBeInTheDocument();
    });
  });

  it('shows validation error when output path is empty', async () => {
    mockUseTimelineStore.mockReturnValue({
      tracks: [{ clips: [] }],
      addClipToTrack: vi.fn(),
      removeClipFromTrack: vi.fn(),
      updateClipInTrack: vi.fn(),
      moveClipInTrack: vi.fn(),
      setPlayheadPosition: vi.fn(),
      playheadPosition: 0,
      isPlaying: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seekTo: vi.fn(),
      getActiveClipAtTime: vi.fn(),
      getTimelineDuration: vi.fn(),
      clearTimeline: vi.fn(),
      loadTimeline: vi.fn(),
      saveTimeline: vi.fn(),
    });

    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Output path is required')).toBeInTheDocument();
    });
  });

  it('shows validation error when no clips in timeline', async () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const filenameInput = screen.getByLabelText('Filename');
    fireEvent.change(filenameInput, { target: { value: 'test' } });

    const outputPathInput = screen.getByLabelText('Output Location');
    fireEvent.change(outputPathInput, { target: { value: '/path/to/output' } });

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('No clips in timeline to export')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls export command when form is submitted with valid data', async () => {
    mockUseTimelineStore.mockReturnValue({
      tracks: [{ clips: [{ id: '1', filepath: '/test.mp4', startTime: 0, duration: 10, trimStart: 0, trimEnd: 10 }] }],
      addClipToTrack: vi.fn(),
      removeClipFromTrack: vi.fn(),
      updateClipInTrack: vi.fn(),
      moveClipInTrack: vi.fn(),
      setPlayheadPosition: vi.fn(),
      playheadPosition: 0,
      isPlaying: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seekTo: vi.fn(),
      getActiveClipAtTime: vi.fn(),
      getTimelineDuration: vi.fn(),
      clearTimeline: vi.fn(),
      loadTimeline: vi.fn(),
      saveTimeline: vi.fn(),
    });

    mockInvoke.mockResolvedValue({});

    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const filenameInput = screen.getByLabelText('Filename');
    fireEvent.change(filenameInput, { target: { value: 'test_video' } });

    const outputPathInput = screen.getByLabelText('Output Location');
    fireEvent.change(outputPathInput, { target: { value: '/path/to/output' } });

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('export_timeline_with_progress', {
        request: {
          output_path: '/path/to/output',
          settings: {
            resolution: '1080p',
            quality: 'medium',
            format: 'mp4',
            codec: 'h264'
          }
        }
      });
    });
  });

  it('shows error when export command fails', async () => {
    mockUseTimelineStore.mockReturnValue({
      tracks: [{ clips: [{ id: '1', filepath: '/test.mp4', startTime: 0, duration: 10, trimStart: 0, trimEnd: 10 }] }],
      addClipToTrack: vi.fn(),
      removeClipFromTrack: vi.fn(),
      updateClipInTrack: vi.fn(),
      moveClipInTrack: vi.fn(),
      setPlayheadPosition: vi.fn(),
      playheadPosition: 0,
      isPlaying: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seekTo: vi.fn(),
      getActiveClipAtTime: vi.fn(),
      getTimelineDuration: vi.fn(),
      clearTimeline: vi.fn(),
      loadTimeline: vi.fn(),
      saveTimeline: vi.fn(),
    });

    mockInvoke.mockRejectedValue(new Error('Export failed'));

    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const filenameInput = screen.getByLabelText('Filename');
    fireEvent.change(filenameInput, { target: { value: 'test_video' } });

    const outputPathInput = screen.getByLabelText('Output Location');
    fireEvent.change(outputPathInput, { target: { value: '/path/to/output' } });

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export failed: Error: Export failed')).toBeInTheDocument();
    });
  });

  it('disables form inputs when validating', async () => {
    mockUseTimelineStore.mockReturnValue({
      tracks: [{ clips: [{ id: '1', filepath: '/test.mp4', startTime: 0, duration: 10, trimStart: 0, trimEnd: 10 }] }],
      addClipToTrack: vi.fn(),
      removeClipFromTrack: vi.fn(),
      updateClipInTrack: vi.fn(),
      moveClipInTrack: vi.fn(),
      setPlayheadPosition: vi.fn(),
      playheadPosition: 0,
      isPlaying: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seekTo: vi.fn(),
      getActiveClipAtTime: vi.fn(),
      getTimelineDuration: vi.fn(),
      clearTimeline: vi.fn(),
      loadTimeline: vi.fn(),
      saveTimeline: vi.fn(),
    });

    // Mock a slow response
    mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <ExportDialog 
        isOpen={true} 
        onClose={mockOnClose} 
        onExportStart={mockOnExportStart} 
      />
    );

    const filenameInput = screen.getByLabelText('Filename');
    fireEvent.change(filenameInput, { target: { value: 'test_video' } });

    const outputPathInput = screen.getByLabelText('Output Location');
    fireEvent.change(outputPathInput, { target: { value: '/path/to/output' } });

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    // Check that inputs are disabled during validation
    expect(filenameInput).toBeDisabled();
    expect(outputPathInput).toBeDisabled();
    expect(screen.getByText('Starting Export...')).toBeInTheDocument();
  });
});
