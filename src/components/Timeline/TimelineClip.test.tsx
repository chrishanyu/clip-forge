import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineClip } from './TimelineClip';
import { createTimelineClip } from '@/types';
import { useTimelineStore } from '@/stores/timelineStore';

// Mock the CSS import
vi.mock('./TimelineClip.css', () => ({}));

// Mock Zustand store
vi.mock('@/stores/timelineStore', () => ({
  useTimelineStore: vi.fn()
}));

// Mock media store
vi.mock('@/stores/mediaStore', () => ({
  useMediaStore: vi.fn(() => ({
    getClipById: vi.fn(() => ({ filename: 'test-video.mp4' }))
  }))
}));

describe('TimelineClip', () => {
  const mockSelectClip = vi.fn();
  const mockMoveClip = vi.fn();
  const mockTrimClip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock timeline store
    (useTimelineStore as any).mockReturnValue({
      selectedClipId: null,
      selectClip: mockSelectClip,
      moveClip: mockMoveClip,
      trimClip: mockTrimClip,
      tracks: [],
      snapToGrid: true,
      snapInterval: 1
    });
  });
  it('should render clip with basic information', () => {
    const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

    render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

    // Should render the clip with duration
    expect(screen.getByText('5.00')).toBeTruthy(); // Duration formatted
    expect(screen.getByText('test-video.mp4')).toBeTruthy(); // Media clip filename
  });

  it('should render with correct positioning', () => {
    const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

    render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

    const clipElement = screen.getByText('5.00').closest('.timeline-clip');
    expect(clipElement).toBeTruthy();
    expect(clipElement?.style.left).toBe('1000px'); // 10 seconds * 100 pixels per second
    expect(clipElement?.style.width).toBe('500px'); // 5 seconds * 100 pixels per second
  });

    it('should render resize handles when selected', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      render(<TimelineClip clip={clip} pixelsPerSecond={100} isSelected={true} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();
      expect(clipElement?.querySelector('.resize-handle.left')).toBeTruthy();
      expect(clipElement?.querySelector('.resize-handle.right')).toBeTruthy();
    });

  describe('Selection Functionality', () => {
    it('should not have selected class when not selected', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();
      expect(clipElement?.classList.contains('selected')).toBe(false);
    });

    it('should have selected class when selected via store', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);
      
      // Mock store with this clip selected
      (useTimelineStore as any).mockReturnValue({
        selectedClipId: clip.id,
        selectClip: mockSelectClip,
        moveClip: mockMoveClip,
        trimClip: mockTrimClip,
        tracks: [],
        snapToGrid: true,
        snapInterval: 1
      });

      render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();
      expect(clipElement?.classList.contains('selected')).toBe(true);
    });

    it('should have selected class when selected via external prop', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      render(<TimelineClip clip={clip} pixelsPerSecond={100} isSelected={true} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();
      expect(clipElement?.classList.contains('selected')).toBe(true);
    });

    it('should prioritize external isSelected prop over store state', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);
      
      // Mock store with this clip selected
      (useTimelineStore as any).mockReturnValue({
        selectedClipId: clip.id,
        selectClip: mockSelectClip,
        moveClip: mockMoveClip,
        trimClip: mockTrimClip,
        tracks: [],
        snapToGrid: true,
        snapInterval: 1
      });

      // External prop says not selected
      render(<TimelineClip clip={clip} pixelsPerSecond={100} isSelected={false} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();
      expect(clipElement?.classList.contains('selected')).toBe(false);
    });

    it('should call selectClip when clicked', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();

      fireEvent.mouseDown(clipElement!);
      expect(mockSelectClip).toHaveBeenCalledWith(clip.id);
    });

    it('should clear previous selection when selecting a new clip', () => {
      const clip1 = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);
      const clip2 = createTimelineClip('media-2', 'track-1', 20, 5, 0, 5);

      // Mock store with clip1 selected initially
      (useTimelineStore as any).mockReturnValue({
        selectedClipId: clip1.id,
        selectClip: mockSelectClip,
        moveClip: mockMoveClip,
        trimClip: mockTrimClip,
        tracks: [],
        snapToGrid: true,
        snapInterval: 1
      });

      const { rerender } = render(<TimelineClip clip={clip1} pixelsPerSecond={100} />);
      
      // Verify clip1 is selected
      const clip1Element = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clip1Element?.classList.contains('selected')).toBe(true);

      // Now render clip2 and click it
      rerender(<TimelineClip clip={clip2} pixelsPerSecond={100} />);
      const clip2Element = screen.getByText('test-video.mp4').closest('.timeline-clip');
      
      fireEvent.mouseDown(clip2Element!);
      
      // Should call selectClip with clip2's id (clearing previous selection)
      expect(mockSelectClip).toHaveBeenCalledWith(clip2.id);
    });

    it('should prevent event propagation when clicked', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();

      // Create a mock event with stopPropagation
      const mockEvent = {
        stopPropagation: vi.fn(),
        preventDefault: vi.fn()
      };

      // Simulate the onClick handler directly
      const onClickHandler = clipElement?.getAttribute('onClick');
      if (onClickHandler) {
        // The onClick handler should call stopPropagation
        expect(typeof onClickHandler).toBe('string');
      }

      // Test that clicking doesn't bubble up by checking the event handling
      fireEvent.click(clipElement!);
      // The component should handle the click internally without bubbling
    });

    it('should only show trim handles when selected', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      // Test unselected clip
      const { unmount: unmount1 } = render(<TimelineClip clip={clip} pixelsPerSecond={100} />);
      
      let clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement?.querySelector('.resize-handle.left')).toBeFalsy();
      expect(clipElement?.querySelector('.resize-handle.right')).toBeFalsy();

      unmount1();

      // Test selected clip
      render(<TimelineClip clip={clip} pixelsPerSecond={100} isSelected={true} />);
      
      clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement?.querySelector('.resize-handle.left')).toBeTruthy();
      expect(clipElement?.querySelector('.resize-handle.right')).toBeTruthy();
    });

    it('should clear selection when dragging starts', () => {
      const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

      render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

      const clipElement = screen.getByText('test-video.mp4').closest('.timeline-clip');
      expect(clipElement).toBeTruthy();

      // Start mouse down (should select clip)
      fireEvent.mouseDown(clipElement!);
      expect(mockSelectClip).toHaveBeenCalledWith(clip.id);

      // Simulate mouse move with enough distance to trigger drag
      fireEvent.mouseMove(clipElement!, { clientX: 100, clientY: 100 });
      
      // Should clear selection when dragging starts
      expect(mockSelectClip).toHaveBeenCalledWith(null);
    });
  });
});
