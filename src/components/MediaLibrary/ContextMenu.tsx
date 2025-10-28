import React, { useEffect, useRef } from 'react';
import { MediaClip } from '@/types';
import './ContextMenu.css';

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

interface ContextMenuProps {
  clip: MediaClip;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (clip: MediaClip) => void;
  onAddToTimeline: (clip: MediaClip) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  clip,
  position,
  onClose,
  onDelete,
  onAddToTimeline,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleDelete = () => {
    onDelete(clip);
    onClose();
  };

  const handleAddToTimeline = () => {
    onAddToTimeline(clip);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    // Focus the menu for keyboard navigation
    menuRef.current?.focus();

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [onClose]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      role="menu"
      aria-label={`Context menu for ${clip.filename}`}
    >
      <div className="context-menu-content">
        <div className="context-menu-header">
          <span className="context-menu-title" title={clip.filename}>
            {clip.filename}
          </span>
        </div>
        
        <div className="context-menu-divider" />
        
        <div className="context-menu-items">
          <button
            className="context-menu-item"
            onClick={handleAddToTimeline}
            role="menuitem"
            aria-label="Add to timeline"
          >
            <svg className="context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add to Timeline</span>
          </button>
          
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={handleDelete}
            role="menuitem"
            aria-label="Delete clip"
          >
            <svg className="context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6" />
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextMenu;
