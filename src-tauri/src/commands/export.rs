// ============================================================================
// EXPORT COMMANDS
// ============================================================================
// This module provides Tauri commands for video export operations,
// acting as a bridge between the frontend and the FFmpeg export module.

use crate::commands::{CommandError, CommandResult};
use crate::ffmpeg::export::{
    estimate_export_size, estimate_export_time, export_video, export_video_with_progress,
    validate_export_settings, ExportClip, ExportSettings, ExportVideoRequest, ExportVideoResponse,
};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Request to export timeline to video
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportTimelineRequest {
    pub timeline_clips: Vec<TimelineExportClip>,
    pub output_path: String,
    pub filename: String,
    pub settings: ExportSettings,
}

/// Timeline clip for export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineExportClip {
    pub file_path: String,
    pub start_time: f64,  // Start time in timeline
    pub duration: f64,    // Duration in timeline
    pub trim_start: f64,  // Trim start in source video
    pub trim_end: f64,    // Trim end in source video
    pub track_id: String, // Track ID (for future use)
}

/// Export progress update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgressUpdate {
    pub progress: f64,
    pub current_step: String,
    pub estimated_time_remaining: f64,
    pub error: Option<String>,
}

/// Export status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportStatus {
    Preparing,
    Exporting,
    Completed,
    Failed,
    Cancelled,
}

/// Export job information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportJob {
    pub id: String,
    pub status: ExportStatus,
    pub progress: f64,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Export timeline to video file
#[tauri::command]
pub async fn export_timeline(
    app_handle: tauri::AppHandle,
    request: ExportTimelineRequest,
) -> CommandResult<ExportVideoResponse> {
    // Validate export settings
    validate_export_settings(&request.settings)?;

    // Convert timeline clips to export clips
    let export_clips: Vec<ExportClip> = request
        .timeline_clips
        .into_iter()
        .map(|clip| ExportClip {
            file_path: clip.file_path,
            start_time: clip.start_time,
            duration: clip.duration,
            trim_start: clip.trim_start,
            trim_end: clip.trim_end,
            track_id: clip.track_id,
            trimmed_file_path: None, // Will be set during trimming process
        })
        .collect();

    // Create export request
    let export_request = ExportVideoRequest {
        clips: export_clips,
        output_path: request.output_path,
        settings: request.settings,
    };

    // Execute export
    export_video(app_handle, export_request).await
}

/// Export timeline with progress tracking
#[tauri::command]
pub async fn export_timeline_with_progress(
    app_handle: tauri::AppHandle,
    request: ExportTimelineRequest,
) -> CommandResult<ExportVideoResponse> {
    // Validate export settings
    validate_export_settings(&request.settings)?;

    // Convert timeline clips to export clips
    let export_clips: Vec<ExportClip> = request
        .timeline_clips
        .into_iter()
        .map(|clip| ExportClip {
            file_path: clip.file_path,
            start_time: clip.start_time,
            duration: clip.duration,
            trim_start: clip.trim_start,
            trim_end: clip.trim_end,
            track_id: clip.track_id,
            trimmed_file_path: None, // Will be set during trimming process
        })
        .collect();

    // Create full output path by combining directory and filename
    let filename = if request.filename.ends_with(".mp4") {
        request.filename
    } else {
        format!("{}.mp4", request.filename)
    };
    let full_output_path = std::path::Path::new(&request.output_path)
        .join(&filename)
        .to_string_lossy()
        .to_string();

    // Create export request
    let export_request = ExportVideoRequest {
        clips: export_clips,
        output_path: full_output_path,
        settings: request.settings,
    };

    // Execute export with progress tracking
    export_video_with_progress(app_handle, export_request).await
}

