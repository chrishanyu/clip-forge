import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import { createTimelineClip } from '@/types';
import { TimeRuler } from './TimeRuler';
import { TimelineTracks } from './TimelineTracks';
import { PlayheadIndicator } from './PlayheadIndicator';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import './Timeline.css';

// ============================================================================
// TIMELINE COMPONENT INTERFACE
// ============================================================================

export interface TimelineProps {
  className?: string;
}

// ============================================================================
// TIMELINE CONFIGURATION
// ============================================================================

const TIMELINE_CONFIG = {
  MIN_VISIBLE_DURATION: 60,    // Always show at least 60 seconds
  BUFFER_AFTER_CONTENT: 30,    // 30 seconds of empty space after last clip
  PIXELS_PER_SECOND: 10        // Fixed pixels per second (10px = 1 second)
} as const;

// ============================================================================
// TIMELINE COMPONENT
// ============================================================================

export const Timeline: React.FC<TimelineProps> = ({ className = '' }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  // Timeline store
  const {
    playhead,
    setPlayhead,
    addClipToTrack,
    snapToGrid,
    toggleSnapToGrid,
    removeDuplicateClips,
    timelineDuration,
    deleteSelectedClip,
  } = useTimelineStore();

  // ============================================================================
  // TIMELINE CALCULATIONS
  // ============================================================================

  /**
   * Calculate timeline canvas width based on content duration
   * This is the actual pixel width of the scrollable timeline area
   * Minimum width ensures timeline is always at least as wide as the viewport
   */
  const canvasWidth = useMemo(() => {
    const contentWidth = timelineDuration * TIMELINE_CONFIG.PIXELS_PER_SECOND;
    
    // Use full viewport width as minimum (track header is inside the tracks, not overlaying)
    const minWidth = Math.max(600, viewportWidth); // Minimum 600px to ensure usability
    
    const width = Math.max(minWidth, contentWidth);
    
    return width;
  }, [timelineDuration, viewportWidth]);

  /**
   * Get the current pixels per second (fixed, no zoom)
   */
  const getPixelsPerSecond = useCallback(() => {
    return TIMELINE_CONFIG.PIXELS_PER_SECOND;
  }, []);

  /**
   * Convert time to pixel position
   * NOTE: This returns absolute pixel position in timeline coordinate space
   */
  const timeToPixels = useCallback((time: number) => {
    return time * getPixelsPerSecond();
  }, [getPixelsPerSecond]);

  /**
   * Convert pixel position to time
   * NOTE: Input should be in timeline coordinate space (not viewport coordinates)
   */
  const pixelsToTime = useCallback((pixels: number) => {
    return pixels / getPixelsPerSecond();
  }, [getPixelsPerSecond]);

  /**
   * Convert mouse viewport coordinates to timeline time position
   * Accounts for scroll position
   * 
   * CRITICAL: This is the canonical way to convert mouse events to timeline positions
   * Used by: click handler, drop zones
   * NOT used by: drag operations (which use delta-based positioning)
   */
  const mouseToTimelineTime = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    
    // Track header width offset (must match .track-header width in CSS)
    // Note: .track-header uses box-sizing: border-box, so 200px includes padding and border
    const TRACK_HEADER_WIDTH = 200;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft || 0;
    
    // Calculate relative X position accounting for scroll and track header offset
    const relativeX = (clientX - rect.left) + scrollLeft - TRACK_HEADER_WIDTH;
    
    // Convert pixels to time
    const time = pixelsToTime(relativeX);
    
    return Math.max(0, time);
  }, [pixelsToTime]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Clean up duplicate clips on mount
  useEffect(() => {
    removeDuplicateClips();
  }, [removeDuplicateClips]);

  // Update viewport width on mount and resize
  useEffect(() => {
    const updateViewportWidth = () => {
      if (timelineRef.current) {
        setViewportWidth(timelineRef.current.clientWidth);
      }
    };

    // Set initial viewport width
    updateViewportWidth();

    // Update on window resize
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // ============================================================================
  // DROP HANDLING
  // ============================================================================

  /**
   * Handle dropping a clip on a track
   */
  const handleTrackDrop = useCallback((trackId: string, startTime: number, mediaClip: any) => {
    try {
      // Create timeline clip from media clip
      // Parameters: mediaClipId, trackId, startTime, duration, trimStart, trimEnd
      const timelineClip = createTimelineClip(
        mediaClip.id,                    // mediaClipId (string)
        trackId,                         // trackId (string)
        startTime,                       // startTime (number)
        mediaClip.metadata.duration,     // duration (number)
        0,                               // trimStart (starts at beginning)
        mediaClip.metadata.duration      // trimEnd (ends at full duration)
      );
      
      // Add clip to track
      addClipToTrack(timelineClip, trackId);
    } catch (error) {
      console.error('Failed to add clip to timeline:', error);
    }
  }, [addClipToTrack]);

  // ============================================================================
  // SCROLL HANDLING
  // ============================================================================

  /**
   * Handle touchpad/mouse wheel scrolling (horizontal scroll)
   */
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!timelineRef.current) return;
    
    // Prevent default to handle scrolling ourselves
    event.preventDefault();
    
    // Use deltaX for horizontal scroll, deltaY for vertical scroll
    // Most touchpads will send deltaX for horizontal gestures
    // For vertical wheel on mouse, convert to horizontal scroll
    const scrollAmount = event.deltaX !== 0 ? event.deltaX : event.deltaY;
    
    timelineRef.current.scrollLeft += scrollAmount;
  }, []);

  /**
   * Handle mouse down for dragging
   */
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only left mouse button
    
    setIsDragging(true);
    setDragStartX(event.clientX);
    setScrollStartX(timelineRef.current?.scrollLeft || 0);
    
    event.preventDefault();
  }, []);

  /**
   * Handle mouse move for dragging
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    
    const deltaX = event.clientX - dragStartX;
    const newScrollLeft = scrollStartX - deltaX;
    
    timelineRef.current.scrollLeft = newScrollLeft;
  }, [isDragging, dragStartX, scrollStartX]);

  /**
   * Handle mouse up for dragging
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Handle timeline click to seek
   */
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    // Focus the timeline element for keyboard events
    if (timelineRef.current) {
      timelineRef.current.focus();
    }
    
    const clickTime = mouseToTimelineTime(event.clientX);
    setPlayhead(clickTime);
  }, [mouseToTimelineTime, setPlayhead]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  // Define keyboard shortcuts for timeline
  const keyboardShortcuts = useMemo(() => [
    {
      key: COMMON_SHORTCUTS.DELETE,
      action: deleteSelectedClip,
      description: 'Delete selected clip'
    },
    {
      key: COMMON_SHORTCUTS.BACKSPACE,
      action: deleteSelectedClip,
      description: 'Delete selected clip (alternative)'
    }
  ], [deleteSelectedClip]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts(keyboardShortcuts, {
    enabled: true,
    target: timelineRef.current
  });

  // Focus timeline on mount for keyboard events
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.focus();
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================


  // Add wheel event listener for horizontal scrolling
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    timeline.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      timeline.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      handleMouseMove(event);
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`timeline ${className}`}>
      {/* Timeline Container */}
      <div className="timeline-container">
        {/* Time Ruler */}
        <TimeRuler
          pixelsPerSecond={getPixelsPerSecond()}
          timelineDuration={timelineDuration}
          onTimeClick={setPlayhead}
        />

        {/* Timeline Content (Scrollable Viewport) */}
        <div
          ref={timelineRef}
          className="timeline-content"
          onMouseDown={handleMouseDown}
          onClick={handleTimelineClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          tabIndex={0}
        >
          {/* Timeline Canvas (Explicit width container for all timeline elements) */}
          <div 
            className="timeline-canvas"
            style={{ width: `${canvasWidth}px` }}
          >
            {/* Playhead Indicator */}
            <PlayheadIndicator
              pixelsPerSecond={getPixelsPerSecond()}
            />

            {/* Timeline Tracks */}
            <TimelineTracks
              pixelsPerSecond={getPixelsPerSecond()}
              onDrop={handleTrackDrop}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default Timeline;
