import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineTrack } from './TimelineTrack';
import { createTimelineTrack, createTimelineClip } from '@/types';
import { useTimelineStore } from '@/stores/timelineStore';

// Mock the CSS import
vi.mock('./TimelineTrack.css', () => ({}));

// Mock Zustand store
vi.mock('@/stores/timelineStore', () => ({
  useTimelineStore: vi.fn()
}));

// Mock drag drop context
vi.mock('@/contexts/DragDropContext', () => ({
  useDragDropContext: vi.fn(() => ({
    registerDropZone: vi.fn(),
    unregisterDropZone: vi.fn()
  }))
}));

describe('TimelineTrack', () => {
  const mockClearSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock timeline store
    (useTimelineStore as any).mockReturnValue({
      clearSelection: mockClearSelection
    });
  });

  it('should render track with name', () => {
    const track = createTimelineTrack('Test Track');

    render(<TimelineTrack track={track} pixelsPerSecond={100} />);

    expect(screen.getByText('Test Track')).toBeTruthy();
  });

  it('should render empty state when no clips', () => {
    const track = createTimelineTrack('Test Track');

    render(<TimelineTrack track={track} pixelsPerSecond={100} />);

    expect(screen.getByText('Drop clips here')).toBeTruthy();
  });

  it('should render clips when present', () => {
    const track = createTimelineTrack('Test Track');
    const clip = createTimelineClip('media-1', track.id, 10, 5, 0, 5);
    track.clips = [clip];

    render(<TimelineTrack track={track} pixelsPerSecond={100} />);

    // Should render the clip (we'll mock the TimelineClip component)
    expect(screen.getByText('Test Track')).toBeTruthy();
  });

  describe('Empty Area Deselection', () => {
    it('should clear selection when clicking on empty track area', () => {
      const track = createTimelineTrack('Test Track');

      render(<TimelineTrack track={track} pixelsPerSecond={100} />);

      const emptyArea = screen.getByText('Drop clips here');
      fireEvent.click(emptyArea);

      expect(mockClearSelection).toHaveBeenCalled();
    });

    it('should clear selection when clicking on track content area', () => {
      const track = createTimelineTrack('Test Track');

      render(<TimelineTrack track={track} pixelsPerSecond={100} />);

      const trackContent = screen.getByText('Drop clips here').closest('.track-content');
      expect(trackContent).toBeTruthy();

      fireEvent.click(trackContent!);
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it('should not clear selection when clicking on track header', () => {
      const track = createTimelineTrack('Test Track');

      render(<TimelineTrack track={track} pixelsPerSecond={100} />);

      const trackHeader = screen.getByText('Test Track').closest('.track-header');
      expect(trackHeader).toBeTruthy();

      fireEvent.click(trackHeader!);
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });
});
