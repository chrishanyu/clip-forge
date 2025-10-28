// ============================================================================
// FILE SIZE FORMATTING UTILITIES
// ============================================================================

/**
 * Format bytes to human-readable file size
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format bytes to compact file size (no decimals for small sizes)
 * @param bytes - Size in bytes
 * @returns Compact formatted file size string
 */
export function formatFileSizeCompact(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'K', 'M', 'G', 'T', 'P'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  
  // No decimals for bytes and KB, 1 decimal for MB+, 2 decimals for GB+
  let decimals = 0;
  if (i >= 2) decimals = 1; // MB+
  if (i >= 3) decimals = 2; // GB+
  
  return parseFloat(size.toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Parse file size string to bytes
 * Supports formats: "1.5 MB", "500 KB", "2 GB", etc.
 * @param sizeString - File size string to parse
 * @returns Size in bytes
 */
export function parseFileSize(sizeString: string): number {
  if (!sizeString || typeof sizeString !== 'string') return 0;
  
  const match = sizeString.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  const multipliers: Record<string, number> = {
    'B': 1,
    'BYTES': 1,
    'K': 1024,
    'KB': 1024,
    'M': 1024 * 1024,
    'MB': 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
  };
  
  const multiplier = multipliers[unit] || 1;
  return value * multiplier;
}

/**
 * Calculate total file size from array of sizes
 * @param sizes - Array of file sizes in bytes
 * @returns Total size in bytes
 */
export function calculateTotalFileSize(sizes: number[]): number {
  return sizes.reduce((total, size) => total + size, 0);
}

/**
 * Calculate average file size from array of sizes
 * @param sizes - Array of file sizes in bytes
 * @returns Average size in bytes
 */
export function calculateAverageFileSize(sizes: number[]): number {
  if (sizes.length === 0) return 0;
  return calculateTotalFileSize(sizes) / sizes.length;
}

/**
 * Get file size category
 * @param bytes - Size in bytes
 * @returns Size category string
 */
export function getFileSizeCategory(bytes: number): string {
  if (bytes < 1024) return 'tiny'; // < 1 KB
  if (bytes < 1024 * 1024) return 'small'; // < 1 MB
  if (bytes < 1024 * 1024 * 100) return 'medium'; // < 100 MB
  if (bytes < 1024 * 1024 * 1024) return 'large'; // < 1 GB
  return 'huge'; // >= 1 GB
}

/**
 * Check if file size is within limits
 * @param bytes - File size in bytes
 * @param maxBytes - Maximum allowed size in bytes
 * @returns True if within limits
 */
export function isFileSizeWithinLimits(bytes: number, maxBytes: number): boolean {
  return bytes <= maxBytes;
}

/**
 * Get file size warning message
 * @param bytes - File size in bytes
 * @param maxBytes - Maximum recommended size in bytes
 * @returns Warning message or null
 */
export function getFileSizeWarning(bytes: number, maxBytes: number): string | null {
  if (bytes > maxBytes) {
    return `File size (${formatFileSize(bytes)}) exceeds recommended limit (${formatFileSize(maxBytes)})`;
  }
  return null;
}

/**
 * Format file size with color coding for UI
 * @param bytes - Size in bytes
 * @returns Object with size string and color class
 */
export function formatFileSizeWithColor(bytes: number): { size: string; colorClass: string } {
  const size = formatFileSizeCompact(bytes);
  const category = getFileSizeCategory(bytes);
  
  const colorClasses: Record<string, string> = {
    tiny: 'text-gray-500',
    small: 'text-green-600',
    medium: 'text-blue-600',
    large: 'text-orange-600',
    huge: 'text-red-600',
  };
  
  return {
    size,
    colorClass: colorClasses[category] || 'text-gray-600',
  };
}
