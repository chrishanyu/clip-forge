import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineClip } from './TimelineClip';
import { createTimelineClip } from '@/types';

// Mock the CSS import
vi.mock('./TimelineClip.css', () => ({}));

describe('TimelineClip', () => {
  it('should render clip with basic information', () => {
    const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

    render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

    // Should render the clip with duration
    expect(screen.getByText('5.00')).toBeTruthy(); // Duration formatted
    expect(screen.getByText('Unknown Clip')).toBeTruthy(); // Default name when no media clip
  });

  it('should render with correct positioning', () => {
    const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

    render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

    const clipElement = screen.getByText('5.00').closest('.timeline-clip');
    expect(clipElement).toBeTruthy();
    expect(clipElement?.style.left).toBe('1000px'); // 10 seconds * 100 pixels per second
    expect(clipElement?.style.width).toBe('500px'); // 5 seconds * 100 pixels per second
  });

  it('should render resize handles', () => {
    const clip = createTimelineClip('media-1', 'track-1', 10, 5, 0, 5);

    render(<TimelineClip clip={clip} pixelsPerSecond={100} />);

    const clipElement = screen.getByText('Unknown Clip').closest('.timeline-clip');
    expect(clipElement).toBeTruthy();
    expect(clipElement?.querySelector('.resize-handle.left')).toBeTruthy();
    expect(clipElement?.querySelector('.resize-handle.right')).toBeTruthy();
  });
});
