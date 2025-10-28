import React from 'react';

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

export const EmptyState: React.FC = () => {
  return (
    <div className="media-library-empty">
      <div className="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <h3 className="empty-title">No videos imported</h3>
      <p className="empty-description">
        Drag and drop video files here or use the import button to get started
      </p>
      <div className="empty-formats">
        <span className="format-tag">MP4</span>
        <span className="format-tag">MOV</span>
        <span className="format-tag">WebM</span>
      </div>
    </div>
  );
};
