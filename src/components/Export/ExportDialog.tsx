import React, { useState, useEffect } from 'react';
import { ExportSettings, ExportResolution, ExportQuality, ExportFormat, ExportCodec } from '@/types/export';
import { useTimelineStore } from '@/stores/timelineStore';
import { useMediaStore } from '@/stores/mediaStore';
import { useExportStore } from '@/stores/exportStore';
import { invoke } from '@tauri-apps/api/core';
import './ExportDialog.css';

// ============================================================================
// EXPORT DIALOG COMPONENT
// ============================================================================

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExportStart?: () => void;
}

export type { ExportDialogProps };

export const ExportDialog: React.FC<ExportDialogProps> = ({ 
  isOpen, 
  onClose, 
  onExportStart 
}) => {
  const { tracks } = useTimelineStore();
  const { clips: mediaClips } = useMediaStore();
  const { startExport, showProgress } = useExportStore();
  const [settings, setSettings] = useState<ExportSettings>({
    outputPath: '',
    filename: 'exported_video',
    resolution: '1080p',
    quality: 'medium',
    format: 'mp4',
    codec: 'h264'
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSettings({
        outputPath: '',
        filename: 'exported_video',
        resolution: '1080p',
        quality: 'medium',
        format: 'mp4',
        codec: 'h264'
      });
      setValidationError(null);
    }
  }, [isOpen]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleResolutionChange = (resolution: ExportResolution) => {
    setSettings(prev => ({ ...prev, resolution }));
  };

  const handleQualityChange = (quality: ExportQuality) => {
    setSettings(prev => ({ ...prev, quality }));
  };

  const handleFilenameChange = (filename: string) => {
    setSettings(prev => ({ ...prev, filename: filename.trim() }));
  };

  const handleOutputPathChange = (outputPath: string) => {
    setSettings(prev => ({ ...prev, outputPath }));
  };

  const handleFormatChange = (format: ExportFormat) => {
    setSettings(prev => ({ ...prev, format }));
  };

  const handleCodecChange = (codec: ExportCodec) => {
    setSettings(prev => ({ ...prev, codec }));
  };

  const handleSelectOutputPath = async () => {
    try {
      const result = await invoke<string>('select_output_path');
      if (result) {
        setSettings(prev => ({ ...prev, outputPath: result }));
      }
    } catch (error) {
      console.error('Failed to select output path:', error);
      setValidationError('Failed to select output path');
    }
  };

  const validateSettings = (): string | null => {
    if (!settings.filename.trim()) {
      return 'Filename is required';
    }
    if (!settings.outputPath.trim()) {
      return 'Output path is required';
    }
    if (tracks.length === 0 || tracks.every(track => track.clips.length === 0)) {
      return 'No clips in timeline to export';
    }
    return null;
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateSettings();
    if (error) {
      setValidationError(error);
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Get timeline clips from store and match with media clips
      const timelineClips = tracks.flatMap(track => 
        track.clips.map(timelineClip => {
          // Find the corresponding media clip
          const mediaClip = mediaClips.find(media => media.id === timelineClip.mediaClipId);
          if (!mediaClip) {
            throw new Error(`Media clip not found for timeline clip ${timelineClip.id}`);
          }
          
          return {
            file_path: mediaClip.filepath,
            start_time: timelineClip.startTime,
            duration: timelineClip.duration,
            trim_start: timelineClip.trimStart,
            trim_end: timelineClip.trimEnd,
            track_id: track.id
          };
        })
      );
      
      // Prepare export request
      const exportRequest = {
        timeline_clips: timelineClips,
        output_path: settings.outputPath,
        filename: settings.filename,
        settings: {
          resolution: settings.resolution,
          quality: settings.quality,
          format: settings.format,
          codec: settings.codec
        }
      };
      
      // Start export in store
      startExport(settings);
      showProgress();
      
      // Start export process
      await invoke('export_timeline_with_progress', { request: exportRequest });
      
      // Export started successfully - close dialog
      // The progress component will handle completion via the progress events
      onExportStart?.();
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      setValidationError(`Export failed: ${error}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <div className="export-dialog-header">
          <h2>Export Video</h2>
          <button 
            className="export-dialog-close" 
            onClick={handleCancel}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <form className="export-dialog-content" onSubmit={handleExport}>
          {/* Filename Input */}
          <div className="export-field">
            <label htmlFor="filename">Filename</label>
            <input
              id="filename"
              type="text"
              value={settings.filename}
              onChange={(e) => handleFilenameChange(e.target.value)}
              placeholder="Enter filename (without extension)"
              className="export-input"
              disabled={isValidating}
            />
          </div>

          {/* Output Path Selection */}
          <div className="export-field">
            <label htmlFor="outputPath">Output Location</label>
            <div className="export-path-group">
              <input
                id="outputPath"
                type="text"
                value={settings.outputPath}
                onChange={(e) => handleOutputPathChange(e.target.value)}
                placeholder="Select output folder"
                className="export-input"
                disabled={isValidating}
              />
              <button
                type="button"
                onClick={handleSelectOutputPath}
                className="export-path-button"
                disabled={isValidating}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Resolution Selection */}
          <div className="export-field">
            <label>Resolution</label>
            <select
              value={settings.resolution}
              onChange={(e) => handleResolutionChange(e.target.value as ExportResolution)}
              disabled={isValidating}
              className="export-select"
            >
              <option value="source">Source Resolution</option>
              <option value="1080p">1080p (1920x1080)</option>
              <option value="720p">720p (1280x720)</option>
            </select>
          </div>

          {/* Quality Selection */}
          <div className="export-field">
            <label>Quality</label>
            <select
              value={settings.quality}
              onChange={(e) => handleQualityChange(e.target.value as ExportQuality)}
              disabled={isValidating}
              className="export-select"
            >
              <option value="high">High Quality (Larger file)</option>
              <option value="medium">Medium Quality (Balanced)</option>
              <option value="low">Low Quality (Smaller file)</option>
            </select>
          </div>

          {/* Format Selection */}
          <div className="export-field">
            <label>Format</label>
            <select
              value={settings.format}
              onChange={(e) => handleFormatChange(e.target.value as ExportFormat)}
              disabled={isValidating}
              className="export-select"
            >
              <option value="mp4">MP4 (Most compatible)</option>
              <option value="mov">MOV (QuickTime)</option>
              <option value="avi">AVI (Windows)</option>
            </select>
          </div>

          {/* Codec Selection */}
          <div className="export-field">
            <label>Codec</label>
            <select
              value={settings.codec}
              onChange={(e) => handleCodecChange(e.target.value as ExportCodec)}
              disabled={isValidating}
              className="export-select"
            >
              <option value="h264">H.264 (Most compatible)</option>
              <option value="h265">H.265/HEVC (Better compression)</option>
              <option value="prores">ProRes (Professional)</option>
            </select>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="export-error">
              {validationError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="export-dialog-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="export-button export-button-secondary"
              disabled={isValidating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="export-button export-button-primary"
              disabled={isValidating}
            >
              {isValidating ? 'Starting Export...' : 'Start Export'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportDialog;
