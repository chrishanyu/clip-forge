import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TimelineClip, TimelineTrack, AppError } from '@/types';

// ============================================================================
// TIMELINE STORE INTERFACE
// ============================================================================

interface TimelineStore {
  // State
  tracks: TimelineTrack[];
  playhead: number;              // Current playback position in seconds
  isPlaying: boolean;            // Whether video is currently playing
  zoom: number;                  // Timeline zoom level (1x, 2x, 5x, 10x, 20x)
  selectedClipId: string | null; // Currently selected clip ID
  error: AppError | null;
  
  // Actions - Playback
  setPlayhead: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seekToStart: () => void;
  seekToEnd: () => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  
  // Actions - Timeline Management
  addClipToTrack: (clip: TimelineClip, trackId: string) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  selectClip: (clipId: string | null) => void;
  
  // Actions - Track Management
  createTrack: (name: string) => void;
  deleteTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  
  // Actions - Zoom
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  
  // Actions - Error Handling
  setError: (error: AppError | null) => void;
  clearError: () => void;
  
  // Getters
  getClipById: (clipId: string) => TimelineClip | undefined;
  getTrackById: (trackId: string) => TimelineTrack | undefined;
  getClipsAtTime: (time: number) => TimelineClip[];
  getSelectedClip: () => TimelineClip | undefined;
  
