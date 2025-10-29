import React, { useState, useRef, useCallback } from 'react';
import { TimelineClip as TimelineClipType } from '@/types';
import { useTimelineStore } from '@/stores/timelineStore';
import { useMediaStore } from '@/stores/mediaStore';
import './TimelineClip.css';

// ============================================================================
// TIMELINE CLIP COMPONENT INTERFACE
// ============================================================================

export interface TimelineClipProps {
  clip: TimelineClipType;
  pixelsPerSecond: number;
  className?: string;
  isSelected?: boolean; // Optional prop for external selection state control
}

// ============================================================================
// TIMELINE CLIP COMPONENT
// ============================================================================

export const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  pixelsPerSecond,
  className = '',
  isSelected: externalIsSelected
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingOverTrack, setIsDraggingOverTrack] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState({ x: 0, y: 0, visible: false });
  const [hasMoved, setHasMoved] = useState(false);
  const clipRef = useRef<HTMLDivElement>(null);

  const { selectedClipId, selectClip, moveClip, trimClip, tracks, snapToGrid, snapInterval } = useTimelineStore();
  const { getClipById } = useMediaStore();

  // ============================================================================
  // CLIP CALCULATIONS
  // ============================================================================

  const clipX = clip.startTime * pixelsPerSecond;
  const clipWidth = clip.duration * pixelsPerSecond;
  const isSelected = externalIsSelected !== undefined ? externalIsSelected : selectedClipId === clip.id;
  
  // Get the media clip to display its filename
  const mediaClip = getClipById(clip.mediaClipId);
  const clipName = mediaClip?.filename || 'Unknown Clip';

  // ============================================================================
  // SNAP TO GRID FUNCTIONS
  // ============================================================================

  /**
   * Snap a time value to the grid
   */
  const snapToGridTime = useCallback((time: number): number => {
    if (!snapToGrid) return time;
    return Math.round(time / snapInterval) * snapInterval;
  }, [snapToGrid, snapInterval]);

  /**
   * Check for collisions with other clips on the same track
   */
  const checkCollision = useCallback((startTime: number, trackId: string): boolean => {
    const targetTrack = tracks.find(t => t.id === trackId);
    if (!targetTrack) return false;

    const clipEnd = startTime + clip.duration;
    
    return targetTrack.clips.some(existingClip => {
      if (existingClip.id === clip.id) return false; // Don't collide with self
      
      const existingEnd = existingClip.startTime + existingClip.duration;
      
      return (
        (startTime < existingEnd && clipEnd > existingClip.startTime)
      );
    });
  }, [tracks, clip.id, clip.duration]);

  /**
   * Apply drag constraints to prevent invalid positions
   */
  const applyDragConstraints = useCallback((startTime: number, trackId: string): { time: number; valid: boolean } => {
    // Constraint 1: Minimum time position (cannot be negative)
    const minTime = 0;
    const constrainedTime = Math.max(minTime, startTime);
    
    // Constraint 2: Maximum time position (cannot exceed reasonable timeline length)
    // For now, we'll allow up to 10 hours of content
    const maxTime = 10 * 60 * 60; // 10 hours in seconds
    const finalTime = Math.min(maxTime, constrainedTime);
    
    // Constraint 3: Minimum distance from timeline start (0.1 seconds buffer)
    const minStartBuffer = 0.1;
    const bufferedTime = Math.max(minStartBuffer, finalTime);
    
    // Constraint 4: Minimum distance from other clips (if snap is enabled)
    let validTime = bufferedTime;
    let isValid = true;
    
    if (snapToGrid) {
      // Apply snap-to-grid
      validTime = snapToGridTime(bufferedTime);
      
      // Check for collisions
      if (checkCollision(validTime, trackId)) {
        // Try to find a nearby valid position
        const searchRadius = snapInterval * 2; // Search within 2 snap intervals
        const searchStep = snapInterval * 0.1; // Search in 0.1 second steps
        
        for (let offset = searchStep; offset <= searchRadius; offset += searchStep) {
          // Try positions before and after
          const positions = [
            validTime - offset,
            validTime + offset
          ].filter(t => t >= minTime && t <= maxTime);
          
          for (const pos of positions) {
            const snappedPos = snapToGridTime(pos);
            if (!checkCollision(snappedPos, trackId)) {
              return { time: snappedPos, valid: true };
            }
          }
        }
        
        // If no valid position found, return the snapped time but mark as invalid
        isValid = false;
      }
    } else {
      // Without snap-to-grid, just check for collisions
      if (checkCollision(validTime, trackId)) {
        isValid = false;
      }
    }
    
    return { time: validTime, valid: isValid };
  }, [snapToGridTime, checkCollision, snapInterval, snapToGrid]);

  // ============================================================================
  // DRAG HANDLING
  // ============================================================================

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Select the clip
    selectClip(clip.id);
    
    // Start dragging
    setIsDragging(true);
    setDragStartX(event.clientX);
    setDragStartTime(clip.startTime);
    
    // Calculate initial offset for smooth dragging
    const rect = clipRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }
    
    event.preventDefault();
  }, [clip.id, clip.startTime, selectClip]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !clipRef.current) return;
    
    // POSITIONING STRATEGY: Delta-based (relative movement)
    // This approach is scroll-independent because we calculate the change in position
    // from the initial drag point, not absolute coordinates. This differs from drop
    // zones which need to account for scroll position since they convert absolute
    // mouse coordinates to timeline positions.
    const deltaX = event.clientX - dragStartX;
    const deltaTime = deltaX / pixelsPerSecond;
    const rawStartTime = Math.max(0, dragStartTime + deltaTime);
    
    // Minimum drag distance to prevent accidental moves (5 pixels)
    const minDragDistance = 5;
    const hasMovedEnough = Math.abs(deltaX) > minDragDistance;
    
    if (!hasMovedEnough) {
      // Don't start dragging until minimum distance is reached
      return;
    }
    
    // Mark as moved and clear selection when dragging starts
    if (!hasMoved) {
      setHasMoved(true);
      // Clear selection when user starts dragging
      selectClip(null);
    }
    
    // Update drag preview position
    setDragPreview({
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y,
      visible: true
    });
    
    // Check if we're dragging over a different track
    const trackElements = document.querySelectorAll('[data-track-id]');
    let targetTrackId = clip.trackId;
    
    for (const trackElement of trackElements) {
      const rect = trackElement.getBoundingClientRect();
      const trackId = trackElement.getAttribute('data-track-id');
      
      if (trackId && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        targetTrackId = trackId;
        setIsDraggingOverTrack(trackId);
        break;
      }
    }
    
    // Apply drag constraints to find valid position
    const { time: validTime, valid } = applyDragConstraints(rawStartTime, targetTrackId);
    
    // Update clip position (including potential track change)
    moveClip(clip.id, validTime, targetTrackId);
    
    // Update visual feedback based on validity
    if (clipRef.current) {
      clipRef.current.style.borderColor = valid ? 'var(--color-success, #10B981)' : 'var(--color-danger, #EF4444)';
    }
  }, [isDragging, dragStartX, dragStartTime, pixelsPerSecond, clip.id, clip.trackId, moveClip, dragOffset, applyDragConstraints, hasMoved]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingOverTrack(null);
    setDragOffset({ x: 0, y: 0 });
    setDragPreview({ x: 0, y: 0, visible: false });
    setHasMoved(false);
    
    // Reset visual feedback
    if (clipRef.current) {
      clipRef.current.style.borderColor = '';
    }
  }, []);

  // ============================================================================
  // RESIZE HANDLING
  // ============================================================================

  const handleResizeStart = (event: React.MouseEvent, side: 'left' | 'right') => {
    event.stopPropagation();
    
    setIsResizing(side);
    setDragStartX(event.clientX);
    setDragStartTime(side === 'left' ? clip.trimStart : clip.trimEnd);
    
    event.preventDefault();
  };

  const handleResizeMove = (event: MouseEvent) => {
    if (!isResizing || !clipRef.current) return;
    
    const deltaX = event.clientX - dragStartX;
    const deltaTime = deltaX / pixelsPerSecond;
    
    if (isResizing === 'left') {
      // When trimming from left, calculate how much we're trimming
      // and adjust startTime to keep the right edge fixed
      const newTrimStart = Math.max(0, Math.min(clip.trimEnd - 0.1, dragStartTime + deltaTime));
      const trimDelta = newTrimStart - clip.trimStart; // Amount trimmed from left
      
      // Pass the adjustment to the store (atomic update)
      trimClip(clip.id, newTrimStart, clip.trimEnd, trimDelta);
    } else {
      // Right trim: left edge stays fixed (no position adjustment needed)
      const newTrimEnd = Math.max(clip.trimStart + 0.1, dragStartTime + deltaTime);
      trimClip(clip.id, clip.trimStart, newTrimEnd, 0);
    }
  };

  const handleResizeUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  React.useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        handleMouseMove(event);
      } else if (isResizing) {
        handleResizeMove(event);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      } else if (isResizing) {
        handleResizeUp();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isResizing, handleMouseMove, handleResizeMove, handleMouseUp, handleResizeUp]);

  // Add global drag state for visual feedback
  React.useEffect(() => {
    if (isDragging) {
      document.body.classList.add('dragging');
    } else {
      document.body.classList.remove('dragging');
    }

    return () => {
      document.body.classList.remove('dragging');
    };
  }, [isDragging]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Drag Preview */}
      {dragPreview.visible && (
        <div
          className="timeline-clip drag-preview"
          style={{
            position: 'fixed',
            left: `${dragPreview.x}px`,
            top: `${dragPreview.y}px`,
            width: `${clipWidth}px`,
            height: '60px',
            zIndex: 1001,
            pointerEvents: 'none',
          }}
        >
          <div className="clip-content">
            <div className="clip-name">
              {clipName}
            </div>
            <div className="clip-duration">
              {formatDuration(clip.duration)}
            </div>
          </div>
        </div>
      )}

      {/* Main Clip */}
      <div
        ref={clipRef}
        className={`timeline-clip ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${className}`}
        style={{
          left: `${clipX}px`,
          width: `${clipWidth}px`,
          zIndex: isDragging ? 1000 : 'auto',
          opacity: isDragging ? 0.8 : 1,
          transform: isDragging ? `translateZ(0)` : 'none',
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          // Prevent timeline click handler from moving playhead when clicking on clip
          e.stopPropagation();
        }}
        data-clip-id={clip.id}
        data-is-selected={isSelected}
      >
        {/* Clip Content */}
        <div className="clip-content">
          <div className="clip-name">
            {clipName}
          </div>
          <div className="clip-duration">
            {formatDuration(clip.duration)}
          </div>
        </div>

        {/* Left Resize Handle - Only show on selected clips */}
        {isSelected && (
          <div
            className="resize-handle left"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
            onClick={(e) => {
              // Prevent click from propagating to timeline
              e.stopPropagation();
            }}
          />
        )}

        {/* Right Resize Handle - Only show on selected clips */}
        {isSelected && (
          <div
            className="resize-handle right"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            onClick={(e) => {
              // Prevent click from propagating to timeline
              e.stopPropagation();
            }}
          />
        )}
      </div>
    </>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format duration for display
 */
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 100);

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${remainingSeconds}.${milliseconds.toString().padStart(2, '0')}`;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TimelineClip;
