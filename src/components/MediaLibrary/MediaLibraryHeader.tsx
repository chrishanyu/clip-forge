import React from 'react';

// ============================================================================
// MEDIA LIBRARY HEADER COMPONENT
// ============================================================================

interface MediaLibraryHeaderProps {
  totalClips: number;
}

export const MediaLibraryHeader: React.FC<MediaLibraryHeaderProps> = ({ totalClips }) => {
  return (
    <div className="media-library-header">
      <h2 className="library-title">Media Library</h2>
      <div className="library-actions">
        {totalClips > 0 && (
          <span className="clips-count">{totalClips} video{totalClips !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
};
