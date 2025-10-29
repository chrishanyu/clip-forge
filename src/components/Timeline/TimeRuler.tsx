import React, { useMemo } from 'react';
import './TimeRuler.css';

// ============================================================================
// TIME RULER COMPONENT INTERFACE
// ============================================================================

export interface TimeRulerProps {
  pixelsPerSecond: number;
  timelineDuration: number;
  onTimeClick?: (time: number) => void;
  className?: string;
}

// ============================================================================
// TIME RULER COMPONENT
// ============================================================================

export const TimeRuler: React.FC<TimeRulerProps> = ({
  pixelsPerSecond,
  timelineDuration,
  onTimeClick,
  className = ''
}) => {
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Format time for display
   */
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else if (remainingSeconds > 0) {
      return `${remainingSeconds}.${Math.floor(milliseconds / 100)}`;
    } else {
      return `0.${Math.floor(milliseconds / 100)}`;
    }
  };

  // ============================================================================
  // TIME MARKER CALCULATIONS
  // ============================================================================

  /**
   * Generate time markers based on zoom level
   */
  const timeMarkers = useMemo(() => {
    const markers: Array<{
      time: number;
      x: number;
      label: string;
      isMajor: boolean;
    }> = [];

    // Calculate appropriate time intervals based on zoom level
    let interval: number;
    let majorInterval: number;

    if (pixelsPerSecond < 20) {
      // Very zoomed out - show minutes
      interval = 60; // 1 minute
      majorInterval = 300; // 5 minutes
    } else if (pixelsPerSecond < 50) {
      // Zoomed out - show 30 seconds
      interval = 30;
      majorInterval = 120; // 2 minutes
    } else if (pixelsPerSecond < 100) {
      // Normal zoom - show 10 seconds
      interval = 10;
      majorInterval = 60; // 1 minute
    } else if (pixelsPerSecond < 200) {
      // Zoomed in - show 5 seconds
      interval = 5;
      majorInterval = 30; // 30 seconds
    } else if (pixelsPerSecond < 500) {
      // Very zoomed in - show 1 second
      interval = 1;
      majorInterval = 10; // 10 seconds
    } else {
      // Extremely zoomed in - show 0.5 seconds
      interval = 0.5;
      majorInterval = 5; // 5 seconds
    }

    // Generate markers based on actual timeline duration
    for (let time = 0; time <= timelineDuration; time += interval) {
      const x = time * pixelsPerSecond;
      const isMajor = time % majorInterval === 0;
      const label = formatTime(time);
      
      markers.push({
        time,
        x,
        label,
        isMajor
      });
    }

    return markers;
  }, [pixelsPerSecond, timelineDuration, formatTime]);

  /**
   * Handle time ruler click
   */
  const handleTimeClick = (event: React.MouseEvent, time: number) => {
    event.stopPropagation();
    onTimeClick?.(time);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`time-ruler ${className}`}>
      <div className="time-ruler-content">
        {timeMarkers.map((marker, index) => (
          <div
            key={index}
            className={`time-marker ${marker.isMajor ? 'major' : 'minor'}`}
            style={{
              left: `${marker.x}px`,
            }}
            onClick={(e) => handleTimeClick(e, marker.time)}
          >
            <div className="time-tick" />
            {marker.isMajor && (
              <div className="time-label">
                {marker.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TimeRuler;
