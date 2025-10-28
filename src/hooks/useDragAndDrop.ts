import { useState, useCallback } from 'react';

// ============================================================================
// DRAG AND DROP HOOK INTERFACE
// ============================================================================

interface DragAndDropHandlers {
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

interface DragAndDropHook {
  isDragOver: boolean;
  setIsDragOver: (value: boolean) => void;
  dragHandlers: DragAndDropHandlers;
}

// ============================================================================
// DRAG AND DROP HOOK IMPLEMENTATION
// ============================================================================

export const useDragAndDrop = (): DragAndDropHook => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Web drag enter detected');
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Web drag leave detected');
    
    // Only set drag over to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Web drop detected');
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    console.log('Web drop files:', files.map(f => f.name));
    
    if (files.length === 0) {
      console.warn('No files found in web drop event');
      return;
    }

    // Filter valid video files
    const validFiles = files.filter(file => {
      const validExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
      const fileName = file.name.toLowerCase();
      return validExtensions.some(ext => fileName.endsWith(ext));
    });
    
    if (validFiles.length === 0) {
      console.warn('No valid video files found in web dropped files');
      return;
    }

    if (validFiles.length < files.length) {
      console.warn(`Filtered out ${files.length - validFiles.length} invalid files`);
    }

    console.log('Valid web files:', validFiles.map(f => f.name));

    // For web files, we can't get the actual file path, so we'll show a message
    // In a real Tauri app, we'd need to handle this differently
    alert(`Detected ${validFiles.length} video file(s): ${validFiles.map(f => f.name).join(', ')}\n\nNote: Web drag-and-drop detected files but cannot access file paths. Please use the Import button for now.`);
  }, []);

  const dragHandlers: DragAndDropHandlers = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return {
    isDragOver,
    setIsDragOver,
    dragHandlers,
  };
};
