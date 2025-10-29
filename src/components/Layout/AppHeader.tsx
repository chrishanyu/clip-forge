import React, { useState } from 'react';
import { useTimelineStore } from '@/stores/timelineStore';
import { useExportStore } from '@/stores/exportStore';
import { ExportDialog, ExportProgress } from '@/components/Export';
import './AppHeader.css';

// ============================================================================
// APP HEADER COMPONENT
// ============================================================================

interface AppHeaderProps {
  // No props needed for now, but keeping interface for future extensibility
}

export type { AppHeaderProps };

export const AppHeader: React.FC<AppHeaderProps> = () => {
  const { tracks, getTimelineDuration } = useTimelineStore();
  const { isProgressVisible, hideProgress } = useExportStore();
  const [showExportDialog, setShowExportDialog] = useState(false);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleExportClick = () => {
    // Validate timeline before showing dialog
    if (!canExport()) {
      return;
    }
    setShowExportDialog(true);
  };

  const handleExportStart = () => {
    // The export dialog will handle the settings internally
    setShowExportDialog(false);
  };

  const handleExportClose = () => {
    setShowExportDialog(false);
  };

  const handleProgressClose = () => {
    hideProgress();
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const canExport = (): boolean => {
    // Check if there are any clips in the timeline
    const hasClips = tracks.some(track => track.clips.length > 0);
    return hasClips;
  };

  const getTimelineInfo = () => {
    const totalClips = tracks.reduce((sum, track) => sum + track.clips.length, 0);
    const duration = getTimelineDuration();
    return { totalClips, duration };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const { totalClips, duration } = getTimelineInfo();
  const canExportTimeline = canExport();

  return (
    <>
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">
            <span className="app-logo-icon">🎬</span>
            <span className="app-logo-text">ClipForge</span>
          </div>
        </div>

        <div className="app-header-center">
          <div className="timeline-info">
            <span className="timeline-info-item">
              <span className="timeline-info-label">Clips:</span>
              <span className="timeline-info-value">{totalClips}</span>
            </span>
            <span className="timeline-info-item">
              <span className="timeline-info-label">Duration:</span>
              <span className="timeline-info-value">
                {duration > 0 ? `${duration.toFixed(1)}s` : '0s'}
              </span>
            </span>
          </div>
        </div>

        <div className="app-header-right">
          <button
            className={`export-button ${!canExportTimeline ? 'export-button-disabled' : ''}`}
            onClick={handleExportClick}
            disabled={!canExportTimeline}
            title={canExportTimeline ? 'Export video' : 'Add clips to timeline to export'}
          >
            <span className="export-button-icon">📤</span>
            <span className="export-button-text">Export</span>
          </button>
        </div>
      </header>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={handleExportClose}
        onExportStart={handleExportStart}
      />

      {/* Export Progress */}
      <ExportProgress
        isVisible={isProgressVisible}
        onClose={handleProgressClose}
      />
    </>
  );
};

export default AppHeader;
