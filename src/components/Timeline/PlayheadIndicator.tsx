import React, { useState, useRef, useCallback } from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import './PlayheadIndicator.css';

// ============================================================================
// PLAYHEAD INDICATOR COMPONENT INTERFACE
// ============================================================================

export interface PlayheadIndicatorProps {
  pixelsPerSecond: number;
  className?: string;
}

// ============================================================================
// PLAYHEAD INDICATOR COMPONENT
// ============================================================================

export const PlayheadIndicator: React.FC<PlayheadIndicatorProps> = ({
  pixelsPerSecond,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const playheadRef = useRef<HTMLDivElement>(null);
  
  const { playhead, setPlayhead, totalDuration } = useTimelineStore();

  // ============================================================================
  // CALCULATIONS
  // ============================================================================

  // Track header width offset (must match .track-header width in CSS)
  // Note: .track-header uses box-sizing: border-box, so 200px includes padding and border
  const TRACK_HEADER_WIDTH = 200;
  
  // Calculate playhead position accounting for track header offset
  const playheadX = (playhead * pixelsPerSecond) + TRACK_HEADER_WIDTH;

  // ============================================================================
  // DRAG HANDLING
  // ============================================================================

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    setIsDragging(true);
    setDragStartX(event.clientX);
    setDragStartTime(playhead);
    
    event.preventDefault();
  }, [playhead]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !playheadRef.current) return;
    
    const deltaX = event.clientX - dragStartX;
    const deltaTime = deltaX / pixelsPerSecond;
    const newPlayhead = Math.max(0, Math.min(totalDuration, dragStartTime + deltaTime));
    
    setPlayhead(newPlayhead);
  }, [isDragging, dragStartX, dragStartTime, pixelsPerSecond, totalDuration, setPlayhead]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  React.useEffect(() => {
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
    <div
      ref={playheadRef}
      className={`playhead-indicator ${isDragging ? 'dragging' : ''} ${className}`}
      style={{
        left: `${playheadX}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="playhead-line" />
      <div className="playhead-handle" />
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default PlayheadIndicator;
