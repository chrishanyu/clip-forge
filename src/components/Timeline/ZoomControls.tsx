import React from 'react';
import './ZoomControls.css';

// ============================================================================
// ZOOM CONTROLS COMPONENT INTERFACE
// ============================================================================

export interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  snapToGrid?: boolean;
  onToggleSnap?: () => void;
  className?: string;
}

// ============================================================================
// ZOOM CONTROLS COMPONENT
// ============================================================================

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  snapToGrid = true,
  onToggleSnap,
  className = ''
}) => {
  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`zoom-controls ${className}`}>
      <div className="zoom-info">
        <span className="zoom-label">Zoom:</span>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      </div>
      
      <div className="zoom-buttons">
        <button
          className="zoom-button zoom-out"
          onClick={onZoomOut}
          title="Zoom Out"
        >
          −
        </button>
        
        <button
          className="zoom-button zoom-reset"
          onClick={onResetZoom}
          title="Reset Zoom"
        >
          ⌂
        </button>
        
        <button
          className="zoom-button zoom-in"
          onClick={onZoomIn}
          title="Zoom In"
        >
          +
        </button>
      </div>
      
      {onToggleSnap && (
        <div className="snap-controls">
          <button
            className={`snap-button ${snapToGrid ? 'active' : ''}`}
            onClick={onToggleSnap}
            title={snapToGrid ? 'Disable Snap to Grid' : 'Enable Snap to Grid'}
          >
            {snapToGrid ? '⊞' : '⊡'}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ZoomControls;
