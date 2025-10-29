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
      zoom: 1,
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
      expect(state.zoom).toBe(1);
      expect(state.selectedClipId).toBe(null);
      expect(state.error).toBe(null);
    });

    it('should have correct computed values initially', () => {
      const state = useTimelineStore.getState();
      expect(state.totalDuration).toBe(0);
      expect(state.maxZoom).toBe(20);
      expect(state.minZoom).toBe(1);
      expect(state.availableZoomLevels).toEqual([1, 2, 5, 10, 20]);
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

  describe('Zoom Controls', () => {
    it('should set zoom level', () => {
      const { setZoom } = useTimelineStore.getState();
      
      setZoom(5);
      expect(useTimelineStore.getState().zoom).toBe(5);
    });

    it('should clamp zoom to valid range', () => {
      const { setZoom } = useTimelineStore.getState();
      
      setZoom(100); // Too high
      expect(useTimelineStore.getState().zoom).toBe(20); // Max zoom
      
      setZoom(0.5); // Too low
      expect(useTimelineStore.getState().zoom).toBe(1); // Min zoom
    });

    it('should zoom in and out', () => {
      const { zoomIn, zoomOut, setZoom } = useTimelineStore.getState();
      
      setZoom(2);
      zoomIn();
      expect(useTimelineStore.getState().zoom).toBe(5);
      
      zoomOut();
      expect(useTimelineStore.getState().zoom).toBe(2);
    });

    it('should reset zoom', () => {
      const { setZoom, resetZoom } = useTimelineStore.getState();
      
      setZoom(10);
      resetZoom();
      expect(useTimelineStore.getState().zoom).toBe(1);
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
