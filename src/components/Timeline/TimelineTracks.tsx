import React from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import { TimelineTrack } from './TimelineTrack';
import './TimelineTracks.css';

// ============================================================================
// TIMELINE TRACKS COMPONENT INTERFACE
// ============================================================================

export interface TimelineTracksProps {
  pixelsPerSecond: number;
  onDrop?: (trackId: string, startTime: number, clip: any) => void;
  className?: string;
}

// ============================================================================
// TIMELINE TRACKS COMPONENT
// ============================================================================

export const TimelineTracks: React.FC<TimelineTracksProps> = ({
  pixelsPerSecond,
  onDrop,
  className = ''
}) => {
  const { tracks } = useTimelineStore();

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`timeline-tracks ${className}`}>
      {tracks.length === 0 ? (
        <div className="timeline-empty">
          <div className="empty-message">
            <div className="empty-icon">🎬</div>
            <div className="empty-text">No tracks yet</div>
            <div className="empty-subtext">Add clips to the timeline to start editing</div>
          </div>
        </div>
      ) : (
        tracks.map((track) => (
          <TimelineTrack
            key={track.id}
            track={track}
            pixelsPerSecond={pixelsPerSecond}
            onDrop={onDrop}
          />
        ))
      )}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TimelineTracks;
