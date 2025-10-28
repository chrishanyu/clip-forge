// ============================================================================
// FFMPEG EXPORT MODULE
// ============================================================================
// This module handles video export using FFmpeg.
// It supports concatenation and basic export operations for the MVP.

use crate::commands::{CommandResult, CommandError, get_temp_dir};
use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Request to export video
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportVideoRequest {
    pub clips: Vec<ExportClip>,
    pub output_path: String,
    pub settings: ExportSettings,
}

/// Individual clip for export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportClip {
    pub file_path: String,
    pub start_time: f64,    // Start time in timeline
    pub duration: f64,      // Duration in timeline
    pub trim_start: f64,    // Trim start in source video
    pub trim_end: f64,      // Trim end in source video
}

/// Export settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub resolution: String,  // "source", "1080p", "720p"
    pub quality: String,    // "high", "medium", "low"
    pub format: String,     // "mp4"
    pub codec: String,      // "h264"
}

/// Export progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub progress: f64,      // Progress percentage (0-100)
    pub current_step: String,
    pub estimated_time_remaining: f64,
    pub error: Option<String>,
}

/// Response from export operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportVideoResponse {
    pub success: bool,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Export video using FFmpeg concatenation
#[tauri::command]
pub async fn export_video(
    app_handle: tauri::AppHandle,
    request: ExportVideoRequest,
) -> CommandResult<ExportVideoResponse> {
    let clips = request.clips;
    let output_path = request.output_path;
    let settings = request.settings;
    
    // Validate input
    if clips.is_empty() {
        return Err(CommandError::validation_error("No clips to export".to_string()));
    }
    
    // Validate output path
    let output_dir = std::path::Path::new(&output_path).parent()
        .ok_or_else(|| CommandError::validation_error("Invalid output path".to_string()))?;
    
    if !output_dir.exists() {
        return Err(CommandError::validation_error("Output directory does not exist".to_string()));
    }
    
    // Export video
    match export_video_internal(&app_handle, &clips, &output_path, &settings).await {
        Ok(_) => Ok(ExportVideoResponse {
            success: true,
            output_path: Some(output_path),
            error_message: None,
        }),
        Err(error) => Ok(ExportVideoResponse {
            success: false,
            output_path: None,
            error_message: Some(error.message),
        }),
    }
}

/// Export video with progress tracking
#[tauri::command]
pub async fn export_video_with_progress(
    app_handle: tauri::AppHandle,
    request: ExportVideoRequest,
) -> CommandResult<ExportVideoResponse> {
    // For MVP, we'll use the simple export and simulate progress
    // In a full implementation, this would track FFmpeg progress in real-time
    export_video(app_handle, request).await
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/// Internal function to export video using FFmpeg
async fn export_video_internal(
    app_handle: &tauri::AppHandle,
    clips: &[ExportClip],
    output_path: &str,
    settings: &ExportSettings,
) -> CommandResult<()> {
    // For MVP, we'll use simple concatenation without re-encoding
    // This is fast but requires all clips to have the same codec/resolution
    
    // Generate concat file
    let concat_file_path = generate_concat_file(clips).await?;
    
    // Get FFmpeg sidecar
    let sidecar = app_handle.shell()
        .sidecar("ffmpeg")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e)))?;
    
    // Build FFmpeg command
    let mut args = vec![
        "-f", "concat",
        "-safe", "0",
        "-i", &concat_file_path,
        "-c", "copy",  // Copy streams without re-encoding
        "-y",          // Overwrite output file
        output_path,
    ];
    
    // Execute FFmpeg
    let output = sidecar
        .args(&args)
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to execute ffmpeg: {}", e)))?;
    
    // Check if command succeeded
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg export failed: {}",
            stderr
        )));
    }
    
    // Clean up concat file
    std::fs::remove_file(&concat_file_path)
        .map_err(|e| CommandError::io_error(format!("Failed to cleanup concat file: {}", e)))?;
    
    Ok(())
}

/// Generate FFmpeg concat file
async fn generate_concat_file(clips: &[ExportClip]) -> CommandResult<String> {
    let temp_dir = get_temp_dir()?;
    let concat_file_path = temp_dir.join(format!("concat_{}.txt", chrono::Utc::now().timestamp()));
    
    // Generate concat file content
    let mut content = String::new();
    for clip in clips {
        // For MVP, we'll use the full file path
        // In a full implementation, we'd handle trimming here
        content.push_str(&format!("file '{}'\n", clip.file_path));
    }
    
    // Write concat file
    std::fs::write(&concat_file_path, content)
        .map_err(|e| CommandError::io_error(format!("Failed to write concat file: {}", e)))?;
    
    Ok(concat_file_path.to_string_lossy().to_string())
}

