// ============================================================================
// STORE RE-EXPORTS
// ============================================================================

// Media store
export { useMediaStore } from './mediaStore';
export type { MediaStore } from './mediaStore';

// Timeline store
export { useTimelineStore } from './timelineStore';
export type { TimelineStore } from './timelineStore';

// Export store
export { useExportStore } from './exportStore';
export type { ExportStore } from './exportStore';

// Recording store
export { 
  useRecordingStore,
  useRecordingSession,
  useRecordingDevices,
  useRecordingSettings,
  useRecordingProgress,
  useRecordingError,
  useIsRecordingActive,
  useCanStartRecording,
  useCanStopRecording,
  useIsDialogOpen,
  useIsRecordingIndicatorVisible,
  useRecordingDuration,
  useRecordingFileSize,
  useAvailableScreens,
  useAvailableCameras,
  useIsDevicesLoading,
  useSelectedScreen,
  useSelectedCamera
} from './recordingStore';
export type { RecordingStore } from './recordingStore';

// Project store
export { useProjectStore } from './projectStore';
export type { ProjectStore } from './projectStore';

// Toast store
export { useToastStore } from './toastStore';
export type { ToastStore } from './toastStore';
