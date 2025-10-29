import React, { useEffect, useState } from 'react';
import { TimelineTrack as TimelineTrackType } from '@/types';
import { TimelineClip } from './TimelineClip';
import { useDragDropContext } from '@/contexts/DragDropContext';
import { useTimelineStore } from '@/stores/timelineStore';
import './TimelineTrack.css';

// ============================================================================
// TIMELINE TRACK COMPONENT INTERFACE
// ============================================================================

export interface TimelineTrackProps {
  track: TimelineTrackType;
  pixelsPerSecond: number;
  onDrop?: (trackId: string, startTime: number, clip: any) => void;
  className?: string;
}

// ============================================================================
// TIMELINE TRACK COMPONENT
// ============================================================================

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  pixelsPerSecond,
  onDrop,
  className = ''
}) => {
  const { registerDropZone, unregisterDropZone } = useDragDropContext();
  const [isDragOver, setIsDragOver] = useState(false);
  const { clearSelection } = useTimelineStore();
  
  // ============================================================================
  // DROP ZONE REGISTRATION
  // ============================================================================

  useEffect(() => {
    const handleDrop = (clip: any, x: number, y: number) => {
      // Get the track element and find the content area (not the header)
      const trackElement = document.querySelector(`[data-drop-zone="${track.id}"]`);
      const contentElement = trackElement?.querySelector('.track-content');
      
      // Get the timeline-content parent for scroll position
      const timelineContent = document.querySelector('.timeline-content');
      
      if (contentElement && timelineContent) {
        const rect = contentElement.getBoundingClientRect();
        const scrollLeft = timelineContent.scrollLeft || 0;
        
        // Calculate position relative to content area (not including header)
        // and add scroll position to get actual timeline position
        const relativeX = (x - rect.left) + scrollLeft;
        let startTime = Math.max(0, relativeX / pixelsPerSecond);
        
        // Snap to start if dropped within 2 seconds of the beginning
        const SNAP_TO_START_THRESHOLD = 2; // seconds
        if (startTime < SNAP_TO_START_THRESHOLD) {
          startTime = 0;
        }
        
        onDrop?.(track.id, startTime, clip);
      }
    };

    registerDropZone(track.id, handleDrop);

    return () => {
      unregisterDropZone(track.id);
    };
  }, [track.id, pixelsPerSecond, onDrop, registerDropZone, unregisterDropZone]);

  // ============================================================================
  // CLICK HANDLING
  // ============================================================================

  /**
   * Handle clicks on empty track areas to clear selection
   */
  const handleTrackClick = (event: React.MouseEvent) => {
    // Only clear selection if clicking on the track content area (not on clips)
    const target = event.target as HTMLElement;
    const isClickOnClip = target.closest('.timeline-clip');
    const isClickOnEmptyArea = target.closest('.track-empty');
    
    if (!isClickOnClip && (isClickOnEmptyArea || target.classList.contains('track-content'))) {
      clearSelection();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div 
      className={`timeline-track ${isDragOver ? 'drag-over' : ''} ${className}`}
      data-drop-zone={track.id}
      data-track-id={track.id}
    >
      {/* Track Header */}
      <div className="track-header">
        <div className="track-name">{track.name}</div>
        <div className="track-controls">
          {/* Track controls will be added later */}
        </div>
      </div>

      {/* Track Content */}
      <div className="track-content" onClick={handleTrackClick}>
        {track.clips.length === 0 ? (
          <div className="track-empty">
            <div className="empty-text">Drop clips here</div>
          </div>
        ) : (
          track.clips.map((clip) => (
            <TimelineClip
              key={clip.id}
              clip={clip}
              pixelsPerSecond={pixelsPerSecond}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TimelineTrack;
