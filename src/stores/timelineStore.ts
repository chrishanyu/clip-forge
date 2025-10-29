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
  selectedClipId: string | null; // Currently selected clip ID
  snapToGrid: boolean;           // Whether to snap clips to grid
  snapInterval: number;          // Snap interval in seconds
  error: AppError | null;
  
  // Computed Timeline Dimensions
  contentEndTime: number;        // Rightmost clip end time across all tracks
  timelineDuration: number;      // Calculated timeline duration (min 60s, includes buffer)
  
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
  removeDuplicateClips: () => void;
  
  // Actions - Track Management
  createTrack: (name: string) => void;
  deleteTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  
  // Actions - Snap to Grid
  setSnapToGrid: (enabled: boolean) => void;
  toggleSnapToGrid: () => void;
  setSnapInterval: (interval: number) => void;
  
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

/**
 * Calculate timeline dimensions (contentEndTime and timelineDuration)
 * Used for canvas-based timeline architecture
 */
const calculateTimelineDimensions = (tracks: TimelineTrack[]): {
  contentEndTime: number;
  timelineDuration: number;
} => {
  const MIN_VISIBLE_DURATION = 60; // Always show at least 60 seconds
  const BUFFER_AFTER_CONTENT = 30; // 30 seconds of empty space after last clip
  
  const allClips = tracks.flatMap((track) => track.clips);
  
  // Calculate the rightmost point of any clip
  const contentEndTime = allClips.length === 0 
    ? 0 
    : Math.max(...allClips.map((clip) => clip.startTime + clip.duration));
  
  // Timeline duration = max(minimum, content + buffer)
  const timelineDuration = Math.max(
    MIN_VISIBLE_DURATION,
    contentEndTime + BUFFER_AFTER_CONTENT
  );
  
  console.log('[TimelineStore] Timeline dimensions calculated:', {
    numClips: allClips.length,
    contentEndTime,
    timelineDuration,
    buffer: BUFFER_AFTER_CONTENT
  });
  
  return { contentEndTime, timelineDuration };
};

// ============================================================================

const DEFAULT_SKIP_SECONDS = 1;
const MIN_CLIP_DURATION = 0.1; // Minimum clip duration in seconds

// ============================================================================
// TIMELINE STORE IMPLEMENTATION
// ============================================================================

