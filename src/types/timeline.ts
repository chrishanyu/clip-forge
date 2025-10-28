import { v4 as uuidv4 } from 'uuid';

/**
 * TimelineClip - An instance of a MediaClip on the timeline
 * Think of this as a "layer" in Photoshop with transforms applied
 */
export interface TimelineClip {
  id: string;                    // UUID - unique identifier
  mediaClipId: string;           // References MediaClip.id
  trackId: string;               // Which track this clip is on
  
  // Timeline positioning
  startTime: number;             // When this clip starts on timeline (seconds)
  duration: number;              // How long this clip plays (seconds)
  
  // Trim points (relative to original video)
  trimStart: number;            // Start point in original video (seconds)
  trimEnd: number;              // End point in original video (seconds)
  
  // Visual properties
  volume: number;                // Audio volume (0.0 to 1.0)
  
  // UI state
  isSelected: boolean;           // Currently selected for editing
}

/**
 * TimelineTrack - A track that holds TimelineClips
 * For MVP: exactly 2 tracks (Track 1, Track 2)
 */
export interface TimelineTrack {
  id: string;                    // UUID - unique identifier
  name: string;                  // "Track 1", "Track 2", etc.
  clips: TimelineClip[];         // Clips on this track (sorted by startTime)
  isMuted: boolean;             // Track mute state
  volume: number;               // Track volume (0.0 to 1.0)
}

/**
 * Create a new TimelineClip with generated ID
 */
export function createTimelineClip(
  mediaClipId: string,
  trackId: string,
  startTime: number,
  duration: number,
  trimStart: number = 0,
  trimEnd?: number
): TimelineClip {
  return {
    id: uuidv4(),
    mediaClipId,
    trackId,
    startTime,
    duration,
    trimStart,
    trimEnd: trimEnd ?? duration,
    volume: 1.0,
    isSelected: false,
  };
}

/**
 * Create a new TimelineTrack with generated ID
 */
export function createTimelineTrack(name: string): TimelineTrack {
  return {
    id: uuidv4(),
    name,
    clips: [],
    isMuted: false,
    volume: 1.0,
  };
}
