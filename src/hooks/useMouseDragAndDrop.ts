import { useState, useCallback, useRef, useEffect } from 'react';
import { MediaClip } from '@/types';

// ============================================================================
// MOUSE DRAG AND DROP HOOK
// ============================================================================
// This hook implements drag-and-drop using mouse events instead of HTML5 drag API
// This is necessary because Tauri intercepts drag events for file dropping

export interface MouseDragState {
  isDragging: boolean;
  draggedClip: MediaClip | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface MouseDragHandlers {
  onMouseDown: (clip: MediaClip, e: React.MouseEvent) => void;
  registerDropZone: (id: string, onDrop: (clip: MediaClip, x: number, y: number) => void) => void;
  unregisterDropZone: (id: string) => void;
}

export const useMouseDragAndDrop = () => {
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
    // Prevent default to avoid text selection
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    draggedClipRef.current = clip;

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
      // Find the drop zone element
      let dropZoneElement = element.closest('[data-drop-zone]');
      
      if (dropZoneElement) {
        const dropZoneId = dropZoneElement.getAttribute('data-drop-zone');
        
        if (dropZoneId && dropZones.current.has(dropZoneId)) {
          const handler = dropZones.current.get(dropZoneId)!;
          handler(clip, e.clientX, e.clientY);
        }
      }
    }

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

  return {
    dragState,
    onMouseDown: handleMouseDown,
    registerDropZone,
    unregisterDropZone,
  };
};

