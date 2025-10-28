import React from 'react';

// ============================================================================
// MEDIA LIBRARY CONTENT COMPONENT
// ============================================================================

interface MediaLibraryContentProps {
  children: React.ReactNode;
}

export const MediaLibraryContent: React.FC<MediaLibraryContentProps> = ({ children }) => {
  return (
    <div className="media-library-content">
      {children}
    </div>
  );
};
