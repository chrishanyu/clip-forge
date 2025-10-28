// ============================================================================
// RE-EXPORTS FROM SEPARATE MODULES
// ============================================================================

// Media types
export type { MediaClip } from './media';
export { createMediaClip } from './media';

// Timeline types
export type { TimelineClip, TimelineTrack } from './timeline';
export { createTimelineClip, createTimelineTrack } from './timeline';

// Video types
export type { VideoMetadata } from './video';

// Export types
export type { 
  ExportSettings, 
  ExportResolution, 
  ExportQuality, 
  ExportProgress 
} from './export';

// Error types
export type { AppError, ErrorType } from './error';
export { createAppError } from './error';

// Common utility types
export type { TimeRange, Dimensions, Position } from './common';
