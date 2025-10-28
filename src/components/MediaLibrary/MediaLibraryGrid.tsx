import React from 'react';
import { MediaClip } from '@/types';
import { ClipCard } from './ClipCard';

// ============================================================================
// MEDIA LIBRARY GRID COMPONENT
// ============================================================================

interface MediaLibraryGridProps {
  clips: MediaClip[];
  onClipClick?: (clip: MediaClip) => void;
  onClipDoubleClick?: (clip: MediaClip) => void;
  onClipRightClick?: (clip: MediaClip, event: React.MouseEvent) => void;
}

export const MediaLibraryGrid: React.FC<MediaLibraryGridProps> = ({
  clips,
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
          onClick={onClipClick}
          onDoubleClick={onClipDoubleClick}
          onRightClick={onClipRightClick}
        />
      ))}
    </div>
  );
};
