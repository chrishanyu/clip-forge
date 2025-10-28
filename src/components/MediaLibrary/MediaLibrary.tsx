import React, { useState, useEffect } from 'react';
import { useMediaStore } from '@/stores/mediaStore';
import { MediaClip } from '@/types';
import { useDragAndDrop, useTauriFileDrop } from '@/hooks';
import { 
  MediaLibraryHeader, 
  MediaLibraryContent, 
  MediaLibraryGrid,
  EmptyState, 
  LoadingState, 
  ErrorState, 
  DragOverlay 
} from './';
import './MediaLibrary.css';

// ============================================================================
// MEDIA LIBRARY COMPONENT
// ============================================================================

interface MediaLibraryProps {
  className?: string;
}

export type { MediaLibraryProps };

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ className = '' }) => {
  const { clips, loading, error, importVideo } = useMediaStore();
  const totalClips = clips.length;
  const [isImporting, setIsImporting] = useState(false);
  
  // Custom hooks
  const { isDragOver, dragHandlers } = useDragAndDrop();
  const { setupTauriFileDrop } = useTauriFileDrop();

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleClipClick = (clip: MediaClip) => {
    // TODO: Implement clip selection logic
    console.log('Clip clicked:', clip.filename);
  };

  const handleClipDoubleClick = (clip: MediaClip) => {
    // TODO: Implement add to timeline logic
    console.log('Clip double-clicked:', clip.filename);
  };

  const handleClipRightClick = (clip: MediaClip, _event: React.MouseEvent) => {
    // TODO: Implement context menu logic
    console.log('Clip right-clicked:', clip.filename);
  };

  const handleFileDrop = async (filePaths: string[]) => {
    setIsImporting(true);
    try {
      for (const filePath of filePaths) {
        try {
          console.log('Importing file:', filePath);
          await importVideo(filePath);
        } catch (error) {
          console.error(`Failed to import ${filePath}:`, error);
          // Continue with other files even if one fails
        }
      }
    } finally {
      setIsImporting(false);
    }
  };

  // ============================================================================
  // TAURI FILE DROP SETUP
  // ============================================================================
  
  useEffect(() => {
    const cleanup = setupTauriFileDrop(handleFileDrop);
    return cleanup;
  }, [setupTauriFileDrop]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <div 
      className={`media-library ${className} ${isDragOver ? 'drag-over' : ''}`}
      {...dragHandlers}
    >
      <MediaLibraryHeader totalClips={totalClips} />
      
      <MediaLibraryContent>
        {(loading || isImporting) && <LoadingState />}
        {error && !loading && !isImporting && <ErrorState error={error} />}
        {!loading && !isImporting && !error && totalClips === 0 && <EmptyState />}
        {!loading && !isImporting && !error && totalClips > 0 && (
          <MediaLibraryGrid 
            clips={clips}
            onClipClick={handleClipClick}
            onClipDoubleClick={handleClipDoubleClick}
            onClipRightClick={handleClipRightClick}
          />
        )}
        
        {isDragOver && <DragOverlay />}
      </MediaLibraryContent>
    </div>
  );
};

export default MediaLibrary;