/// Export video with progress tracking (placeholder for future implementation)
async fn export_video_with_progress_internal(
    app_handle: &tauri::AppHandle,
    clips: &[ExportClip],
    output_path: &str,
    settings: &ExportSettings,
) -> CommandResult<()> {
    // This would be the full implementation with progress tracking
    // For MVP, we'll use the simple version
    export_video_internal(app_handle, clips, output_path, settings).await
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Validate export settings
pub fn validate_export_settings(settings: &ExportSettings) -> CommandResult<()> {
    // Validate resolution
    if !matches!(settings.resolution.as_str(), "source" | "1080p" | "720p") {
        return Err(CommandError::validation_error(
            "Invalid resolution. Must be 'source', '1080p', or '720p'".to_string()
        ));
    }
    
    // Validate quality
    if !matches!(settings.quality.as_str(), "high" | "medium" | "low") {
        return Err(CommandError::validation_error(
            "Invalid quality. Must be 'high', 'medium', or 'low'".to_string()
        ));
    }
    
    // Validate format
    if settings.format != "mp4" {
        return Err(CommandError::validation_error(
            "Invalid format. Only 'mp4' is supported".to_string()
        ));
    }
    
    // Validate codec
    if settings.codec != "h264" {
        return Err(CommandError::validation_error(
            "Invalid codec. Only 'h264' is supported".to_string()
        ));
    }
    
    Ok(())
}

/// Get FFmpeg resolution arguments
pub fn get_resolution_args(resolution: &str, _source_width: u32, _source_height: u32) -> Vec<String> {
    match resolution {
        "1080p" => vec!["-vf".to_string(), "scale=1920:1080".to_string()],
        "720p" => vec!["-vf".to_string(), "scale=1280:720".to_string()],
        "source" => vec![], // No scaling
        _ => vec![],
    }
}

/// Get FFmpeg quality arguments
pub fn get_quality_args(quality: &str) -> Vec<String> {
    match quality {
        "high" => vec!["-crf".to_string(), "18".to_string()],
        "medium" => vec!["-crf".to_string(), "23".to_string()],
        "low" => vec!["-crf".to_string(), "28".to_string()],
        _ => vec!["-crf".to_string(), "23".to_string()], // Default to medium
    }
}

/// Estimate export time based on clips and settings
pub fn estimate_export_time(clips: &[ExportClip], settings: &ExportSettings) -> f64 {
    let total_duration: f64 = clips.iter().map(|clip| clip.duration).sum();
    
    // Rough estimation based on settings
    let mut multiplier = 1.0;
    
    match settings.resolution.as_str() {
        "1080p" => multiplier *= 1.2,
        "720p" => multiplier *= 0.8,
        _ => multiplier *= 1.0,
    }
    
    match settings.quality.as_str() {
        "high" => multiplier *= 1.5,
        "medium" => multiplier *= 1.0,
        "low" => multiplier *= 0.7,
        _ => multiplier *= 1.0,
    }
    
    // Base estimation: 0.1x real-time for simple concatenation
    total_duration * 0.1 * multiplier
}

/// Check if clips are compatible for concatenation
pub fn check_clip_compatibility(clips: &[ExportClip]) -> CommandResult<()> {
    if clips.is_empty() {
        return Err(CommandError::validation_error("No clips provided".to_string()));
    }
    
    // For MVP, we'll assume all clips are compatible
    // In a full implementation, we'd check codec, resolution, etc.
    Ok(())
}

/// Get export file size estimate
pub fn estimate_export_size(clips: &[ExportClip], settings: &ExportSettings) -> u64 {
    let total_duration: f64 = clips.iter().map(|clip| clip.duration).sum();
    
    // Rough estimation based on settings
    let mut bitrate = 5000000; // 5 Mbps base
    
    match settings.resolution.as_str() {
        "1080p" => bitrate = 8000000,  // 8 Mbps
        "720p" => bitrate = 3000000,   // 3 Mbps
        _ => bitrate = 5000000,        // 5 Mbps
    }
    
    match settings.quality.as_str() {
        "high" => bitrate = (bitrate as f64 * 1.5) as u64,
        "medium" => {}, // Keep current bitrate
        "low" => bitrate = (bitrate as f64 * 0.7) as u64,
        _ => {}, // Keep current bitrate
    }
    
    // Calculate estimated size in bytes
    (total_duration * bitrate as f64 / 8.0) as u64
}

/// Clean up export temporary files
pub async fn cleanup_export_temp_files() -> CommandResult<()> {
    let temp_dir = get_temp_dir()?;
    
    if temp_dir.exists() {
        let entries = std::fs::read_dir(&temp_dir)
            .map_err(|e| CommandError::io_error(format!("Failed to read temp directory: {}", e)))?;
        
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("txt") {
                    std::fs::remove_file(&path)
                        .map_err(|e| CommandError::io_error(format!("Failed to delete temp file: {}", e)))?;
                }
            }
        }
    }
    
    Ok(())
}
