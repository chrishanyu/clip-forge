// ============================================================================
// FILE VALIDATION UTILITIES
// ============================================================================

/**
 * Valid video file extensions
 */
export const VALID_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];

/**
 * Check if a file path has a valid video extension
 */
export const isValidVideoFile = (filePath: string): boolean => {
  const fileName = filePath.toLowerCase();
  return VALID_VIDEO_EXTENSIONS.some(ext => fileName.endsWith(ext));
};

/**
 * Check if a File object has a valid video extension
 */
export const isValidVideoFileObject = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  return VALID_VIDEO_EXTENSIONS.some(ext => fileName.endsWith(ext));
};

/**
 * Filter an array of file paths to only include valid video files
 */
export const filterValidVideoFiles = (filePaths: string[]): string[] => {
  return filePaths.filter(isValidVideoFile);
};

/**
 * Filter an array of File objects to only include valid video files
 */
export const filterValidVideoFileObjects = (files: File[]): File[] => {
  return files.filter(isValidVideoFileObject);
};

/**
 * Get file extension from a file path
 */
export const getFileExtension = (filePath: string): string => {
  const lastDotIndex = filePath.lastIndexOf('.');
  return lastDotIndex !== -1 ? filePath.substring(lastDotIndex).toLowerCase() : '';
};

/**
 * Get filename without extension from a file path
 */
export const getFilenameWithoutExtension = (filePath: string): string => {
  const lastSlashIndex = filePath.lastIndexOf('/');
  const lastDotIndex = filePath.lastIndexOf('.');
  const startIndex = lastSlashIndex !== -1 ? lastSlashIndex + 1 : 0;
  const endIndex = lastDotIndex !== -1 ? lastDotIndex : filePath.length;
  return filePath.substring(startIndex, endIndex);
};
