import { useState, useCallback, useRef } from 'react';
import { MediaClip } from '@/types';

// ============================================================================
// TIMELINE DRAG AND DROP HOOK INTERFACE
// ============================================================================

export interface DragData {
  type: 'media-clip';
  clip: MediaClip;
}

export interface DropZone {
  trackId: string;
  startTime: number;
  endTime: number;
}

interface TimelineDragAndDropHandlers {
  onDragStart: (clip: MediaClip, e: React.DragEvent) => void;
  onDragEnd: (clip: MediaClip, e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent, trackId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, trackId: string) => void;
}

interface TimelineDragAndDropHook {
  isDragging: boolean;
  draggedClip: MediaClip | null;
  dropZone: DropZone | null;
  dragHandlers: TimelineDragAndDropHandlers;
}

// ============================================================================
// TIMELINE DRAG AND DROP HOOK IMPLEMENTATION
// ============================================================================

export const useTimelineDragAndDrop = (): TimelineDragAndDropHook => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedClip, setDraggedClip] = useState<MediaClip | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const dragStartTime = useRef<number>(0);

  const handleDragStart = useCallback((clip: MediaClip, e: React.DragEvent) => {
    console.log('🚀 [useTimelineDragAndDrop] handleDragStart:', clip.filename);
    setIsDragging(true);
    setDraggedClip(clip);
    dragStartTime.current = Date.now();
    
    // Set drag data
    const dragData: DragData = {
      type: 'media-clip',
      clip: clip
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    console.log('✅ [useTimelineDragAndDrop] Drag state set, isDragging: true');
  }, []);

  const handleDragEnd = useCallback((clip: MediaClip, e: React.DragEvent) => {
    console.log('🛑 [useTimelineDragAndDrop] handleDragEnd:', clip.filename);
    setIsDragging(false);
    setDraggedClip(null);
    setDropZone(null);
    console.log('✅ [useTimelineDragAndDrop] Drag state cleared, isDragging: false');
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only handle if we're dragging a media clip
    if (!isDragging || !draggedClip) return;
    
    // Calculate drop position based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50; // This should come from the timeline component
    const startTime = Math.max(0, x / pixelsPerSecond);
    
    setDropZone({
      trackId,
      startTime,
      endTime: startTime + (draggedClip.duration || 10) // Default 10 seconds if no duration
    });
  }, [isDragging, draggedClip]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drop zone if we're actually leaving the track
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDropZone(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isDragging || !draggedClip) return;
    
    // Update drop zone position based on current mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50; // This should come from the timeline component
    const startTime = Math.max(0, x / pixelsPerSecond);
    
    setDropZone(prev => prev ? {
      ...prev,
      startTime,
      endTime: startTime + (draggedClip.duration || 10)
    } : null);
  }, [isDragging, draggedClip]);

  const handleDrop = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedClip) {
      return;
    }
    
    // Calculate final drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50; // This should come from the timeline component
    const startTime = Math.max(0, x / pixelsPerSecond);
    
    // This will be handled by the parent component
    // The parent should call the appropriate timeline store action
    
    // Reset drag state
    setIsDragging(false);
    setDraggedClip(null);
    setDropZone(null);
  }, [draggedClip]);

  const dragHandlers: TimelineDragAndDropHandlers = {
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return {
    isDragging,
    draggedClip,
    dropZone,
    dragHandlers,
  };
};