  // Computed values
  totalDuration: number;
  maxZoom: number;
  minZoom: number;
  availableZoomLevels: number[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate total duration from all clips across all tracks
 */
const calculateTotalDuration = (tracks: TimelineTrack[]): number => {
  const allClips = tracks.flatMap((track) => track.clips);
  if (allClips.length === 0) return 0;
  
  return Math.max(
    ...allClips.map((clip) => clip.startTime + clip.duration)
  );
};

// ============================================================================

const ZOOM_LEVELS = [1, 2, 5, 10, 20] as const;
const DEFAULT_SKIP_SECONDS = 1;
const MIN_CLIP_DURATION = 0.1; // Minimum clip duration in seconds

// ============================================================================
// TIMELINE STORE IMPLEMENTATION
// ============================================================================

export const useTimelineStore = create<TimelineStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      tracks: [],
      playhead: 0,
      isPlaying: false,
      zoom: 1,
      selectedClipId: null,
      error: null,
      
      // Actions - Playback
      setPlayhead: (time: number) => {
        const state = get();
        const maxTime = state.totalDuration;
        // Allow setting playhead even when there are no clips (for testing/preview)
        const clampedTime = Math.max(0, maxTime > 0 ? Math.min(time, maxTime) : time);
        
        set({ playhead: clampedTime }, false, 'timelineStore/setPlayhead');
      },
      
      play: () => {
        set({ isPlaying: true }, false, 'timelineStore/play');
      },
      
      pause: () => {
        set({ isPlaying: false }, false, 'timelineStore/pause');
      },
      
      togglePlayback: () => {
        const state = get();
        set({ isPlaying: !state.isPlaying }, false, 'timelineStore/togglePlayback');
      },
      
      seekToStart: () => {
        set({ playhead: 0 }, false, 'timelineStore/seekToStart');
      },
      
      seekToEnd: () => {
        const state = get();
        set({ playhead: state.totalDuration }, false, 'timelineStore/seekToEnd');
      },
      
      skipForward: (seconds: number = DEFAULT_SKIP_SECONDS) => {
        const state = get();
        const newTime = state.playhead + seconds;
        state.setPlayhead(newTime);
      },
      
      skipBackward: (seconds: number = DEFAULT_SKIP_SECONDS) => {
        const state = get();
        const newTime = state.playhead - seconds;
        state.setPlayhead(newTime);
      },
      
      // Actions - Timeline Management
      addClipToTrack: (clip: TimelineClip, trackId: string) => {
        set(
          (state) => {
            const track = state.tracks.find((t) => t.id === trackId);
            if (!track) {
              console.error(`Track ${trackId} not found`);
              return state;
            }
            
            // Check for overlaps
            const hasOverlap = track.clips.some((existingClip) => {
              const clipEnd = clip.startTime + clip.duration;
              const existingEnd = existingClip.startTime + existingClip.duration;
              
              return (
                (clip.startTime < existingEnd && clipEnd > existingClip.startTime)
              );
            });
            
            if (hasOverlap) {
              console.warn(`Clip overlaps with existing clip on track ${trackId}`);
              return state;
            }
            
            const updatedTracks = state.tracks.map((t) =>
              t.id === trackId
                ? {
                    ...t,
                    clips: [...t.clips, clip].sort((a, b) => a.startTime - b.startTime),
                  }
                : t
            );
            
            return {
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              error: null,
            };
          },
          false,
          'timelineStore/addClipToTrack'
        );
      },
      
      removeClip: (clipId: string) => {
        set(
          (state) => {
            const updatedTracks = state.tracks.map((track) => ({
              ...track,
              clips: track.clips.filter((clip) => clip.id !== clipId),
            }));
            
            return {
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
            };
          },
          false,
          'timelineStore/removeClip'
        );
      },
      
      moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => {
        set(
          (state) => {
            const updatedTracks = state.tracks.map((track) => {
              const clip = track.clips.find((c) => c.id === clipId);
              if (!clip) return track;
              
              // Remove clip from current track
              const filteredClips = track.clips.filter((c) => c.id !== clipId);
              
              // Update clip with new position
              const updatedClip = {
                ...clip,
                startTime: newStartTime,
                trackId: newTrackId || clip.trackId,
              };
              
              // Add to appropriate track
              if (newTrackId && newTrackId !== track.id) {
                // Moving to different track
                return { ...track, clips: filteredClips };
              } else {
                // Staying on same track
                const newClips = [...filteredClips, updatedClip].sort(
                  (a, b) => a.startTime - b.startTime
                );
                return { ...track, clips: newClips };
              }
            });
            
            // If moving to different track, add to that track
            if (newTrackId) {
              const targetTrack = updatedTracks.find((t) => t.id === newTrackId);
              if (targetTrack) {
                const clip = state.tracks
                  .flatMap((t) => t.clips)
                  .find((c) => c.id === clipId);
                if (clip) {
                  const updatedClip = {
                    ...clip,
                    startTime: newStartTime,
                    trackId: newTrackId,
                  };
                  
                  const finalTracks = updatedTracks.map((track) =>
                    track.id === newTrackId
                      ? {
                          ...track,
                          clips: [...track.clips, updatedClip].sort(
                            (a, b) => a.startTime - b.startTime
                          ),
                        }
                      : track
                  );
                  
                  return { 
                    tracks: finalTracks,
                    totalDuration: calculateTotalDuration(finalTracks),
                  };
                }
              }
            }
            
            return { 
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
            };
          },
          false,
          'timelineStore/moveClip'
        );
      },
      
      trimClip: (clipId: string, trimStart: number, trimEnd: number) => {
        set(
          (state) => {
            const duration = trimEnd - trimStart;
            if (duration < MIN_CLIP_DURATION) {
              console.warn(`Clip duration too short: ${duration}s`);
              return state;
            }
            
            const updatedTracks = state.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) =>
                clip.id === clipId
                  ? {
                      ...clip,
                      trimStart,
                      trimEnd,
                      duration,
                    }
                  : clip
              ),
            }));
            
            return { 
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
            };
          },
          false,
          'timelineStore/trimClip'
        );
      },
      
      selectClip: (clipId: string | null) => {
        set({ selectedClipId: clipId }, false, 'timelineStore/selectClip');
      },
      
      // Actions - Track Management
      createTrack: (name: string) => {
        set(
          (state) => {
            const newTrack: TimelineTrack = {
              id: `track-${Date.now()}`, // Simple ID for MVP
              name,
              clips: [],
              isMuted: false,
              volume: 1.0,
            };
            
            return {
              tracks: [...state.tracks, newTrack],
            };
          },
          false,
          'timelineStore/createTrack'
        );
      },
      
      deleteTrack: (trackId: string) => {
        set(
          (state) => {
            const track = state.tracks.find((t) => t.id === trackId);
            if (!track) return state;
            
            // Clear selection if selected clip is on this track
            const selectedClip = state.tracks
              .flatMap((t) => t.clips)
              .find((c) => c.id === state.selectedClipId);
            
            const updatedTracks = state.tracks.filter((t) => t.id !== trackId);
            const newSelectedClipId = 
              selectedClip && selectedClip.trackId === trackId 
                ? null 
                : state.selectedClipId;
            
            return {
              tracks: updatedTracks,
              selectedClipId: newSelectedClipId,
            };
          },
          false,
          'timelineStore/deleteTrack'
        );
      },
      
      updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => {
        set(
          (state) => ({
            tracks: state.tracks.map((track) =>
              track.id === trackId ? { ...track, ...updates } : track
            ),
          }),
          false,
          'timelineStore/updateTrack'
        );
      },
      
      // Actions - Zoom
      setZoom: (zoom: number) => {
        const state = get();
        const clampedZoom = Math.max(state.minZoom, Math.min(zoom, state.maxZoom));
        set({ zoom: clampedZoom }, false, 'timelineStore/setZoom');
      },
      
      zoomIn: () => {
        const state = get();
        const currentIndex = state.availableZoomLevels.indexOf(state.zoom);
        const nextIndex = Math.min(currentIndex + 1, state.availableZoomLevels.length - 1);
        const newZoom = state.availableZoomLevels[nextIndex];
        state.setZoom(newZoom);
      },
      
      zoomOut: () => {
        const state = get();
        const currentIndex = state.availableZoomLevels.indexOf(state.zoom);
        const prevIndex = Math.max(currentIndex - 1, 0);
        const newZoom = state.availableZoomLevels[prevIndex];
        state.setZoom(newZoom);
      },
      
      resetZoom: () => {
        set({ zoom: 1 }, false, 'timelineStore/resetZoom');
      },
      
      // Actions - Error Handling
      setError: (error: AppError | null) => {
        set({ error }, false, 'timelineStore/setError');
      },
      
      clearError: () => {
        set({ error: null }, false, 'timelineStore/clearError');
      },
      
      // Getters
      getClipById: (clipId: string) => {
        const state = get();
        return state.tracks
          .flatMap((track) => track.clips)
          .find((clip) => clip.id === clipId);
      },
      
      getTrackById: (trackId: string) => {
        const state = get();
        return state.tracks.find((track) => track.id === trackId);
      },
      
      getClipsAtTime: (time: number) => {
        const state = get();
        return state.tracks
          .flatMap((track) => track.clips)
          .filter((clip) => {
            const clipEnd = clip.startTime + clip.duration;
            return time >= clip.startTime && time <= clipEnd;
          });
      },
      
      getSelectedClip: () => {
        const state = get();
        if (!state.selectedClipId) return undefined;
        return state.getClipById(state.selectedClipId);
      },
      
      // Computed values (as regular properties, not getters)
      totalDuration: 0,
      maxZoom: 20,
      minZoom: 1,
      availableZoomLevels: [1, 2, 5, 10, 20],
    }),
    {
      name: 'timeline-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// SELECTOR HOOKS FOR PERFORMANCE
// ============================================================================

export const useTracks = () => useTimelineStore((state) => state.tracks);
export const usePlayhead = () => useTimelineStore((state) => state.playhead);
export const useIsPlaying = () => useTimelineStore((state) => state.isPlaying);
export const useZoom = () => useTimelineStore((state) => state.zoom);
export const useSelectedClipId = () => useTimelineStore((state) => state.selectedClipId);
export const useTimelineError = () => useTimelineStore((state) => state.error);

export const useTimelineStats = () =>
  useTimelineStore((state) => ({
    totalDuration: state.totalDuration,
    maxZoom: state.maxZoom,
    minZoom: state.minZoom,
    availableZoomLevels: state.availableZoomLevels,
  }));

// ============================================================================
// ACTION HOOKS FOR CONVENIENCE
// ============================================================================

export const useTimelineActions = () =>
  useTimelineStore((state) => ({
    setPlayhead: state.setPlayhead,
    play: state.play,
    pause: state.pause,
    togglePlayback: state.togglePlayback,
    seekToStart: state.seekToStart,
    seekToEnd: state.seekToEnd,
    skipForward: state.skipForward,
    skipBackward: state.skipBackward,
    addClipToTrack: state.addClipToTrack,
    removeClip: state.removeClip,
    moveClip: state.moveClip,
    trimClip: state.trimClip,
    selectClip: state.selectClip,
    createTrack: state.createTrack,
    deleteTrack: state.deleteTrack,
    updateTrack: state.updateTrack,
    setZoom: state.setZoom,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    resetZoom: state.resetZoom,
    setError: state.setError,
    clearError: state.clearError,
  }));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Initialize timeline with default tracks
 */
export const initializeTimeline = () => {
  const { createTrack } = useTimelineStore.getState();
  createTrack('Track 1');
  createTrack('Track 2');
};

/**
 * Get all clips across all tracks
 */
export const getAllClips = (): TimelineClip[] => {
  const tracks = useTimelineStore.getState().tracks;
  return tracks.flatMap((track) => track.clips);
};

/**
 * Check if a time position has any clips
 */
export const hasClipsAtTime = (time: number): boolean => {
  const clips = useTimelineStore.getState().getClipsAtTime(time);
  return clips.length > 0;
};

/**
 * Get the next clip after a given time
 */
export const getNextClip = (time: number): TimelineClip | undefined => {
  const allClips = getAllClips();
  const futureClips = allClips.filter((clip) => clip.startTime > time);
  return futureClips.sort((a, b) => a.startTime - b.startTime)[0];
};

/**
 * Get the previous clip before a given time
 */
export const getPreviousClip = (time: number): TimelineClip | undefined => {
  const allClips = getAllClips();
  const pastClips = allClips.filter((clip) => clip.startTime < time);
  return pastClips.sort((a, b) => b.startTime - a.startTime)[0];
};
