import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { MediaClip, VideoMetadata, AppError } from '@/types';

// ============================================================================
// MEDIA STORE INTERFACE
// ============================================================================

interface MediaStore {
  // State
  clips: MediaClip[];
  loading: boolean;
  error: AppError | null;
  
  // Actions
  addClip: (clip: MediaClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<MediaClip>) => void;
  clearClips: () => void;
  
  // Getters
  getClipById: (clipId: string) => MediaClip | undefined;
  getClipsByFilename: (filename: string) => MediaClip[];
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setError: (error: AppError | null) => void;
  
  // Computed values
  totalClips: number;
  totalDuration: number;
  totalFileSize: number;
}

// ============================================================================
// MEDIA STORE IMPLEMENTATION
// ============================================================================

export const useMediaStore = create<MediaStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      clips: [],
      loading: false,
      error: null,
      
      // Actions
      addClip: (clip: MediaClip) => {
        set(
          (state) => {
            const newClips = [...state.clips, clip];
            return {
              clips: newClips,
              error: null, // Clear any previous errors
              totalClips: newClips.length,
              totalDuration: newClips.reduce((total, c) => total + c.metadata.duration, 0),
              totalFileSize: newClips.reduce((total, c) => total + c.metadata.fileSize, 0),
            };
          },
          false,
          'mediaStore/addClip'
        );
      },
      
      removeClip: (clipId: string) => {
        set(
          (state) => {
            const newClips = state.clips.filter((clip) => clip.id !== clipId);
            return {
              clips: newClips,
              totalClips: newClips.length,
              totalDuration: newClips.reduce((total, c) => total + c.metadata.duration, 0),
              totalFileSize: newClips.reduce((total, c) => total + c.metadata.fileSize, 0),
            };
          },
          false,
          'mediaStore/removeClip'
        );
      },
      
      updateClip: (clipId: string, updates: Partial<MediaClip>) => {
        set(
          (state) => {
            const newClips = state.clips.map((clip) =>
              clip.id === clipId ? { ...clip, ...updates } : clip
            );
            return {
              clips: newClips,
              totalClips: newClips.length,
              totalDuration: newClips.reduce((total, c) => total + c.metadata.duration, 0),
              totalFileSize: newClips.reduce((total, c) => total + c.metadata.fileSize, 0),
            };
          },
          false,
          'mediaStore/updateClip'
        );
      },
      
      clearClips: () => {
        set(
          {
            clips: [],
            error: null,
            totalClips: 0,
            totalDuration: 0,
            totalFileSize: 0,
          },
          false,
          'mediaStore/clearClips'
        );
      },
      
      // Getters
      getClipById: (clipId: string) => {
        const state = get();
        return state.clips.find((clip) => clip.id === clipId);
      },
      
      getClipsByFilename: (filename: string) => {
        const state = get();
        return state.clips.filter((clip) => clip.filename === filename);
      },
      
      // Loading states
      setLoading: (loading: boolean) => {
        set({ loading }, false, 'mediaStore/setLoading');
      },
      
      setError: (error: AppError | null) => {
        set({ error }, false, 'mediaStore/setError');
      },
      
      // Computed values (as regular properties, not getters)
      totalClips: 0,
      totalDuration: 0,
      totalFileSize: 0,
    }),
    {
      name: 'media-store',
      // Only enable devtools in development
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// SELECTOR HOOKS FOR PERFORMANCE
// ============================================================================

/**
 * Selector hook for getting all clips
 * Use this instead of useMediaStore() to avoid unnecessary re-renders
 */
export const useClips = () => useMediaStore((state) => state.clips);

/**
 * Selector hook for getting loading state
 */
export const useMediaLoading = () => useMediaStore((state) => state.loading);

/**
 * Selector hook for getting error state
 */
export const useMediaError = () => useMediaStore((state) => state.error);

/**
 * Selector hook for getting a specific clip by ID
 */
export const useClipById = (clipId: string) =>
  useMediaStore((state) => state.getClipById(clipId));

/**
 * Selector hook for getting computed values
 */
export const useMediaStats = () =>
  useMediaStore((state) => ({
    totalClips: state.totalClips,
    totalDuration: state.totalDuration,
    totalFileSize: state.totalFileSize,
  }));

// ============================================================================
// ACTION HOOKS FOR CONVENIENCE
// ============================================================================

/**
 * Hook for media store actions
 */
export const useMediaActions = () =>
  useMediaStore((state) => ({
    addClip: state.addClip,
    removeClip: state.removeClip,
    updateClip: state.updateClip,
    clearClips: state.clearClips,
    setLoading: state.setLoading,
    setError: state.setError,
  }));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a file is already imported
 */
export const isFileAlreadyImported = (filepath: string): boolean => {
  const clips = useMediaStore.getState().clips;
  return clips.some((clip) => clip.filepath === filepath);
};

/**
 * Get clips sorted by creation date (newest first)
 */
export const getClipsSortedByDate = (): MediaClip[] => {
  const clips = useMediaStore.getState().clips;
  return [...clips].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

/**
 * Get clips sorted by filename (alphabetical)
 */
export const getClipsSortedByName = (): MediaClip[] => {
  const clips = useMediaStore.getState().clips;
  return [...clips].sort((a, b) => a.filename.localeCompare(b.filename));
};

/**
 * Get clips sorted by duration (longest first)
 */
export const getClipsSortedByDuration = (): MediaClip[] => {
  const clips = useMediaStore.getState().clips;
  return [...clips].sort((a, b) => b.metadata.duration - a.metadata.duration);
};
