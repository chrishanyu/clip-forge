// ============================================================================
// VIDEO CALCULATION UTILITIES
// ============================================================================

import { VideoMetadata } from '@/types';

/**
 * Calculate video aspect ratio
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @returns Aspect ratio as decimal (e.g., 1.777 for 16:9)
 */
export function calculateAspectRatio(width: number, height: number): number {
  if (height === 0) return 0;
  return width / height;
}

/**
 * Get common aspect ratio name
 * @param aspectRatio - Aspect ratio as decimal
 * @returns Aspect ratio name (e.g., "16:9", "4:3", "1:1")
 */
export function getAspectRatioName(aspectRatio: number): string {
  const commonRatios: Array<{ ratio: number; name: string }> = [
    { ratio: 16/9, name: '16:9' },
    { ratio: 4/3, name: '4:3' },
    { ratio: 1, name: '1:1' },
    { ratio: 21/9, name: '21:9' },
    { ratio: 3/2, name: '3:2' },
    { ratio: 5/4, name: '5:4' },
  ];
  
  const tolerance = 0.01;
  for (const { ratio, name } of commonRatios) {
    if (Math.abs(aspectRatio - ratio) < tolerance) {
      return name;
    }
  }
  
  // Return custom ratio
  return `${Math.round(aspectRatio * 100)}:100`;
}

/**
 * Calculate video bitrate from file size and duration
 * @param fileSizeBytes - File size in bytes
 * @param durationSeconds - Duration in seconds
 * @returns Bitrate in bits per second
 */
export function calculateBitrate(fileSizeBytes: number, durationSeconds: number): number {
  if (durationSeconds === 0) return 0;
  return (fileSizeBytes * 8) / durationSeconds;
}

/**
 * Format bitrate for display
 * @param bitrate - Bitrate in bits per second
 * @returns Formatted bitrate string
 */
export function formatBitrate(bitrate: number): string {
  if (bitrate < 1000) return `${Math.round(bitrate)} bps`;
  if (bitrate < 1000000) return `${Math.round(bitrate / 1000)} Kbps`;
  if (bitrate < 1000000000) return `${Math.round(bitrate / 1000000)} Mbps`;
  return `${Math.round(bitrate / 1000000000)} Gbps`;
}

/**
 * Calculate video resolution category
 * @param width - Video width
 * @param height - Video height
 * @returns Resolution category
 */
export function getResolutionCategory(width: number, height: number): string {
  const pixels = width * height;
  
  if (pixels <= 480 * 360) return 'SD'; // Standard Definition
  if (pixels <= 1280 * 720) return 'HD'; // High Definition
  if (pixels <= 1920 * 1080) return 'FHD'; // Full HD
  if (pixels <= 2560 * 1440) return 'QHD'; // Quad HD
  if (pixels <= 3840 * 2160) return '4K'; // 4K UHD
  return '8K+'; // 8K and above
}

/**
 * Get resolution name
 * @param width - Video width
 * @param height - Video height
 * @returns Resolution name (e.g., "1080p", "720p", "4K")
 */
export function getResolutionName(width: number, height: number): string {
  const commonResolutions: Array<{ width: number; height: number; name: string }> = [
    { width: 1920, height: 1080, name: '1080p' },
    { width: 1280, height: 720, name: '720p' },
    { width: 854, height: 480, name: '480p' },
    { width: 640, height: 360, name: '360p' },
    { width: 3840, height: 2160, name: '4K' },
    { width: 2560, height: 1440, name: '1440p' },
    { width: 7680, height: 4320, name: '8K' },
  ];
  
  for (const res of commonResolutions) {
    if (width === res.width && height === res.height) {
      return res.name;
    }
  }
  
  return `${width}x${height}`;
}

/**
 * Calculate video quality score (0-100)
 * @param metadata - Video metadata
 * @returns Quality score
 */
export function calculateQualityScore(metadata: VideoMetadata): number {
  let score = 0;
  
  // Resolution score (0-40 points)
  const pixels = metadata.width * metadata.height;
  if (pixels >= 3840 * 2160) score += 40; // 4K
  else if (pixels >= 1920 * 1080) score += 35; // 1080p
  else if (pixels >= 1280 * 720) score += 25; // 720p
  else if (pixels >= 854 * 480) score += 15; // 480p
  else score += 5; // Lower
  
  // Frame rate score (0-30 points)
  if (metadata.fps >= 60) score += 30;
  else if (metadata.fps >= 30) score += 25;
  else if (metadata.fps >= 24) score += 20;
  else if (metadata.fps >= 15) score += 10;
  else score += 5;
  
  // Codec score (0-20 points)
  const codec = metadata.codec.toLowerCase();
  if (codec.includes('h265') || codec.includes('hevc')) score += 20;
  else if (codec.includes('h264')) score += 15;
  else if (codec.includes('vp9')) score += 18;
  else if (codec.includes('av1')) score += 20;
  else score += 10;
  
  // Bitrate score (0-10 points) - estimated from file size
  const estimatedBitrate = calculateBitrate(metadata.fileSize, metadata.duration);
  if (estimatedBitrate > 10000000) score += 10; // > 10 Mbps
  else if (estimatedBitrate > 5000000) score += 8; // > 5 Mbps
  else if (estimatedBitrate > 2000000) score += 6; // > 2 Mbps
  else if (estimatedBitrate > 1000000) score += 4; // > 1 Mbps
  else score += 2;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Get quality level from score
 * @param score - Quality score (0-100)
 * @returns Quality level
 */
export function getQualityLevel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Very Poor';
}

