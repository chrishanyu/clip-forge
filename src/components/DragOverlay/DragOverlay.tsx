import React from 'react';
import { useDragDropContext } from '@/contexts/DragDropContext';
import './DragOverlay.css';

export const DragOverlay: React.FC = () => {
  const { dragState } = useDragDropContext();

  if (!dragState.isDragging || !dragState.draggedClip) {
    return null;
  }

  return (
    <div
      className="drag-overlay"
      style={{
        left: dragState.currentX + 10,
        top: dragState.currentY + 10,
      }}
    >
      <div className="drag-overlay-content">
        <span className="drag-icon">🎬</span>
        <span className="drag-filename">{dragState.draggedClip.filename}</span>
      </div>
    </div>
  );
};

