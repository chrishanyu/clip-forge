import { v4 as uuidv4 } from 'uuid';
import { VideoMetadata } from './video';

/**
 * MediaClip - The source video file (immutable after import)
 * Think of this as the "source image file" in Photoshop
 */
export interface MediaClip {
  id: string;                    // UUID - unique identifier
  filepath: string;              // Full path to video file
  filename: string;              // Just the filename (e.g., "vacation.mp4")
  metadata: VideoMetadata;       // Video properties
  createdAt: string;            // ISO timestamp when imported
}

/**
 * Create a new MediaClip with generated ID and timestamp
 */
export function createMediaClip(
  filepath: string,
  filename: string,
  metadata: VideoMetadata
): MediaClip {
  return {
    id: uuidv4(),
    filepath,
    filename,
    metadata,
    createdAt: new Date().toISOString(),
  };
}