/// Estimate export time and file size
#[tauri::command]
pub async fn estimate_export_info(request: ExportTimelineRequest) -> CommandResult<ExportEstimate> {
    // Convert timeline clips to export clips
    let export_clips: Vec<ExportClip> = request
        .timeline_clips
        .into_iter()
        .map(|clip| ExportClip {
            file_path: clip.file_path,
            start_time: clip.start_time,
            duration: clip.duration,
            trim_start: clip.trim_start,
            trim_end: clip.trim_end,
            track_id: clip.track_id,
            trimmed_file_path: None, // Will be set during trimming process
        })
        .collect();

    // Calculate estimates
    let estimated_time = estimate_export_time(&export_clips, &request.settings);
    let estimated_size = estimate_export_size(&export_clips, &request.settings);
    let total_duration: f64 = export_clips.iter().map(|clip| clip.duration).sum();

    Ok(ExportEstimate {
        estimated_time_seconds: estimated_time,
        estimated_file_size_bytes: estimated_size,
        total_duration_seconds: total_duration,
        clip_count: export_clips.len(),
    })
}

/// Validate export settings
#[tauri::command]
pub async fn validate_export_settings_command(
    settings: ExportSettings,
) -> CommandResult<ValidationResult> {
    match validate_export_settings(&settings) {
        Ok(_) => Ok(ValidationResult {
            is_valid: true,
            errors: vec![],
        }),
        Err(error) => Ok(ValidationResult {
            is_valid: false,
            errors: vec![error.message],
        }),
    }
}

/// Get export file path from settings
#[tauri::command]
pub async fn get_export_file_path(output_dir: String, filename: String) -> CommandResult<String> {
    let filename = if filename.ends_with(".mp4") {
        filename
    } else {
        format!("{}.mp4", filename)
    };

    let output_path = std::path::Path::new(&output_dir).join(&filename);
    Ok(output_path.to_string_lossy().to_string())
}

/// Check if export path is valid
#[tauri::command]
pub async fn validate_export_path(output_path: String) -> CommandResult<ValidationResult> {
    let path = std::path::Path::new(&output_path);
    let mut errors = Vec::new();

    // Check if parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            errors.push("Output directory does not exist".to_string());
        } else if !parent.is_dir() {
            errors.push("Output path is not a directory".to_string());
        }
    } else {
        errors.push("Invalid output path".to_string());
    }

    // Check if file already exists
    if path.exists() {
        errors.push("Output file already exists".to_string());
    }

    // Check if filename is valid
    if let Some(filename) = path.file_name() {
        if let Some(filename_str) = filename.to_str() {
            if filename_str.is_empty() {
                errors.push("Filename cannot be empty".to_string());
            } else if filename_str.contains('/') || filename_str.contains('\\') {
                errors.push("Filename cannot contain path separators".to_string());
            }
        } else {
            errors.push("Invalid filename".to_string());
        }
    } else {
        errors.push("No filename provided".to_string());
    }

    Ok(ValidationResult {
        is_valid: errors.is_empty(),
        errors,
    })
}

/// Clean up export temporary files
#[tauri::command]
pub async fn cleanup_export_files() -> CommandResult<()> {
    crate::ffmpeg::export::cleanup_export_temp_files().await
}

/// Cancel an ongoing export
#[tauri::command]
pub async fn cancel_export(
    app_handle: tauri::AppHandle,
    export_id: String,
) -> CommandResult<bool> {
    // For MVP, we'll implement a simple cancellation mechanism
    // In a full implementation, this would track active processes and kill them
    
    // Emit cancellation progress
    let cancel_progress = crate::ffmpeg::export::ExportProgress {
        progress: 0.0,
        current_step: "Cancelled".to_string(),
        estimated_time_remaining: 0.0,
        error: Some("Export cancelled by user".to_string()),
        current_frame: None,
        total_frames: None,
        fps: None,
        bitrate: None,
        time: None,
    };
    
    app_handle.emit("export-progress", &cancel_progress)
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit cancellation progress: {}", e)))?;

    // TODO: Implement actual process termination
    // For now, just return success
    Ok(true)
}

