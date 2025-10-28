import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { MediaClip, VideoMetadata, AppError, createAppError } from '@/types';

// ============================================================================
// MEDIA STORE INTERFACE
// ============================================================================

interface MediaStore {
  // State
  clips: MediaClip[];
  loading: boolean;
  error: AppError | null;
  
  // Computed values (as properties)
  totalClips: number;
  totalDuration: number;
  totalFileSize: number;
  
  // Actions
  addClip: (clip: MediaClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<MediaClip>) => void;
  clearClips: () => void;
  importVideo: (filePath: string) => Promise<void>;
  setClipLoading: (clipId: string, isLoading: boolean) => void;
  
  // Getters
  getClipById: (clipId: string) => MediaClip | undefined;
  getClipsByFilename: (filename: string) => MediaClip[];
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setError: (error: AppError | null) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const calculateTotalClips = (clips: MediaClip[]): number => {
  return clips.length;
};

const calculateTotalDuration = (clips: MediaClip[]): number => {
  return clips.reduce((total, clip) => total + clip.metadata.duration, 0);
};

const calculateTotalFileSize = (clips: MediaClip[]): number => {
  return clips.reduce((total, clip) => total + clip.metadata.fileSize, 0);
};

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
      totalClips: 0,
      totalDuration: 0,
      totalFileSize: 0,
      
      // Actions
      addClip: (clip: MediaClip) => {
        set(
          (state) => {
            const newClips = [...state.clips, clip];
            return {
              clips: newClips,
              totalClips: calculateTotalClips(newClips),
              totalDuration: calculateTotalDuration(newClips),
              totalFileSize: calculateTotalFileSize(newClips),
              error: null, // Clear any previous errors
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
              totalClips: calculateTotalClips(newClips),
              totalDuration: calculateTotalDuration(newClips),
              totalFileSize: calculateTotalFileSize(newClips),
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
              totalClips: calculateTotalClips(newClips),
              totalDuration: calculateTotalDuration(newClips),
              totalFileSize: calculateTotalFileSize(newClips),
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
            totalClips: 0,
            totalDuration: 0,
            totalFileSize: 0,
            error: null,
          },
          false,
          'mediaStore/clearClips'
        );
      },
      
      importVideo: async (filePath: string) => {
        try {
          set({ loading: true, error: null }, false, 'mediaStore/importVideo/start');
          
          // Check if file is already imported (ignore temporary clips)
          const existingClip = get().clips.find(clip => 
            clip.filepath === filePath && !clip.id.startsWith('temp-')
          );
          if (existingClip) {
            throw new Error('File is already imported');
          }
          
          // Call Tauri command to import the video
          const result = await invoke<{
            clip: MediaClip;
            metadata: VideoMetadata;
            thumbnailPath: string;
          }>('import_video_file', { request: { file_path: filePath } });
          
          // Add the imported clip to the store
          get().addClip(result.clip);
          
          set({ loading: false }, false, 'mediaStore/importVideo/success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to import video';
          set(
            { 
              loading: false, 
              error: createAppError('import', errorMessage, undefined, { filePath })
            }, 
            false, 
            'mediaStore/importVideo/error'
          );
          throw error;
        }
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
      
      setClipLoading: (clipId: string, isLoading: boolean) => {
        set(
          (state) => ({
            clips: state.clips.map((clip) =>
              clip.id === clipId ? { ...clip, isLoading } : clip
            ),
          }),
          false,
          'mediaStore/setClipLoading'
        );
      },
    }),
    {
      name: 'media-store',
      // Only enable devtools in development
      enabled: import.meta.env.DEV,
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
    importVideo: state.importVideo,
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