// Create default tracks
const createDefaultTrack = (name: string): TimelineTrack => ({
  id: `track-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  name,
  clips: [],
  isMuted: false,
  volume: 1.0,
});

export const useTimelineStore = create<TimelineStore>()(
  devtools(
    (set, get) => ({
      // Initial state with default tracks
      tracks: [
        createDefaultTrack('Track 1'),
        createDefaultTrack('Track 2'),
      ],
      playhead: 0,
      isPlaying: false,
      selectedClipId: null,
      snapToGrid: true,
      snapInterval: 1, // 1 second snap interval
      error: null,
      
      // Timeline dimensions (empty timeline shows 60s minimum)
      contentEndTime: 0,
      timelineDuration: 60,
      
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
            
            // Check for duplicate clip ID
            const hasDuplicate = track.clips.some((existingClip) => existingClip.id === clip.id);
            if (hasDuplicate) {
              console.warn(`Clip with ID ${clip.id} already exists on track ${trackId}`);
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
            
            const dimensions = calculateTimelineDimensions(updatedTracks);
            
            return {
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              contentEndTime: dimensions.contentEndTime,
              timelineDuration: dimensions.timelineDuration,
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
            
            const dimensions = calculateTimelineDimensions(updatedTracks);
            
            return {
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              contentEndTime: dimensions.contentEndTime,
              timelineDuration: dimensions.timelineDuration,
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
            // Step 1: Find the clip in any track
            let clipToMove: TimelineClip | undefined;
            let sourceTrackId: string | undefined;
            
            for (const track of state.tracks) {
              const foundClip = track.clips.find((c) => c.id === clipId);
              if (foundClip) {
                clipToMove = foundClip;
                sourceTrackId = track.id;
                break;
              }
            }
            
            if (!clipToMove || !sourceTrackId) {
              console.warn(`Clip ${clipId} not found in any track`);
              return state;
            }
            
            // Step 2: Determine target track (use current track if not specified)
            const targetTrackId = newTrackId || sourceTrackId;
            
            // Step 3: Create updated clip
            const updatedClip = {
              ...clipToMove,
              startTime: newStartTime,
              trackId: targetTrackId,
            };
            
            // Step 4: Remove clip from ALL tracks and add to target track in one pass
            const updatedTracks = state.tracks.map((track) => {
              // Remove clip from this track (whether source or not, to prevent duplicates)
              const filteredClips = track.clips.filter((c) => c.id !== clipId);
              
              // If this is the target track, add the updated clip
              if (track.id === targetTrackId) {
                return {
                  ...track,
                  clips: [...filteredClips, updatedClip].sort(
                    (a, b) => a.startTime - b.startTime
                  ),
                };
              }
              
              // Otherwise, just return with clip removed
              return {
                ...track,
                clips: filteredClips,
              };
            });
            
            const dimensions = calculateTimelineDimensions(updatedTracks);
            
            return { 
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              contentEndTime: dimensions.contentEndTime,
              timelineDuration: dimensions.timelineDuration,
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
            
            const dimensions = calculateTimelineDimensions(updatedTracks);
            
            return { 
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              contentEndTime: dimensions.contentEndTime,
              timelineDuration: dimensions.timelineDuration,
            };
          },
          false,
          'timelineStore/trimClip'
        );
      },
      
      selectClip: (clipId: string | null) => {
        set({ selectedClipId: clipId }, false, 'timelineStore/selectClip');
      },
      
      // Actions - Cleanup
      removeDuplicateClips: () => {
        set(
          (state) => {
            const updatedTracks = state.tracks.map((track) => {
              const uniqueClips = track.clips.filter((clip, index, array) => 
                array.findIndex(c => c.id === clip.id) === index
              );
              return {
                ...track,
                clips: uniqueClips.sort((a, b) => a.startTime - b.startTime),
              };
            });
            
            const dimensions = calculateTimelineDimensions(updatedTracks);
            
            return {
              tracks: updatedTracks,
              totalDuration: calculateTotalDuration(updatedTracks),
              contentEndTime: dimensions.contentEndTime,
              timelineDuration: dimensions.timelineDuration,
            };
          },
          false,
          'timelineStore/removeDuplicateClips'
        );
      },
      
      // Actions - Track Management
      createTrack: (name: string) => {
        set(
          (state) => {
            // Check if track with same name already exists
            const existingTrack = state.tracks.find(track => track.name === name);
            if (existingTrack) {
              console.warn(`Track with name "${name}" already exists`);
              return state;
            }
            
            // Generate unique ID using timestamp + random number
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            const newTrack: TimelineTrack = {
              id: `track-${timestamp}-${random}`,
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
      
      // Actions - Snap to Grid
      setSnapToGrid: (enabled: boolean) => {
        set({ snapToGrid: enabled }, false, 'timelineStore/setSnapToGrid');
      },
      
      toggleSnapToGrid: () => {
        const state = get();
        set({ snapToGrid: !state.snapToGrid }, false, 'timelineStore/toggleSnapToGrid');
      },
      
      setSnapInterval: (interval: number) => {
        const clampedInterval = Math.max(0.1, Math.min(10, interval)); // Between 0.1 and 10 seconds
        set({ snapInterval: clampedInterval }, false, 'timelineStore/setSnapInterval');
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
export const useSelectedClipId = () => useTimelineStore((state) => state.selectedClipId);
export const useSnapToGrid = () => useTimelineStore((state) => state.snapToGrid);
export const useSnapInterval = () => useTimelineStore((state) => state.snapInterval);
export const useTimelineError = () => useTimelineStore((state) => state.error);

export const useTimelineStats = () =>
  useTimelineStore((state) => ({
    totalDuration: state.totalDuration,
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
    removeDuplicateClips: state.removeDuplicateClips,
    createTrack: state.createTrack,
    deleteTrack: state.deleteTrack,
    updateTrack: state.updateTrack,
    setSnapToGrid: state.setSnapToGrid,
    toggleSnapToGrid: state.toggleSnapToGrid,
    setSnapInterval: state.setSnapInterval,
    setError: state.setError,
    clearError: state.clearError,
  }));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Timeline is now initialized with default tracks in the store

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
