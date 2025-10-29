/**
 * ExportSettings - Configuration for video export
 * Basic options for MVP
 */
export interface ExportSettings {
  // Output configuration
  outputPath: string;           // Where to save the exported video
  filename: string;             // Output filename (without extension)
  
  // Video settings
  resolution: ExportResolution; // Output resolution
  quality: ExportQuality;       // Quality preset
  
  // Format
  format: ExportFormat;        // Output format
  codec: ExportCodec;          // Video codec
}

/**
 * ExportResolution - Available resolution options
 */
export type ExportResolution = 
  | 'source'                    // Keep original resolution
  | '1080p'                     // 1920x1080
  | '720p';                     // 1280x720

/**
 * ExportQuality - Quality presets
 */
export type ExportQuality = 
  | 'high'                      // High quality (larger file)
  | 'medium'                    // Balanced quality/size
  | 'low';                      // Lower quality (smaller file)

/**
 * ExportFormat - Available output formats
 */
export type ExportFormat = 
  | 'mp4'                       // MP4 container
  | 'mov'                       // QuickTime MOV
  | 'avi';                      // AVI container

/**
 * ExportCodec - Available video codecs
 */
export type ExportCodec = 
  | 'h264'                      // H.264 (most compatible)
  | 'h265'                      // H.265/HEVC (better compression)
  | 'prores';                   // ProRes (professional)

/**
 * ExportProgress - Real-time export progress tracking
 */
export interface ExportProgress {
  progress: number;             // Progress percentage (0-100)
  current_step: string;         // Current operation description
  estimated_time_remaining: number; // Seconds remaining (estimate)
  error: string | null;         // Error message if export failed
  current_frame?: number;       // Current frame being processed
  total_frames?: number;        // Total frames to process
  fps?: number;                 // Current processing FPS
  bitrate?: number;             // Current bitrate (kbps)
  time?: string;                // Current time position (HH:MM:SS.mm)
}
