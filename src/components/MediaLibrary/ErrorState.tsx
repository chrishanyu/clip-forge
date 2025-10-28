import React from 'react';
import { AppError } from '@/types';

// ============================================================================
// ERROR STATE COMPONENT
// ============================================================================

interface ErrorStateProps {
  error: AppError;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error }) => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="media-library-error">
      <div className="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <h3 className="error-title">Import Error</h3>
      <p className="error-message">{error.message || 'Failed to import videos'}</p>
      <button className="error-retry-btn" onClick={handleRetry}>
        Try Again
      </button>
    </div>
  );
};
