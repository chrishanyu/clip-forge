import { useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { filterValidVideoFiles } from '@/utils/fileValidation';

// ============================================================================
// TAURI FILE DROP HOOK INTERFACE
// ============================================================================

interface TauriFileDropHook {
  setupTauriFileDrop: (onFileDrop: (filePaths: string[]) => Promise<void>) => void;
}

// ============================================================================
// TAURI FILE DROP HOOK IMPLEMENTATION
// ============================================================================

export const useTauriFileDrop = (): TauriFileDropHook => {
  const setupTauriFileDrop = useCallback((onFileDrop: (filePaths: string[]) => Promise<void>) => {
    let unlistenDragDrop: (() => void) | undefined;
    let isActive = true;
    
    const setupListeners = async () => {
      // Clean up any existing listener first
      if (unlistenDragDrop) {
        unlistenDragDrop();
        unlistenDragDrop = undefined;
      }
      
      try {
        // Get the current webview window
        const webview = getCurrentWebviewWindow();
        
        // Set up drag-drop event listener using the correct Tauri API
        unlistenDragDrop = await webview.onDragDropEvent((event) => {
          if (!isActive) return;
          
          // Handle different event types based on the event payload
          const eventType = event.payload?.type || 'unknown';
          
          // Only handle enter, leave, and drop events to avoid callback issues with over events
          switch (eventType) {
            case 'enter':
              // File drop enter detected
              break;
              
            case 'leave':
              // File drop leave detected
              break;
              
            case 'drop':
              // Extract file paths from the payload
              const payload = event.payload as { paths: string[]; position: { x: number; y: number } };
              const filePaths = payload.paths;
              
              if (!filePaths || filePaths.length === 0) {
                return;
              }

              // Filter valid video files
              const validFiles = filterValidVideoFiles(filePaths);
              
              if (validFiles.length === 0) {
                return;
              }

              // Call the provided file drop handler asynchronously without awaiting
              onFileDrop(validFiles).catch((error) => {
                console.error('Error handling file drop:', error);
              });
              break;
              
            case 'over':
              // Ignore over events to prevent callback warnings
              break;
              
            default:
              // Unknown drag-drop event type
              break;
          }
        });
      } catch (error) {
        console.error('Failed to set up Tauri file drop listeners:', error);
      }
    };

    setupListeners();

    // Return cleanup function
    return () => {
      isActive = false;
      if (unlistenDragDrop) {
        unlistenDragDrop();
        unlistenDragDrop = undefined;
      }
    };
  }, []);

  return {
    setupTauriFileDrop,
  };
};
