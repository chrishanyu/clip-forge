import React, { useEffect, useState } from 'react';
import { TimelineTrack as TimelineTrackType } from '@/types';
import { TimelineClip } from './TimelineClip';
import { useDragDropContext } from '@/contexts/DragDropContext';
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
  
  // ============================================================================
  // DROP ZONE REGISTRATION
  // ============================================================================

  useEffect(() => {
    const handleDrop = (clip: any, x: number, y: number) => {
      // Get the track element to calculate relative position
      const trackElement = document.querySelector(`[data-drop-zone="${track.id}"]`);
      if (trackElement) {
        const rect = trackElement.getBoundingClientRect();
        const relativeX = x - rect.left;
        const startTime = Math.max(0, relativeX / pixelsPerSecond);
        
        onDrop?.(track.id, startTime, clip);
      }
    };

    registerDropZone(track.id, handleDrop);

    return () => {
      unregisterDropZone(track.id);
    };
  }, [track.id, pixelsPerSecond, onDrop, registerDropZone, unregisterDropZone]);

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
      <div className="track-content">
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
