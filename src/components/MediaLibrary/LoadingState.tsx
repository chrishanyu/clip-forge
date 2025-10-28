import React from 'react';

// ============================================================================
// LOADING STATE COMPONENT
// ============================================================================

export const LoadingState: React.FC = () => {
  return (
    <div className="media-library-loading">
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
      <p className="loading-text">Importing videos...</p>
    </div>
  );
};
