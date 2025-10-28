import { v4 as uuidv4 } from 'uuid';

/**
 * AppError - Standardized error interface
 */
export interface AppError {
  id: string;                   // UUID - unique error identifier
  type: ErrorType;              // Category of error
  message: string;               // User-friendly error message
  details?: string;              // Technical details for debugging
  timestamp: string;            // ISO timestamp when error occurred
  context?: Record<string, any>; // Additional context data
}

/**
 * ErrorType - Categories of errors
 */
export type ErrorType = 
  | 'import'                    // Video import errors
  | 'export'                    // Video export errors
  | 'ffmpeg'                    // FFmpeg execution errors
  | 'file'                      // File system errors
  | 'validation'                // Input validation errors
  | 'network'                   // Network-related errors
  | 'unknown';                   // Catch-all for unexpected errors

/**
 * Create a new AppError with generated ID and timestamp
 */
export function createAppError(
  type: ErrorType,
  message: string,
  details?: string,
  context?: Record<string, any>
): AppError {
  return {
    id: uuidv4(),
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
    context,
  };
}
