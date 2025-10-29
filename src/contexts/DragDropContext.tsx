import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { MediaClip } from '@/types';

// ============================================================================
// DRAG DROP CONTEXT
// ============================================================================

export interface MouseDragState {
  isDragging: boolean;
  draggedClip: MediaClip | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DragDropContextType {
  dragState: MouseDragState;
  onMouseDown: (clip: MediaClip, e: React.MouseEvent) => void;
  registerDropZone: (id: string, onDrop: (clip: MediaClip, x: number, y: number) => void) => void;
  unregisterDropZone: (id: string) => void;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dragState, setDragState] = useState<MouseDragState>({
    isDragging: false,
    draggedClip: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const dropZones = useRef<Map<string, (clip: MediaClip, x: number, y: number) => void>>(new Map());
  const isDraggingRef = useRef(false);
  const draggedClipRef = useRef<MediaClip | null>(null);

  const handleMouseDown = useCallback((clip: MediaClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    draggedClipRef.current = clip;

    // Add dragging class to body for CSS hooks
    document.body.classList.add('dragging');

    setDragState({
      isDragging: true,
      draggedClip: clip,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !draggedClipRef.current) return;

    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY,
    }));
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !draggedClipRef.current) return;

    const clip = draggedClipRef.current;

    // Check if we're over a drop zone
    const element = document.elementFromPoint(e.clientX, e.clientY);
    
    if (element) {
      let dropZoneElement = element.closest('[data-drop-zone]');
      
      if (dropZoneElement) {
        const dropZoneId = dropZoneElement.getAttribute('data-drop-zone');
        
        if (dropZoneId && dropZones.current.has(dropZoneId)) {
          const handler = dropZones.current.get(dropZoneId)!;
          handler(clip, e.clientX, e.clientY);
        }
      }
    }

    // Remove dragging class from body
    document.body.classList.remove('dragging');

    // Reset drag state
    isDraggingRef.current = false;
    draggedClipRef.current = null;
    setDragState({
      isDragging: false,
      draggedClip: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
  }, []);

  const registerDropZone = useCallback((id: string, onDrop: (clip: MediaClip, x: number, y: number) => void) => {
    dropZones.current.set(id, onDrop);
  }, []);

  const unregisterDropZone = useCallback((id: string) => {
    dropZones.current.delete(id);
  }, []);

  // Set up global mouse event listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <DragDropContext.Provider
      value={{
        dragState,
        onMouseDown: handleMouseDown,
        registerDropZone,
        unregisterDropZone,
      }}
    >
      {children}
    </DragDropContext.Provider>
  );
};

export const useDragDropContext = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDropContext must be used within a DragDropProvider');
  }
  return context;
};

