/**
 * Recording Utilities
 * 
 * Utility functions for webcam recording operations, including MediaRecorder
 * wrapper and recording validation. These utilities support the unified
 * recording approach where actual recording is handled by AVFoundation.
 */

import { AppError, createAppError } from '@/types';

// ============================================================================
// MediaRecorder Wrapper
// ============================================================================

export interface MediaRecorderOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

export interface RecordingChunk {
  data: Blob;
  timestamp: number;
  size: number;
}

export class WebcamRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: RecordingChunk[] = [];
  private isRecording = false;
  private startTime: number = 0;

  constructor(
    private options: MediaRecorderOptions = {}
  ) {}

  /**
   * Initialize the recorder with a media stream
   */
  async initialize(stream: MediaStream): Promise<void> {
    if (!MediaRecorder.isTypeSupported(this.getMimeType())) {
      throw createAppError(
        'recording',
        'Unsupported recording format',
        `MIME type ${this.getMimeType()} is not supported`
      );
    }

    this.stream = stream;
    this.chunks = [];
    this.isRecording = false;

    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getMimeType(),
        videoBitsPerSecond: this.options.videoBitsPerSecond || 2500000, // 2.5 Mbps
        audioBitsPerSecond: this.options.audioBitsPerSecond || 128000,  // 128 kbps
      });

      this.setupEventHandlers();
    } catch (error) {
      throw createAppError(
        'recording',
        'Failed to initialize MediaRecorder',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Start recording
   */
  start(): void {
    if (!this.mediaRecorder || this.isRecording) {
      throw createAppError(
        'recording',
        'Cannot start recording',
        'Recorder not initialized or already recording'
      );
    }

    this.chunks = [];
    this.startTime = Date.now();
    this.isRecording = true;
    this.mediaRecorder.start(1000); // Collect data every second
  }

  /**
   * Stop recording and return the recorded data
   */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(createAppError(
          'recording',
          'Cannot stop recording',
          'No active recording to stop'
        ));
        return;
      }

      const handleStop = () => {
        this.isRecording = false;
        const blob = new Blob(this.chunks.map(chunk => chunk.data), {
          type: this.getMimeType()
        });
        resolve(blob);
      };

      const handleError = () => {
        this.isRecording = false;
        reject(createAppError(
          'recording',
          'Recording failed',
          'MediaRecorder encountered an error'
        ));
      };

      this.mediaRecorder.addEventListener('stop', handleStop, { once: true });
      this.mediaRecorder.addEventListener('error', handleError, { once: true });
      
      // Request any pending data before stopping
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }
      
      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (!this.mediaRecorder || !this.isRecording) {
      throw createAppError(
        'recording',
        'Cannot pause recording',
        'No active recording to pause'
      );
    }

    this.mediaRecorder.pause();
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (!this.mediaRecorder || this.isRecording) {
      throw createAppError(
        'recording',
        'Cannot resume recording',
        'No active recording to resume'
      );
    }

    this.mediaRecorder.resume();
  }

  /**
   * Get recording duration in milliseconds
   */
  getDuration(): number {
    return this.isRecording ? Date.now() - this.startTime : 0;
  }

  /**
   * Get total size of recorded data in bytes
   */
  getDataSize(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Stop recording if active
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    
    // Remove event listeners
    if (this.mediaRecorder) {
      this.mediaRecorder.removeEventListener('dataavailable', this.handleDataAvailable);
      this.mediaRecorder.removeEventListener('error', this.handleError);
      this.mediaRecorder = null;
    }

    // Stop all stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    this.chunks = [];
    this.isRecording = false;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getMimeType(): string {
    return this.options.mimeType || this.getBestSupportedMimeType();
  }

  private getBestSupportedMimeType(): string {
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return 'video/webm'; // Fallback
  }

  private setupEventHandlers(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.addEventListener('dataavailable', this.handleDataAvailable);
    this.mediaRecorder.addEventListener('error', this.handleError);
  }

  private handleDataAvailable = (event: BlobEvent): void => {
    if (event.data && event.data.size > 0) {
      this.chunks.push({
        data: event.data,
        timestamp: Date.now(),
        size: event.data.size,
      });
    }
  };

  private handleError = (event: Event): void => {
    this.isRecording = false;
  };
}

// ============================================================================
// Recording Validation Utilities
// ============================================================================

/**
 * Validate recording constraints
 */
export function validateRecordingConstraints(constraints: MediaStreamConstraints): AppError | null {
  if (!constraints.video && !constraints.audio) {
    return createAppError(
      'validation',
      'Invalid recording constraints',
      'At least video or audio must be enabled'
    );
  }

  if (constraints.video && typeof constraints.video === 'object') {
    const videoConstraints = constraints.video as MediaTrackConstraints;
    
    if (videoConstraints.width && (videoConstraints.width as number) <= 0) {
      return createAppError(
        'validation',
        'Invalid video width',
        'Video width must be greater than 0'
      );
    }

    if (videoConstraints.height && (videoConstraints.height as number) <= 0) {
      return createAppError(
        'validation',
        'Invalid video height',
        'Video height must be greater than 0'
      );
    }

    if (videoConstraints.frameRate && (videoConstraints.frameRate as number) <= 0) {
      return createAppError(
        'validation',
        'Invalid frame rate',
        'Frame rate must be greater than 0'
      );
    }
  }

  return null;
}

/**
 * Get optimal recording constraints for webcam
 */
export function getOptimalWebcamConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
}

/**
 * Check if MediaRecorder is supported
 */
export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
}

/**
 * Get supported MIME types for recording
 */
export function getSupportedMimeTypes(): string[] {
  if (!isMediaRecorderSupported()) return [];

  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];

  return mimeTypes.filter(mimeType => MediaRecorder.isTypeSupported(mimeType));
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