/**
 * Calculate video compression ratio
 * @param originalSize - Original file size in bytes
 * @param compressedSize - Compressed file size in bytes
 * @returns Compression ratio (e.g., 0.5 for 50% compression)
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return compressedSize / originalSize;
}

/**
 * Estimate export file size
 * @param duration - Video duration in seconds
 * @param resolution - Target resolution
 * @param quality - Export quality setting
 * @returns Estimated file size in bytes
 */
export function estimateExportFileSize(
  duration: number,
  resolution: 'source' | '1080p' | '720p',
  quality: 'high' | 'medium' | 'low'
): number {
  // Base bitrate estimates (in bits per second)
  const baseBitrates: Record<string, Record<string, number>> = {
    '1080p': { high: 8000000, medium: 5000000, low: 3000000 },
    '720p': { high: 5000000, medium: 3000000, low: 2000000 },
    '480p': { high: 2000000, medium: 1500000, low: 1000000 },
  };
  
  let targetResolution = resolution;
  if (resolution === 'source') {
    // Assume source is 1080p for estimation
    targetResolution = '1080p';
  }
  
  const bitrate = baseBitrates[targetResolution]?.[quality] || 3000000;
  return (bitrate * duration) / 8; // Convert to bytes
}

/**
 * Calculate video processing time estimate
 * @param duration - Video duration in seconds
 * @param resolution - Target resolution
 * @param quality - Export quality setting
 * @returns Estimated processing time in seconds
 */
export function estimateProcessingTime(
  duration: number,
  resolution: 'source' | '1080p' | '720p',
  quality: 'high' | 'medium' | 'low'
): number {
  // Base processing speed (real-time multiplier)
  const speedMultipliers: Record<string, Record<string, number>> = {
    '1080p': { high: 0.3, medium: 0.2, low: 0.15 },
    '720p': { high: 0.2, medium: 0.15, low: 0.1 },
    '480p': { high: 0.15, medium: 0.1, low: 0.08 },
  };
  
  let targetResolution = resolution;
  if (resolution === 'source') {
    targetResolution = '1080p';
  }
  
  const multiplier = speedMultipliers[targetResolution]?.[quality] || 0.2;
  return duration * multiplier;
}

/**
 * Validate video metadata
 * @param metadata - Video metadata to validate
 * @returns Array of validation errors
 */
export function validateVideoMetadata(metadata: VideoMetadata): string[] {
  const errors: string[] = [];
  
  if (metadata.duration <= 0) {
    errors.push('Duration must be greater than 0');
  }
  
  if (metadata.width <= 0 || metadata.height <= 0) {
    errors.push('Width and height must be greater than 0');
  }
  
  if (metadata.fps <= 0) {
    errors.push('Frame rate must be greater than 0');
  }
  
  if (metadata.fileSize <= 0) {
    errors.push('File size must be greater than 0');
  }
  
  if (!metadata.filename || metadata.filename.trim() === '') {
    errors.push('Filename is required');
  }
  
  if (!metadata.filepath || metadata.filepath.trim() === '') {
    errors.push('File path is required');
  }
  
  return errors;
}

/**
 * Get video format compatibility info
 * @param container - Video container format
 * @param codec - Video codec
 * @returns Compatibility information
 */
export function getVideoCompatibility(container: string, codec: string): {
  isSupported: boolean;
  warning?: string;
  recommendation?: string;
} {
  const supportedContainers = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const supportedCodecs = ['h264', 'h265', 'hevc', 'vp9', 'av1'];
  
  const containerLower = container.toLowerCase();
  const codecLower = codec.toLowerCase();
  
  if (!supportedContainers.includes(containerLower)) {
    return {
      isSupported: false,
      warning: `Container format '${container}' may not be fully supported`,
      recommendation: 'Consider converting to MP4 for better compatibility',
    };
  }
  
  if (!supportedCodecs.includes(codecLower)) {
    return {
      isSupported: false,
      warning: `Codec '${codec}' may not be fully supported`,
      recommendation: 'Consider converting to H.264 for better compatibility',
    };
  }
  
  return { isSupported: true };
}
