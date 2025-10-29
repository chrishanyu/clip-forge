import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTimelineStore } from '../stores/timelineStore';
import { createTimelineClip, createTimelineTrack, createAppError } from '@/types';
import type { TimelineClip, TimelineTrack } from '@/types';

// Mock Zustand devtools
vi.mock('zustand/middleware', () => ({
  devtools: (fn: any) => fn,
}));

// Mock environment
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

describe('TimelineStore', () => {
  // Sample test data
  const sampleTrack: TimelineTrack = createTimelineTrack('Test Track');
  const sampleClip: TimelineClip = createTimelineClip(
    'media-clip-1',
    sampleTrack.id,
    10, // startTime
    5,  // duration
    0,  // trimStart
    5   // trimEnd
  );

  beforeEach(() => {
    // Reset store state before each test
    const { clearError, selectClip } = useTimelineStore.getState();
    clearError();
    selectClip(null);
    
    // Clear tracks and reset playhead
    useTimelineStore.setState({
      tracks: [],
      playhead: 0,
      isPlaying: false,
      selectedClipId: null,
      error: null,
    });
  });

  describe('Initial State', () => {
    it('should have empty tracks array initially', () => {
      const state = useTimelineStore.getState();
      expect(state.tracks).toEqual([]);
      expect(state.playhead).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.selectedClipId).toBe(null);
      expect(state.error).toBe(null);
    });

    it('should have correct computed values initially', () => {
      const state = useTimelineStore.getState();
      expect(state.totalDuration).toBe(0);
    });
  });

  describe('Playback Controls', () => {
    it('should set playhead position', () => {
      const { setPlayhead } = useTimelineStore.getState();
      
      setPlayhead(15.5);
      expect(useTimelineStore.getState().playhead).toBe(15.5);
    });

    it('should clamp playhead to valid range', () => {
      const { setPlayhead } = useTimelineStore.getState();
      
      setPlayhead(-5);
      expect(useTimelineStore.getState().playhead).toBe(0);
      
      setPlayhead(1000);
      expect(useTimelineStore.getState().playhead).toBe(1000); // Allow beyond clips for preview
    });

    it('should play and pause', () => {
      const { play, pause } = useTimelineStore.getState();
      
      play();
      expect(useTimelineStore.getState().isPlaying).toBe(true);
      
      pause();
      expect(useTimelineStore.getState().isPlaying).toBe(false);
    });

    it('should toggle playback', () => {
      const { togglePlayback } = useTimelineStore.getState();
      
      togglePlayback();
      expect(useTimelineStore.getState().isPlaying).toBe(true);
      
      togglePlayback();
      expect(useTimelineStore.getState().isPlaying).toBe(false);
    });

    it('should seek to start and end', () => {
      const { seekToStart, seekToEnd, setPlayhead } = useTimelineStore.getState();
      
      setPlayhead(50);
      seekToStart();
      expect(useTimelineStore.getState().playhead).toBe(0);
      
      seekToEnd();
      expect(useTimelineStore.getState().playhead).toBe(0); // No clips
    });

    it('should skip forward and backward', () => {
      const { skipForward, skipBackward, setPlayhead } = useTimelineStore.getState();
      
      setPlayhead(10);
      skipForward();
      expect(useTimelineStore.getState().playhead).toBe(11);
      
      skipBackward(2);
      expect(useTimelineStore.getState().playhead).toBe(9);
    });
  });

  describe('Timeline Management', () => {
    beforeEach(() => {
      // Initialize with test track
      useTimelineStore.setState({
        tracks: [sampleTrack],
      });
    });

    it('should add clip to track', () => {
      const { addClipToTrack } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips).toHaveLength(1);
      expect(track?.clips[0]).toEqual(sampleClip);
    });

    it('should not add overlapping clips', () => {
      const { addClipToTrack } = useTimelineStore.getState();
      
      // Add first clip
      addClipToTrack(sampleClip, sampleTrack.id);
      
      // Try to add overlapping clip
      const overlappingClip = createTimelineClip(
        'media-clip-2',
        sampleTrack.id,
        12, // Overlaps with first clip (10-15)
        3,
        0,
        3
      );
      
      addClipToTrack(overlappingClip, sampleTrack.id);
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips).toHaveLength(1); // Only first clip should be added
    });

    it('should not add duplicate clips', () => {
      const { addClipToTrack } = useTimelineStore.getState();
      
      // Add first clip
      addClipToTrack(sampleClip, sampleTrack.id);
      
      // Try to add the same clip again
      addClipToTrack(sampleClip, sampleTrack.id);
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips).toHaveLength(1); // Only one instance should exist
    });

    it('should remove clip', () => {
      const { addClipToTrack, removeClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      removeClip(sampleClip.id);
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips).toHaveLength(0);
    });

    it('should move clip to new position', () => {
      const { addClipToTrack, moveClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      moveClip(sampleClip.id, 20); // Move to time 20
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips[0].startTime).toBe(20);
    });

    it('should trim clip', () => {
      const { addClipToTrack, trimClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      trimClip(sampleClip.id, 1, 4); // Trim to 1-4 seconds
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      const clip = track?.clips[0];
      expect(clip?.trimStart).toBe(1);
      expect(clip?.trimEnd).toBe(4);
      expect(clip?.duration).toBe(3);
    });

    it('should not trim clip below minimum duration', () => {
      const { addClipToTrack, trimClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      const originalDuration = sampleClip.duration;
      
      trimClip(sampleClip.id, 0, 0.05); // Too short
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips[0].duration).toBe(originalDuration); // Should remain unchanged
    });

    it('should select and deselect clips', () => {
      const { addClipToTrack, selectClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      selectClip(null);
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should deselect clip using deselectClip action', () => {
      const { addClipToTrack, selectClip, deselectClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      deselectClip();
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should clear selection using clearSelection action', () => {
      const { addClipToTrack, selectClip, clearSelection } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      clearSelection();
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should check if clip is selected using isClipSelected', () => {
      const { addClipToTrack, selectClip, isClipSelected } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      
      // Initially no clip selected
      expect(isClipSelected(sampleClip.id)).toBe(false);
      
      // Select the clip
      selectClip(sampleClip.id);
      expect(isClipSelected(sampleClip.id)).toBe(true);
      
      // Deselect the clip
      selectClip(null);
      expect(isClipSelected(sampleClip.id)).toBe(false);
    });

    it('should only allow one clip to be selected at a time', () => {
      const { addClipToTrack, selectClip } = useTimelineStore.getState();
      
      const clip2 = createTimelineClip('media-clip-2', sampleTrack.id, 20, 5);
      
      addClipToTrack(sampleClip, sampleTrack.id);
      addClipToTrack(clip2, sampleTrack.id);
      
      // Select first clip
      selectClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      // Select second clip - should clear first selection
      selectClip(clip2.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(clip2.id);
    });

    it('should clear selection when clip is removed', () => {
      const { addClipToTrack, selectClip, removeClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      removeClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should clear selection when track containing selected clip is deleted', () => {
      const { addClipToTrack, selectClip, deleteTrack } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      deleteTrack(sampleTrack.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should delete selected clip using deleteSelectedClip', () => {
      const { addClipToTrack, selectClip, deleteSelectedClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      deleteSelectedClip();
      
      // Clip should be removed from timeline
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === sampleTrack.id);
      expect(track?.clips).toHaveLength(0);
      
      // Selection should be cleared
      expect(state.selectedClipId).toBe(null);
    });

    it('should do nothing when deleteSelectedClip called with no selection', () => {
      const { deleteSelectedClip } = useTimelineStore.getState();
      
      // No clip selected
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
      
      deleteSelectedClip();
      
      // Should not throw error and state should remain unchanged
      const state = useTimelineStore.getState();
      expect(state.selectedClipId).toBe(null);
    });
  });

  describe('Track Management', () => {
    it('should create track', () => {
      const { createTrack } = useTimelineStore.getState();
      
      createTrack('New Track');
      
      const state = useTimelineStore.getState();
      expect(state.tracks).toHaveLength(1);
      expect(state.tracks[0].name).toBe('New Track');
      expect(state.tracks[0].clips).toEqual([]);
    });

    it('should delete track', () => {
      const { createTrack, deleteTrack } = useTimelineStore.getState();
      
      createTrack('Track to Delete');
      const trackId = useTimelineStore.getState().tracks[0].id;
      
      deleteTrack(trackId);
      
      const state = useTimelineStore.getState();
      expect(state.tracks).toHaveLength(0);
    });

    it('should update track properties', () => {
      const { createTrack, updateTrack } = useTimelineStore.getState();
      
      createTrack('Test Track');
      const trackId = useTimelineStore.getState().tracks[0].id;
      
      updateTrack(trackId, { name: 'Updated Track', isMuted: true });
      
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === trackId);
      expect(track?.name).toBe('Updated Track');
      expect(track?.isMuted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set and clear errors', () => {
      const { setError, clearError } = useTimelineStore.getState();
      const error = createAppError('timeline', 'Test error');
      
      setError(error);
      expect(useTimelineStore.getState().error).toEqual(error);
      
      clearError();
      expect(useTimelineStore.getState().error).toBe(null);
    });
  });

  describe('Getters', () => {
    beforeEach(() => {
      useTimelineStore.setState({
        tracks: [sampleTrack],
      });
    });

    it('should get clip by ID', () => {
      const { addClipToTrack, getClipById } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      const foundClip = getClipById(sampleClip.id);
      
      expect(foundClip).toEqual(sampleClip);
    });

    it('should get track by ID', () => {
      const { getTrackById } = useTimelineStore.getState();
      
      const foundTrack = getTrackById(sampleTrack.id);
      expect(foundTrack).toEqual(sampleTrack);
    });

    it('should get clips at specific time', () => {
      const { addClipToTrack, getClipsAtTime } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      const clipsAtTime = getClipsAtTime(12); // Within clip range (10-15)
      
      expect(clipsAtTime).toHaveLength(1);
      expect(clipsAtTime[0]).toEqual(sampleClip);
    });

    it('should get selected clip', () => {
      const { addClipToTrack, selectClip, getSelectedClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      const selectedClip = getSelectedClip();
      expect(selectedClip).toEqual(sampleClip);
    });
  });

  describe('Computed Values', () => {
    it('should calculate total duration correctly', () => {
      const { createTrack, addClipToTrack } = useTimelineStore.getState();
      
      createTrack('Test Track');
      const trackId = useTimelineStore.getState().tracks[0].id;
      
      const clip1 = createTimelineClip('media-1', trackId, 0, 10);
      const clip2 = createTimelineClip('media-2', trackId, 15, 5);
      
      addClipToTrack(clip1, trackId);
      addClipToTrack(clip2, trackId);
      
      expect(useTimelineStore.getState().totalDuration).toBe(20); // clip2 ends at 20
    });
  });

  describe('Selection State Persistence', () => {
    beforeEach(() => {
      useTimelineStore.setState({
        tracks: [sampleTrack],
      });
    });

    it('should maintain selection during playhead changes', () => {
      const { addClipToTrack, selectClip, setPlayhead } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Change playhead position
      setPlayhead(50);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      setPlayhead(0);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
    });

    it('should maintain selection during playback state changes', () => {
      const { addClipToTrack, selectClip, play, pause } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Start and stop playback
      play();
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      pause();
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
    });

    it('should maintain selection during snap settings changes', () => {
      const { addClipToTrack, selectClip, setSnapToGrid, setSnapInterval } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Change snap settings
      setSnapToGrid(false);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      setSnapInterval(2);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
    });

    it('should maintain selection when clips are moved', () => {
      const { addClipToTrack, selectClip, moveClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Move the selected clip
      moveClip(sampleClip.id, 25);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
    });

    it('should maintain selection when clips are trimmed', () => {
      const { addClipToTrack, selectClip, trimClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Trim the selected clip
      trimClip(sampleClip.id, 1, 4);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
    });

    it('should clear selection when selected clip is removed', () => {
      const { addClipToTrack, selectClip, removeClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Remove the selected clip
      removeClip(sampleClip.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should clear selection when track containing selected clip is deleted', () => {
      const { addClipToTrack, selectClip, deleteTrack } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Delete the track containing the selected clip
      deleteTrack(sampleTrack.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(null);
    });

    it('should maintain selection when other clips are added or removed', () => {
      const { addClipToTrack, selectClip, removeClip } = useTimelineStore.getState();
      
      addClipToTrack(sampleClip, sampleTrack.id);
      selectClip(sampleClip.id);
      
      // Add another clip
      const clip2 = createTimelineClip('media-clip-2', sampleTrack.id, 20, 5);
      addClipToTrack(clip2, sampleTrack.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
      
      // Remove the other clip
      removeClip(clip2.id);
      expect(useTimelineStore.getState().selectedClipId).toBe(sampleClip.id);
    });
  });

  describe('Utility Functions', () => {
    it('should have default tracks initialized when store is created', () => {
      // Reset to initial state to test default tracks
      useTimelineStore.setState({
        tracks: [
          { id: 'track-1', name: 'Track 1', clips: [], isMuted: false, volume: 1.0 },
          { id: 'track-2', name: 'Track 2', clips: [], isMuted: false, volume: 1.0 }
        ],
        playhead: 0,
        isPlaying: false,
        zoom: 1,
        selectedClipId: null,
        snapToGrid: true,
        snapInterval: 1,
        error: null,
      });
      
      const state = useTimelineStore.getState();
      expect(state.tracks).toHaveLength(2);
      expect(state.tracks[0].name).toBe('Track 1');
      expect(state.tracks[1].name).toBe('Track 2');
    });
  });
});
