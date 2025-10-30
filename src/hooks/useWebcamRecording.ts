/**
 * useWebcamRecording Hook
 * 
 * Provides webcam access and preview functionality using Web APIs (getUserMedia).
 * This hook handles camera device enumeration, stream management, and preview
 * functionality using native browser APIs.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppError, createAppError } from '@/types';

// ============================================================================
// Hook State Interface
// ============================================================================

interface WebcamState {
  // Stream management
  stream: MediaStream | null;
  isStreamActive: boolean;
  
  // Error state
  error: AppError | null;
  
  // Permission state
  hasPermission: boolean | null; // null = unknown, true = granted, false = denied
}

interface WebcamActions {
  // Stream management
  startPreview: (cameraId: string) => Promise<void>;
  stopPreview: () => void;
  
  // Error handling
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWebcamRecording() {
  // ========================================================================
  // State
  // ========================================================================
  
  const [state, setState] = useState<WebcamState>({
    stream: null,
    isStreamActive: false,
    error: null,
    hasPermission: null,
  });

  // Refs for cleanup
  const streamRef = useRef<MediaStream | null>(null);

  // ========================================================================
  // Cleanup on unmount
  // ========================================================================
  
  useEffect(() => {
    return () => {
      // Stop stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ========================================================================
  // Stream Management
  // ========================================================================
  
  const startPreview = useCallback(async (cameraId: string) => {
    if (!cameraId) {
      const error = createAppError(
        'camera',
        'No camera selected',
        'Please select a camera before starting preview'
      );
      setState(prev => ({ ...prev, error }));
      return;
    }

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser/environment');
      }

      // Request camera access using Web APIs
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // Preview doesn't need audio
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      setState(prev => ({
        ...prev,
        stream: stream,
        isStreamActive: true,
        hasPermission: true,
        error: null,
      }));
    } catch (error) {
      console.error('❌ Failed to start camera preview:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission denied. Please grant camera access in your system settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Camera is already in use by another application.';
        } else {
          errorMessage = error.message;
        }
      }
      
      const appError = createAppError(
        'camera',
        'Failed to start camera preview',
        errorMessage
      );
      
      setState(prev => ({
        ...prev,
        isStreamActive: false,
        hasPermission: false,
        error: appError,
      }));
    }
  }, []);

  const stopPreview = useCallback(() => {
    // Stop all tracks in the current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      stream: null,
      isStreamActive: false,
    }));
  }, []);

  // ========================================================================
  // Error Handling
  // ========================================================================
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // ========================================================================
  // Return hook interface
  // ========================================================================
  
  const actions: WebcamActions = {
    startPreview,
    stopPreview,
    clearError,
  };

  return {
    ...state,
    ...actions,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type { WebcamState, WebcamActions };