/// Get export status
#[tauri::command]
pub async fn get_export_status(
    _app_handle: tauri::AppHandle,
    _export_id: String,
) -> CommandResult<crate::ffmpeg::export::ExportProgress> {
    // For MVP, return a default status
    // In a full implementation, this would track active exports
    Ok(crate::ffmpeg::export::ExportProgress {
        progress: 0.0,
        current_step: "Idle".to_string(),
        estimated_time_remaining: 0.0,
        error: None,
        current_frame: None,
        total_frames: None,
        fps: None,
        bitrate: None,
        time: None,
    })
}

// ============================================================================
// DATA STRUCTURES FOR RESPONSES
// ============================================================================

/// Export estimate information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportEstimate {
    pub estimated_time_seconds: f64,
    pub estimated_file_size_bytes: u64,
    pub total_duration_seconds: f64,
    pub clip_count: usize,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Format file size for display
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    const THRESHOLD: u64 = 1024;

    if bytes == 0 {
        return "0 B".to_string();
    }

    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= THRESHOLD as f64 && unit_index < UNITS.len() - 1 {
        size /= THRESHOLD as f64;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Format time duration for display
pub fn format_duration(seconds: f64) -> String {
    let hours = (seconds / 3600.0) as u32;
    let minutes = ((seconds % 3600.0) / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;

    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}

/// Format estimated time for display
pub fn format_estimated_time(seconds: f64) -> String {
    if seconds < 60.0 {
        format!("{:.0} seconds", seconds)
    } else if seconds < 3600.0 {
        let minutes = seconds / 60.0;
        format!("{:.1} minutes", minutes)
    } else {
        let hours = seconds / 3600.0;
        format!("{:.1} hours", hours)
    }
}

/// Get default export settings
pub fn get_default_export_settings() -> ExportSettings {
    ExportSettings {
        resolution: "source".to_string(),
        quality: "medium".to_string(),
        format: "mp4".to_string(),
        codec: "h264".to_string(),
    }
}

/// Get available export resolutions
pub fn get_available_resolutions() -> Vec<String> {
    vec![
        "source".to_string(),
        "1080p".to_string(),
        "720p".to_string(),
    ]
}

/// Get available export qualities
pub fn get_available_qualities() -> Vec<String> {
    vec!["high".to_string(), "medium".to_string(), "low".to_string()]
}

/// Check if export is possible with given clips
pub fn can_export_timeline(clips: &[TimelineExportClip]) -> bool {
    !clips.is_empty()
        && clips
            .iter()
            .all(|clip| !clip.file_path.is_empty() && clip.duration > 0.0)
}

/// Sort clips by timeline position
pub fn sort_clips_by_timeline_position(
    mut clips: Vec<TimelineExportClip>,
) -> Vec<TimelineExportClip> {
    clips.sort_by(|a, b| {
        a.start_time
            .partial_cmp(&b.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    clips
}

/// Validate timeline clips for export
pub fn validate_timeline_clips(clips: &[TimelineExportClip]) -> CommandResult<()> {
    if clips.is_empty() {
        return Err(CommandError::validation_error(
            "No clips to export".to_string(),
        ));
    }

    for (index, clip) in clips.iter().enumerate() {
        if clip.file_path.is_empty() {
            return Err(CommandError::validation_error(format!(
                "Clip {} has empty file path",
                index + 1
            )));
        }

        if clip.duration <= 0.0 {
            return Err(CommandError::validation_error(format!(
                "Clip {} has invalid duration: {}",
                index + 1,
                clip.duration
            )));
        }

        if clip.trim_start < 0.0 {
            return Err(CommandError::validation_error(format!(
                "Clip {} has negative trim start: {}",
                index + 1,
                clip.trim_start
            )));
        }

        if clip.trim_end <= clip.trim_start {
            return Err(CommandError::validation_error(format!(
                "Clip {} has invalid trim range: {} to {}",
                index + 1,
                clip.trim_start,
                clip.trim_end
            )));
        }
    }

    Ok(())
}
