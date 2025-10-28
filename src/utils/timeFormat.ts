// ============================================================================
// TIME FORMATTING UTILITIES
// ============================================================================

/**
 * Format seconds to HH:MM:SS.mmm format
 * @param seconds - Time in seconds (can be decimal)
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '00:00:00.000';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format seconds to MM:SS format (for shorter durations)
 * @param seconds - Time in seconds (can be decimal)
 * @returns Formatted time string
 */
export function formatTimeShort(seconds: number): string {
  if (seconds < 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to human-readable duration
 * @param seconds - Time in seconds (can be decimal)
 * @returns Human-readable duration string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0 seconds';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
}

/**
 * Parse time string to seconds
 * Supports formats: HH:MM:SS, MM:SS, SS
 * @param timeString - Time string to parse
 * @returns Seconds as number
 */
export function parseTime(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const parts = timeString.split(':').map(part => parseFloat(part.trim()));
  
  if (parts.length === 1) {
    // SS format
    return parts[0] || 0;
  } else if (parts.length === 2) {
    // MM:SS format
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  
  return 0;
}

/**
 * Convert time to pixels based on zoom level
 * @param time - Time in seconds
 * @param pixelsPerSecond - Pixels per second (zoom level)
 * @returns Pixel position
 */
export function timeToPixels(time: number, pixelsPerSecond: number): number {
  return time * pixelsPerSecond;
}

/**
 * Convert pixels to time based on zoom level
 * @param pixels - Pixel position
 * @param pixelsPerSecond - Pixels per second (zoom level)
 * @returns Time in seconds
 */
export function pixelsToTime(pixels: number, pixelsPerSecond: number): number {
  return pixels / pixelsPerSecond;
}

/**
 * Snap time to grid
 * @param time - Time in seconds
 * @param gridSize - Grid size in seconds (e.g., 0.1 for 100ms grid)
 * @returns Snapped time
 */
export function snapToGrid(time: number, gridSize: number): number {
  return Math.round(time / gridSize) * gridSize;
}

/**
 * Calculate time range duration
 * @param start - Start time in seconds
 * @param end - End time in seconds
 * @returns Duration in seconds
 */
export function calculateDuration(start: number, end: number): number {
  return Math.max(0, end - start);
}

/**
 * Check if time is within range
 * @param time - Time to check
 * @param start - Range start
 * @param end - Range end
 * @returns True if time is within range
 */
export function isTimeInRange(time: number, start: number, end: number): boolean {
  return time >= start && time <= end;
}

/**
 * Clamp time to valid range
 * @param time - Time to clamp
 * @param min - Minimum time
 * @param max - Maximum time
 * @returns Clamped time
 */
export function clampTime(time: number, min: number, max: number): number {
  return Math.max(min, Math.min(time, max));
}
