import React from 'react';
import { MediaClip } from '@/types';
import { ClipCard } from './ClipCard';

// ============================================================================
// MEDIA LIBRARY GRID COMPONENT
// ============================================================================

interface MediaLibraryGridProps {
  clips: MediaClip[];
  selectedClipId?: string | null;
  onClipClick?: (clip: MediaClip) => void;
  onClipDoubleClick?: (clip: MediaClip) => void;
  onClipRightClick?: (clip: MediaClip, event: React.MouseEvent) => void;
}

export const MediaLibraryGrid: React.FC<MediaLibraryGridProps> = ({
  clips,
  selectedClipId,
  onClipClick,
  onClipDoubleClick,
  onClipRightClick,
}) => {
  return (
    <div className="media-library-grid">
      {clips.map((clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          isSelected={selectedClipId === clip.id}
          onClick={onClipClick}
          onDoubleClick={onClipDoubleClick}
          onRightClick={onClipRightClick}
        />
      ))}
    </div>
  );
};
