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
  format: 'mp4';               // Fixed to MP4 for MVP
  codec: 'h264';               // Fixed to H.264 for MVP
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
 * ExportProgress - Real-time export progress tracking
 */
export interface ExportProgress {
  isExporting: boolean;         // Currently exporting
  progress: number;             // Progress percentage (0-100)
  currentStep: string;          // Current operation description
  estimatedTimeRemaining: number; // Seconds remaining (estimate)
  error: string | null;         // Error message if export failed
}
