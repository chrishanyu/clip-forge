import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import { createTimelineClip } from '@/types';
import { TimeRuler } from './TimeRuler';
import { TimelineTracks } from './TimelineTracks';
import { PlayheadIndicator } from './PlayheadIndicator';
import { ZoomControls } from './ZoomControls';
import './Timeline.css';

// ============================================================================
// TIMELINE COMPONENT INTERFACE
// ============================================================================

export interface TimelineProps {
  className?: string;
}

// ============================================================================
// TIMELINE COMPONENT
// ============================================================================

export const Timeline: React.FC<TimelineProps> = ({ className = '' }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);

  // Timeline store
  const {
    playhead,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setPlayhead,
    addClipToTrack,
    snapToGrid,
    toggleSnapToGrid,
    removeDuplicateClips,
  } = useTimelineStore();

  // ============================================================================
  // TIMELINE CONSTANTS
  // ============================================================================

  const PIXELS_PER_SECOND = 100; // Base pixels per second
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 10;
  const ZOOM_STEP = 0.2;

  // ============================================================================
  // TIMELINE CALCULATIONS
  // ============================================================================

  /**
   * Get the current pixels per second based on zoom level
   */
  const getPixelsPerSecond = useCallback(() => {
    return PIXELS_PER_SECOND * zoom;
  }, [zoom]);

  /**
   * Convert time to pixel position
   */
  const timeToPixels = useCallback((time: number) => {
    return time * getPixelsPerSecond();
  }, [getPixelsPerSecond]);

  /**
   * Convert pixel position to time
   */
  const pixelsToTime = useCallback((pixels: number) => {
    return pixels / getPixelsPerSecond();
  }, [getPixelsPerSecond]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Clean up duplicate clips on mount
  useEffect(() => {
    removeDuplicateClips();
  }, [removeDuplicateClips]);

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
   * Handle mouse wheel scrolling (zoom)
   */
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const delta = event.deltaY;
    const zoomFactor = delta > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor));
    
    if (newZoom !== zoom) {
      setZoom(newZoom);
    }
  }, [zoom, setZoom]);

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
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left + timelineRef.current.scrollLeft;
    const clickTime = pixelsToTime(clickX);
    
    setPlayhead(Math.max(0, clickTime));
  }, [pixelsToTime, setPlayhead]);

  // ============================================================================
  // EFFECTS
  // ============================================================================


  // Add wheel event listener for zoom
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
      {/* Timeline Header */}
      <div className="timeline-header">
        <ZoomControls
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          snapToGrid={snapToGrid}
          onToggleSnap={toggleSnapToGrid}
        />
      </div>

      {/* Timeline Container */}
      <div className="timeline-container">
        {/* Time Ruler */}
        <TimeRuler
          pixelsPerSecond={getPixelsPerSecond()}
          onTimeClick={setPlayhead}
        />

        {/* Timeline Content */}
        <div
          ref={timelineRef}
          className="timeline-content"
          onMouseDown={handleMouseDown}
          onClick={handleTimelineClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default Timeline;
