import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useMediaStore } from '@/stores/mediaStore';
import './ImportButton.css';

interface ImportButtonProps {
  className?: string;
}

export type { ImportButtonProps };

export const ImportButton: React.FC<ImportButtonProps> = ({ className = '' }) => {
  const [isImporting, setIsImporting] = useState(false);
  const importVideo = useMediaStore((state) => state.importVideo);

  const handleImportClick = async () => {
    try {
      setIsImporting(true);

      // Open native file dialog
      const selectedFiles = await open({
        multiple: true,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']
          }
        ]
      });

      if (!selectedFiles || selectedFiles.length === 0) {
        return; // User cancelled
      }

      // Import each selected file
      for (const filePath of selectedFiles) {
        try {
          await importVideo(filePath);
        } catch (error) {
          console.error(`Failed to import ${filePath}:`, error);
          // Continue with other files even if one fails
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <button
      className={`import-button ${className}`}
      onClick={handleImportClick}
      disabled={isImporting}
      aria-label="Import video files"
    >
      {isImporting ? (
        <>
          <div className="import-spinner" />
          <span>Importing...</span>
        </>
      ) : (
        <>
          <svg className="import-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
          <span>Import Videos</span>
        </>
      )}
    </button>
  );
};
