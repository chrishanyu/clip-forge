import React from 'react';

// ============================================================================
// LOADING STATE COMPONENT
// ============================================================================

export const LoadingState: React.FC = () => {
  return (
    <div className="media-library-loading">
      <div className="loading-placeholder">
        <div className="loading-spinner" />
        <span className="loading-text">Importing videos...</span>
      </div>
    </div>
  );
};
