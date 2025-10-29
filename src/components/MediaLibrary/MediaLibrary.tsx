import React, { useState, useEffect } from 'react';
import { useMediaStore } from '@/stores/mediaStore';
import { useTimelineStore } from '@/stores/timelineStore';
import { useProjectStore } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import { MediaClip, createTimelineClip } from '@/types';
import { useDragAndDrop, useTauriFileDrop } from '@/hooks';
import { useDragDropContext } from '@/contexts/DragDropContext';
import { 
  MediaLibraryHeader, 
  MediaLibraryContent, 
  MediaLibraryGrid,
  EmptyState, 
  LoadingState, 
  ErrorState, 
  DragOverlay 
} from './';
import ContextMenu from './ContextMenu';
import './MediaLibrary.css';

// ============================================================================
// MEDIA LIBRARY COMPONENT
// ============================================================================

interface MediaLibraryProps {
  className?: string;
}

export type { MediaLibraryProps };

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ className = '' }) => {
  const { clips, loading, error, importVideo, removeClip } = useMediaStore();
  const { tracks, addClipToTrack } = useTimelineStore();
  const { currentProject } = useProjectStore();
  const { showError, showSuccess } = useToastStore();
  const totalClips = clips.length;
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    clip: MediaClip;
    position: { x: number; y: number };
  } | null>(null);
  
  // Custom hooks
  const { isDragOver, dragHandlers } = useDragAndDrop();
  const { setupTauriFileDrop } = useTauriFileDrop();
  const { onMouseDown: handleClipMouseDown } = useDragDropContext();

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleClipClick = (clip: MediaClip) => {
    // Select/deselect the clip
    setSelectedClipId(selectedClipId === clip.id ? null : clip.id);
  };

  const handleClipDoubleClick = (clip: MediaClip) => {
    // Add clip to timeline
    try {
      console.log('Double-clicked clip:', clip.filename);
      console.log('Current tracks:', tracks.length);
      
      // Ensure timeline has tracks initialized
      if (tracks.length === 0) {
        console.error('No tracks available. Timeline should have default tracks.');
        return;
      }
      
      // Use the first track for MVP
      const firstTrack = tracks.length > 0 ? tracks[0] : useTimelineStore.getState().tracks[0];
      if (!firstTrack) {
        console.error('No tracks available');
        return;
      }
      
      // Calculate where to place the clip (at the end of existing clips on the track)
      const trackClips = firstTrack.clips;
      const lastClipEnd = trackClips.length > 0 
        ? Math.max(...trackClips.map(c => c.startTime + c.duration))
        : 0;
      
      // Create timeline clip
      const timelineClip = createTimelineClip(
        clip.id,
        firstTrack.id,
        lastClipEnd, // Start time
        clip.metadata.duration, // Duration
        0, // trimStart
        clip.metadata.duration // trimEnd
      );
      
      // Add to timeline
      addClipToTrack(timelineClip, firstTrack.id);
      
      console.log(`Added ${clip.filename} to timeline at ${lastClipEnd}s`);
    } catch (error) {
      console.error('Failed to add clip to timeline:', error);
    }
  };

  const handleClipRightClick = (clip: MediaClip, event: React.MouseEvent) => {
    event.preventDefault();
    
    // Calculate position for context menu
    const position = {
      x: event.clientX,
      y: event.clientY,
    };
    
    // Show context menu
    setContextMenu({ clip, position });
    
    // Clear selection when showing context menu
    setSelectedClipId(null);
  };

  const handleFileDrop = async (filePaths: string[]) => {
    try {
      for (const filePath of filePaths) {
        try {
          console.log('Importing file:', filePath);
          
          // Create a temporary clip with loading state
          const tempClip: MediaClip = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filepath: filePath,
            filename: filePath.split('/').pop() || 'Unknown',
            metadata: {
              duration: 0,
              width: 0,
              height: 0,
              fps: 0,
              codec: 'Unknown',
              container: 'Unknown',
              fileSize: 0,
              thumbnailPath: '',
              filepath: filePath,
              filename: filePath.split('/').pop() || 'Unknown',
              createdAt: new Date().toISOString(),
            },
            createdAt: new Date().toISOString(),
            isLoading: true,
          };
          
          // Add temporary clip to show loading state
          useMediaStore.getState().addClip(tempClip);
          
          // Import the actual video (always use project-based import)
          if (currentProject?.id) {
            await importVideo(filePath, currentProject.id);
          } else {
            console.warn('No current project available for import');
            throw new Error('No project available for video import');
          }
          
          // Remove the temporary clip (the real one will be added by importVideo)
          useMediaStore.getState().removeClip(tempClip.id);
          
          // Show success message
          const filename = filePath.split('/').pop() || 'Unknown file';
          showSuccess('Import Successful', `"${filename}" imported successfully`);
          
        } catch (error) {
          console.error(`Failed to import ${filePath}:`, error);
          // Remove any temporary clips that failed
          const tempClips = clips.filter(clip => clip.id.startsWith('temp-'));
          tempClips.forEach(clip => useMediaStore.getState().removeClip(clip.id));
          
          // Show user-friendly error message
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const filename = filePath.split('/').pop() || 'Unknown file';
          
          showError(
            'Import Failed',
            `Failed to import "${filename}": ${errorMessage}`
          );
        }
      }
    } catch (error) {
      console.error('Error in handleFileDrop:', error);
    }
  };

  // ============================================================================
  // CONTEXT MENU HANDLERS
  // ============================================================================

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleContextMenuDelete = (clip: MediaClip) => {
    try {
      removeClip(clip.id);
      setContextMenu(null);
      showSuccess('Clip Deleted', `"${clip.filename}" removed from library`);
    } catch (error) {
      console.error('Failed to delete clip:', error);
      showError('Delete Failed', `Failed to remove "${clip.filename}"`);
    }
  };

  const handleContextMenuAddToTimeline = (clip: MediaClip) => {
    // Reuse the double-click logic
    handleClipDoubleClick(clip);
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
        {/* Show global loading state only for general loading, not per-clip loading */}
        {loading && <LoadingState />}
        {error && !loading && <ErrorState error={error} />}
        {!loading && !error && totalClips === 0 && <EmptyState />}
        {!loading && !error && totalClips > 0 && (
          <MediaLibraryGrid 
            clips={clips}
            selectedClipId={selectedClipId}
            onClipClick={handleClipClick}
            onClipDoubleClick={handleClipDoubleClick}
            onClipRightClick={handleClipRightClick}
            onClipMouseDownForDrag={handleClipMouseDown}
          />
        )}
        
        {isDragOver && <DragOverlay />}
      </MediaLibraryContent>
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          clip={contextMenu.clip}
          position={contextMenu.position}
          onClose={handleContextMenuClose}
          onDelete={handleContextMenuDelete}
          onAddToTimeline={handleContextMenuAddToTimeline}
        />
      )}
    </div>
  );
};

export default MediaLibrary;
