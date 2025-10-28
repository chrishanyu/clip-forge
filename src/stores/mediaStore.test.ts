import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMediaStore } from '../stores/mediaStore';
import { createMediaClip, createAppError } from '@/types';
import type { MediaClip, VideoMetadata } from '@/types';

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

describe('MediaStore', () => {
  // Sample test data
  const sampleMetadata: VideoMetadata = {
    duration: 120.5,
    width: 1920,
    height: 1080,
    fps: 30,
    filepath: '/path/to/video.mp4',
    filename: 'video.mp4',
    fileSize: 1024000,
    codec: 'h264',
    container: 'mp4',
    thumbnailPath: '/path/to/thumbnail.jpg',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const sampleClip: MediaClip = createMediaClip(
    '/path/to/video.mp4',
    'video.mp4',
    sampleMetadata
  );

  beforeEach(() => {
    // Reset store state before each test
    useMediaStore.getState().clearClips();
    useMediaStore.getState().setError(null);
    useMediaStore.getState().setLoading(false);
  });

  describe('Initial State', () => {
    it('should have empty clips array initially', () => {
      const state = useMediaStore.getState();
      expect(state.clips).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should have correct computed values initially', () => {
      const state = useMediaStore.getState();
      expect(state.totalClips).toBe(0);
      expect(state.totalDuration).toBe(0);
      expect(state.totalFileSize).toBe(0);
    });
  });

  describe('addClip', () => {
    it('should add a clip to the store', () => {
      const { addClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      
      const state = useMediaStore.getState();
      expect(state.clips).toHaveLength(1);
      expect(state.clips[0]).toEqual(sampleClip);
    });

    it('should clear error when adding a clip', () => {
      const { setError, addClip } = useMediaStore.getState();
      const error = createAppError('import', 'Test error');
      
      setError(error);
      addClip(sampleClip);
      
      const state = useMediaStore.getState();
      expect(state.error).toBe(null);
    });

    it('should update computed values when adding clips', () => {
      const { addClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      
      const state = useMediaStore.getState();
      expect(state.totalClips).toBe(1);
      expect(state.totalDuration).toBe(120.5);
      expect(state.totalFileSize).toBe(1024000);
    });
  });

  describe('removeClip', () => {
    it('should remove a clip by ID', () => {
      const { addClip, removeClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      removeClip(sampleClip.id);
      
      const state = useMediaStore.getState();
      expect(state.clips).toHaveLength(0);
    });

    it('should not remove clips with different IDs', () => {
      const { addClip, removeClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      removeClip('non-existent-id');
      
      const state = useMediaStore.getState();
      expect(state.clips).toHaveLength(1);
    });

    it('should update computed values when removing clips', () => {
      const { addClip, removeClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      expect(useMediaStore.getState().totalClips).toBe(1);
      
      removeClip(sampleClip.id);
      expect(useMediaStore.getState().totalClips).toBe(0);
    });
  });

  describe('updateClip', () => {
    it('should update a clip by ID', () => {
      const { addClip, updateClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      updateClip(sampleClip.id, { filename: 'updated.mp4' });
      
      const state = useMediaStore.getState();
      expect(state.clips[0].filename).toBe('updated.mp4');
      expect(state.clips[0].filepath).toBe(sampleClip.filepath); // Other fields unchanged
    });

    it('should not update clips with different IDs', () => {
      const { addClip, updateClip } = useMediaStore.getState();
      
      addClip(sampleClip);
      updateClip('non-existent-id', { filename: 'updated.mp4' });
      
      const state = useMediaStore.getState();
      expect(state.clips[0].filename).toBe(sampleClip.filename);
    });
  });

  describe('clearClips', () => {
    it('should remove all clips', () => {
      const { addClip, clearClips } = useMediaStore.getState();
      
      addClip(sampleClip);
      addClip({ ...sampleClip, id: 'clip-2' });
      
      clearClips();
      
      const state = useMediaStore.getState();
      expect(state.clips).toHaveLength(0);
      expect(state.error).toBe(null);
    });
  });

  describe('getClipById', () => {
    it('should return clip by ID', () => {
      const { addClip, getClipById } = useMediaStore.getState();
      
      addClip(sampleClip);
      const foundClip = getClipById(sampleClip.id);
      
      expect(foundClip).toEqual(sampleClip);
    });

    it('should return undefined for non-existent ID', () => {
      const { getClipById } = useMediaStore.getState();
      
      const foundClip = getClipById('non-existent-id');
      
      expect(foundClip).toBeUndefined();
    });
  });

  describe('getClipsByFilename', () => {
    it('should return clips with matching filename', () => {
      const { addClip, getClipsByFilename } = useMediaStore.getState();
      
      const clip1 = createMediaClip('/path1/video.mp4', 'video.mp4', sampleMetadata);
      const clip2 = createMediaClip('/path2/video.mp4', 'video.mp4', sampleMetadata);
      const clip3 = createMediaClip('/path3/other.mp4', 'other.mp4', sampleMetadata);
      
      addClip(clip1);
      addClip(clip2);
      addClip(clip3);
      
      const matchingClips = getClipsByFilename('video.mp4');
      
      expect(matchingClips).toHaveLength(2);
      expect(matchingClips).toContain(clip1);
      expect(matchingClips).toContain(clip2);
    });

    it('should return empty array for non-existent filename', () => {
      const { getClipsByFilename } = useMediaStore.getState();
      
      const matchingClips = getClipsByFilename('non-existent.mp4');
      
      expect(matchingClips).toEqual([]);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useMediaStore.getState();
      
      setLoading(true);
      expect(useMediaStore.getState().loading).toBe(true);
      
      setLoading(false);
      expect(useMediaStore.getState().loading).toBe(false);
    });

    it('should set error state', () => {
      const { setError } = useMediaStore.getState();
      const error = createAppError('import', 'Test error');
      
      setError(error);
      expect(useMediaStore.getState().error).toEqual(error);
      
      setError(null);
      expect(useMediaStore.getState().error).toBe(null);
    });
  });

  describe('Computed Values', () => {
    it('should calculate total duration correctly', () => {
      const { addClip } = useMediaStore.getState();
      
      const clip1 = createMediaClip('/path1/video1.mp4', 'video1.mp4', {
        ...sampleMetadata,
        duration: 60,
      });
      const clip2 = createMediaClip('/path2/video2.mp4', 'video2.mp4', {
        ...sampleMetadata,
        duration: 30,
      });
      
      addClip(clip1);
      addClip(clip2);
      
      expect(useMediaStore.getState().totalDuration).toBe(90);
    });

    it('should calculate total file size correctly', () => {
      const { addClip } = useMediaStore.getState();
      
      const clip1 = createMediaClip('/path1/video1.mp4', 'video1.mp4', {
        ...sampleMetadata,
        fileSize: 500000,
      });
      const clip2 = createMediaClip('/path2/video2.mp4', 'video2.mp4', {
        ...sampleMetadata,
        fileSize: 300000,
      });
      
      addClip(clip1);
      addClip(clip2);
      
      expect(useMediaStore.getState().totalFileSize).toBe(800000);
    });
  });
});
