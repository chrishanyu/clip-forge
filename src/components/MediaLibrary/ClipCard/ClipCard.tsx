import React from 'react';
import { MediaClip } from '@/types';
import './ClipCard.css';

interface ClipCardProps {
  clip: MediaClip;
  isSelected?: boolean;
  onClick?: (clip: MediaClip) => void;
  onDoubleClick?: (clip: MediaClip) => void;
  onRightClick?: (clip: MediaClip, event: React.MouseEvent) => void;
  className?: string;
}

export type { ClipCardProps };

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  isSelected = false,
  onClick,
  onDoubleClick,
  onRightClick,
  className = ''
}) => {
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatResolution = (width: number, height: number): string => {
    return `${width}×${height}`;
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleClick = () => {
    onClick?.(clip);
  };

  const handleDoubleClick = () => {
    onDoubleClick?.(clip);
  };

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    onRightClick?.(clip, event);
  };

  const handleThumbnailError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Fallback to a placeholder SVG if thumbnail fails to load
    const target = e.target as HTMLImageElement;
    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB2aWV3Qm94PSIwIDAgMTYwIDkwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI4MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VmlkZW88L3RleHQ+PC9zdmc+';
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Show loading state if clip is loading
  if (clip.isLoading) {
    return (
      <div
        className={`clip-card loading ${className}`}
        role="button"
        tabIndex={-1}
        aria-label={`Loading video clip: ${clip.filename}`}
      >
        {/* Loading Thumbnail Section */}
        <div className="clip-thumbnail loading">
          <div className="loading-placeholder">
            <div className="loading-spinner" />
            <span className="loading-text">Processing...</span>
          </div>
        </div>
        
        {/* Loading Info Section */}
        <div className="clip-info loading">
          <h4 className="clip-filename loading" title={clip.filename}>
            {clip.filename}
          </h4>
          
          <div className="clip-metadata loading">
            <div className="metadata-row">
              <span className="metadata-item loading">Loading...</span>
              <span className="metadata-item loading">Loading...</span>
            </div>
            
            <div className="metadata-row">
              <span className="metadata-item loading">Loading...</span>
              <span className="metadata-item loading">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`clip-card ${isSelected ? 'selected' : ''} ${className}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleRightClick}
      role="button"
      tabIndex={0}
      aria-label={`Video clip: ${clip.filename}`}
    >
      {/* Thumbnail Section */}
      <div className="clip-thumbnail">
        <img 
          src={clip.metadata.thumbnailPath} 
          alt={clip.filename}
          className="thumbnail-image"
          onError={handleThumbnailError}
          loading="lazy"
        />
        
        {/* Duration Overlay */}
        <div className="clip-duration">
          {formatDuration(clip.metadata.duration)}
        </div>
        
        {/* Selection Indicator */}
        {isSelected && (
          <div className="selection-indicator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Info Section */}
      <div className="clip-info">
        <h4 className="clip-filename" title={clip.filename}>
          {clip.filename}
        </h4>
        
        <div className="clip-metadata">
          <div className="metadata-row">
            <span className="metadata-item">
              {formatResolution(clip.metadata.width, clip.metadata.height)}
            </span>
            <span className="metadata-item">
              {formatFileSize(clip.metadata.fileSize)}
            </span>
          </div>
          
          <div className="metadata-row">
            <span className="metadata-item">
              {clip.metadata.fps.toFixed(1)} fps
            </span>
            <span className="metadata-item">
              {clip.metadata.codec}
            </span>
          </div>
        </div>
      </div>
      
      {/* Hover Overlay */}
      <div className="clip-overlay">
        <div className="overlay-actions">
          <button 
            className="overlay-btn play-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick?.(clip);
            }}
            aria-label="Play video"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
          
          <button 
            className="overlay-btn add-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick?.(clip);
            }}
            aria-label="Add to timeline"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
