/**
 * VideoMetadata - Essential video file information
 * Extracted by FFmpeg during import
 */
export interface VideoMetadata {
  // Playback essentials (CRITICAL)
  duration: number;             // Total duration in seconds
  width: number;                // Video width in pixels
  height: number;               // Video height in pixels
  fps: number;                  // Frames per second
  
  // File info (CRITICAL)
  filepath: string;             // Full path to video file
  filename: string;             // Just the filename
  fileSize: number;             // File size in bytes
  
  // Format info (IMPORTANT)
  codec: string;                // Video codec (e.g., "h264", "hevc")
  container: string;            // Container format (e.g., "mp4", "mov", "webm")
  
  // Thumbnail (CRITICAL for UI)
  thumbnailPath: string;        // Path to generated thumbnail image
  
  // Housekeeping (NICE to have)
  createdAt: string;           // ISO timestamp when metadata extracted
}

/**
 * Factory function to create VideoMetadata
 */
export function createVideoMetadata(metadata: Omit<VideoMetadata, 'createdAt'>): VideoMetadata {
  return {
    ...metadata,
    createdAt: new Date().toISOString(),
  };
}
