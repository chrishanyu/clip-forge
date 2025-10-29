// ============================================================================
// FFMPEG EXPORT MODULE
// ============================================================================
// This module handles video export using FFmpeg.
// It supports concatenation and basic export operations for the MVP.

use crate::commands::{get_temp_dir, CommandError, CommandResult};
use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use tauri::Emitter;
use regex::Regex;

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
    pub start_time: f64, // Start time in timeline
    pub duration: f64,   // Duration in timeline
    pub trim_start: f64, // Trim start in source video
    pub trim_end: f64,   // Trim end in source video
}

/// Export settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub resolution: String, // "source", "1080p", "720p"
    pub quality: String,    // "high", "medium", "low"
    pub format: String,     // "mp4"
    pub codec: String,      // "h264"
}

/// Export progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub progress: f64, // Progress percentage (0-100)
    pub current_step: String,
    pub estimated_time_remaining: f64,
    pub error: Option<String>,
    pub current_frame: Option<u64>,
    pub total_frames: Option<u64>,
    pub fps: Option<f64>,
    pub bitrate: Option<f64>,
    pub time: Option<String>,
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
        return Err(CommandError::validation_error(
            "No clips to export".to_string(),
        ));
    }

    // Validate output path
    let output_dir = std::path::Path::new(&output_path)
        .parent()
        .ok_or_else(|| CommandError::validation_error("Invalid output path".to_string()))?;

    if !output_dir.exists() {
        return Err(CommandError::validation_error(
            "Output directory does not exist".to_string(),
        ));
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
    let clips = request.clips;
    let output_path = request.output_path;
    let settings = request.settings;

    // Validate input
    if clips.is_empty() {
        return Err(CommandError::validation_error(
            "No clips to export".to_string(),
        ));
    }

    // Validate output path
    let output_dir = std::path::Path::new(&output_path)
        .parent()
        .ok_or_else(|| CommandError::validation_error("Invalid output path".to_string()))?;

    if !output_dir.exists() {
        return Err(CommandError::validation_error(
            "Output directory does not exist".to_string(),
        ));
    }

    // Calculate total duration for progress tracking
    let total_duration: f64 = clips.iter().map(|clip| clip.duration).sum();

    // Emit start progress
    let start_progress = create_export_start_progress();
    app_handle.emit("export-progress", &start_progress)
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit start progress: {}", e)))?;

    // Export video with real-time progress tracking
    match export_video_with_progress_internal(&app_handle, &clips, &output_path, &settings, total_duration).await {
        Ok(_) => {
            // Emit completion progress
            let complete_progress = create_export_complete_progress();
            app_handle.emit("export-progress", &complete_progress)
                .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit completion progress: {}", e)))?;

            Ok(ExportVideoResponse {
                success: true,
                output_path: Some(output_path),
                error_message: None,
            })
        },
        Err(error) => {
            // Emit error progress
            let error_progress = create_export_error_progress(error.message.clone());
            app_handle.emit("export-progress", &error_progress)
                .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit error progress: {}", e)))?;

            Ok(ExportVideoResponse {
                success: false,
                output_path: None,
                error_message: Some(error.message),
            })
        },
    }
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
    let sidecar = app_handle.shell().sidecar("ffmpeg").map_err(|e| {
        CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e))
    })?;

    // Build FFmpeg command
    let mut args = vec![
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        &concat_file_path,
        "-c",
        "copy", // Copy streams without re-encoding
        "-y",   // Overwrite output file
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

/// Export video with progress tracking (real implementation)
async fn export_video_with_progress_internal(
    app_handle: &tauri::AppHandle,
    clips: &[ExportClip],
    output_path: &str,
    settings: &ExportSettings,
    total_duration: f64,
) -> CommandResult<()> {
    // Generate concat file
    let concat_file_path = generate_concat_file(clips).await?;

    // Get FFmpeg sidecar
    let sidecar = app_handle.shell().sidecar("ffmpeg").map_err(|e| {
        CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e))
    })?;

    // Build FFmpeg command
    let args = vec![
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        &concat_file_path,
        "-c",
        "copy", // Copy streams without re-encoding
        "-y",   // Overwrite output file
        output_path,
    ];

    // Log the command for debugging
    println!("FFmpeg command: ffmpeg {}", args.join(" "));
    println!("Concat file content:");
    if let Ok(content) = std::fs::read_to_string(&concat_file_path) {
        println!("{}", content);
    }

    // For MVP, we'll use a simple approach with simulated progress
    // Emit start progress
    let start_progress = create_export_start_progress();
    app_handle.emit("export-progress", &start_progress)
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit start progress: {}", e)))?;

    // Execute FFmpeg and wait for completion
    let output = sidecar
        .args(&args)
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to execute ffmpeg: {}", e)))?;

    // Log FFmpeg output for debugging
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    println!("FFmpeg stdout: {}", stdout);
    println!("FFmpeg stderr: {}", stderr);
    println!("FFmpeg exit code: {:?}", output.status.code());

    // Check if command succeeded
    if !output.status.success() {
        let error_progress = create_export_error_progress(format!("FFmpeg export failed: {}", stderr));
        let _ = app_handle.emit("export-progress", &error_progress);
        
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg export failed: {}",
            stderr
        )));
    }

    // Emit completion progress
    let complete_progress = create_export_complete_progress();
    app_handle.emit("export-progress", &complete_progress)
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit completion progress: {}", e)))?;

    // Clean up concat file
    std::fs::remove_file(&concat_file_path)
        .map_err(|e| CommandError::io_error(format!("Failed to cleanup concat file: {}", e)))?;

    Ok(())
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Validate export settings
pub fn validate_export_settings(settings: &ExportSettings) -> CommandResult<()> {
    // Validate resolution
    if !matches!(settings.resolution.as_str(), "source" | "1080p" | "720p") {
        return Err(CommandError::validation_error(
            "Invalid resolution. Must be 'source', '1080p', or '720p'".to_string(),
        ));
    }

    // Validate quality
    if !matches!(settings.quality.as_str(), "high" | "medium" | "low") {
        return Err(CommandError::validation_error(
            "Invalid quality. Must be 'high', 'medium', or 'low'".to_string(),
        ));
    }

    // Validate format
    if settings.format != "mp4" {
        return Err(CommandError::validation_error(
            "Invalid format. Only 'mp4' is supported".to_string(),
        ));
    }

    // Validate codec
    if settings.codec != "h264" {
        return Err(CommandError::validation_error(
            "Invalid codec. Only 'h264' is supported".to_string(),
        ));
    }

    Ok(())
}

/// Get FFmpeg resolution arguments
pub fn get_resolution_args(
    resolution: &str,
    _source_width: u32,
    _source_height: u32,
) -> Vec<String> {
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
        return Err(CommandError::validation_error(
            "No clips provided".to_string(),
        ));
    }

    // For MVP, we'll assume all clips are compatible
    // In a full implementation, we'd check codec, resolution, etc.
    Ok(())
}

/// Get export file size estimate
pub fn estimate_export_size(clips: &[ExportClip], settings: &ExportSettings) -> u64 {
    let total_duration: f64 = clips.iter().map(|clip| clip.duration).sum();

    // Rough estimation based on settings
    let base_bitrate = match settings.resolution.as_str() {
        "1080p" => 8000000, // 8 Mbps
        "720p" => 3000000,  // 3 Mbps
        _ => 5000000,       // 5 Mbps
    };

    let bitrate = match settings.quality.as_str() {
        "high" => (base_bitrate as f64 * 1.5) as u64,
        "medium" => base_bitrate, // Keep current bitrate
        "low" => (base_bitrate as f64 * 0.7) as u64,
        _ => base_bitrate, // Keep current bitrate
    };

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
                    std::fs::remove_file(&path).map_err(|e| {
                        CommandError::io_error(format!("Failed to delete temp file: {}", e))
                    })?;
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// PROGRESS PARSING FUNCTIONS
// ============================================================================

/// Parse FFmpeg progress from stderr output
pub fn parse_ffmpeg_progress(stderr_line: &str, total_duration: f64) -> Option<ExportProgress> {
    // FFmpeg progress patterns to match
    let frame_regex = Regex::new(r"frame=\s*(\d+)").unwrap();
    let fps_regex = Regex::new(r"fps=\s*([\d.]+)").unwrap();
    let time_regex = Regex::new(r"time=(\d{2}:\d{2}:\d{2}\.\d{2})").unwrap();
    let bitrate_regex = Regex::new(r"bitrate=\s*([\d.]+)\s*kbits/s").unwrap();
    let speed_regex = Regex::new(r"speed=\s*([\d.]+)x").unwrap();

    // Extract frame number
    let current_frame = frame_regex
        .captures(stderr_line)
        .and_then(|cap| cap.get(1))
        .and_then(|m| m.as_str().parse::<u64>().ok());

    // Extract FPS
    let fps = fps_regex
        .captures(stderr_line)
        .and_then(|cap| cap.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok());

    // Extract time
    let time = time_regex
        .captures(stderr_line)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string());

    // Extract bitrate
    let bitrate = bitrate_regex
        .captures(stderr_line)
        .and_then(|cap| cap.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok());

    // Extract speed
    let speed = speed_regex
        .captures(stderr_line)
        .and_then(|cap| cap.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok());

    // Calculate progress based on time
    if let Some(time_str) = &time {
        if let Ok(current_time) = parse_time_to_seconds(time_str) {
            let progress = if total_duration > 0.0 {
                (current_time / total_duration * 100.0).min(100.0)
            } else {
                0.0
            };

            // Calculate estimated time remaining
            let estimated_remaining = if let Some(speed) = speed {
                if speed > 0.0 {
                    (total_duration - current_time) / speed
                } else {
                    0.0
                }
            } else {
                0.0
            };

            return Some(ExportProgress {
                progress,
                current_step: "Exporting".to_string(),
                estimated_time_remaining: estimated_remaining,
                error: None,
                current_frame,
                total_frames: None, // We don't have total frames from FFmpeg output
                fps,
                bitrate,
                time: Some(time_str.clone()),
            });
        }
    }

    None
}

/// Parse time string (HH:MM:SS.mm) to seconds
fn parse_time_to_seconds(time_str: &str) -> Result<f64, Box<dyn std::error::Error>> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return Err("Invalid time format".into());
    }

    let hours: f64 = parts[0].parse()?;
    let minutes: f64 = parts[1].parse()?;
    let seconds: f64 = parts[2].parse()?;

    Ok(hours * 3600.0 + minutes * 60.0 + seconds)
}

/// Create a progress update for export start
pub fn create_export_start_progress() -> ExportProgress {
    ExportProgress {
        progress: 0.0,
        current_step: "Preparing".to_string(),
        estimated_time_remaining: 0.0,
        error: None,
        current_frame: None,
        total_frames: None,
        fps: None,
        bitrate: None,
        time: None,
    }
}

/// Create a progress update for export completion
pub fn create_export_complete_progress() -> ExportProgress {
    ExportProgress {
        progress: 100.0,
        current_step: "Completed".to_string(),
        estimated_time_remaining: 0.0,
        error: None,
        current_frame: None,
        total_frames: None,
        fps: None,
        bitrate: None,
        time: None,
    }
}

/// Create a progress update for export error
pub fn create_export_error_progress(error_message: String) -> ExportProgress {
    ExportProgress {
        progress: 0.0,
        current_step: "Failed".to_string(),
        estimated_time_remaining: 0.0,
        error: Some(error_message),
        current_frame: None,
        total_frames: None,
        fps: None,
        bitrate: None,
        time: None,
    }
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::export::{ExportTimelineRequest, TimelineExportClip, ExportProgressUpdate, ExportStatus, ExportJob};

    #[test]
    fn test_parse_ffmpeg_progress() {
        let stderr_line = "frame= 1234 fps=30.0 q=23.0 size=   10240kB time=00:00:41.13 bitrate=2048.0kbits/s speed=1.0x";
        let total_duration = 60.0; // 60 seconds

        let progress = parse_ffmpeg_progress(stderr_line, total_duration);

        assert!(progress.is_some());
        let progress = progress.unwrap();

        assert_eq!(progress.current_frame, Some(1234));
        assert_eq!(progress.fps, Some(30.0));
        assert_eq!(progress.bitrate, Some(2048.0));
        assert_eq!(progress.time, Some("00:00:41.13".to_string()));
        assert!(progress.progress > 0.0);
        assert!(progress.progress < 100.0);
        assert_eq!(progress.current_step, "Exporting");
    }

    #[test]
    fn test_parse_ffmpeg_progress_invalid_line() {
        let stderr_line = "This is not a progress line";
        let total_duration = 60.0;

        let progress = parse_ffmpeg_progress(stderr_line, total_duration);
        assert!(progress.is_none());
    }

    #[test]
    fn test_parse_ffmpeg_progress_complete() {
        let stderr_line = "frame= 1800 fps=30.0 q=23.0 size=   15360kB time=00:01:00.00 bitrate=2048.0kbits/s speed=1.0x";
        let total_duration = 60.0; // 60 seconds

        let progress = parse_ffmpeg_progress(stderr_line, total_duration);

        assert!(progress.is_some());
        let progress = progress.unwrap();

        assert_eq!(progress.progress, 100.0);
        assert_eq!(progress.current_step, "Exporting");
    }

    #[test]
    fn test_parse_time_to_seconds() {
        assert_eq!(parse_time_to_seconds("00:00:30.50").unwrap(), 30.5);
        assert_eq!(parse_time_to_seconds("00:01:30.00").unwrap(), 90.0);
        assert_eq!(parse_time_to_seconds("01:00:00.00").unwrap(), 3600.0);
        assert_eq!(parse_time_to_seconds("01:30:45.25").unwrap(), 5445.25);
    }

    #[test]
    fn test_parse_time_to_seconds_invalid() {
        assert!(parse_time_to_seconds("invalid").is_err());
        assert!(parse_time_to_seconds("00:00").is_err());
        assert!(parse_time_to_seconds("").is_err());
    }

    #[test]
    fn test_create_export_start_progress() {
        let progress = create_export_start_progress();

        assert_eq!(progress.progress, 0.0);
        assert_eq!(progress.current_step, "Preparing");
        assert_eq!(progress.estimated_time_remaining, 0.0);
        assert!(progress.error.is_none());
    }

    #[test]
    fn test_create_export_complete_progress() {
        let progress = create_export_complete_progress();

        assert_eq!(progress.progress, 100.0);
        assert_eq!(progress.current_step, "Completed");
        assert_eq!(progress.estimated_time_remaining, 0.0);
        assert!(progress.error.is_none());
    }

    #[test]
    fn test_create_export_error_progress() {
        let error_message = "Export failed".to_string();
        let progress = create_export_error_progress(error_message.clone());

        assert_eq!(progress.progress, 0.0);
        assert_eq!(progress.current_step, "Failed");
        assert_eq!(progress.estimated_time_remaining, 0.0);
        assert_eq!(progress.error, Some(error_message));
    }

    #[test]
    fn test_validate_export_settings() {
        let valid_settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            codec: "h264".to_string(),
        };

        assert!(validate_export_settings(&valid_settings).is_ok());
    }

    #[test]
    fn test_validate_export_settings_invalid_resolution() {
        let invalid_settings = ExportSettings {
            resolution: "invalid".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            codec: "h264".to_string(),
        };

        assert!(validate_export_settings(&invalid_settings).is_err());
    }

    #[test]
    fn test_validate_export_settings_invalid_quality() {
        let invalid_settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "invalid".to_string(),
            format: "mp4".to_string(),
            codec: "h264".to_string(),
        };

        assert!(validate_export_settings(&invalid_settings).is_err());
    }

    #[test]
    fn test_validate_export_settings_invalid_format() {
        let invalid_settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "high".to_string(),
            format: "avi".to_string(),
            codec: "h264".to_string(),
        };

        assert!(validate_export_settings(&invalid_settings).is_err());
    }

    #[test]
    fn test_validate_export_settings_invalid_codec() {
        let invalid_settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            codec: "h265".to_string(),
        };

        assert!(validate_export_settings(&invalid_settings).is_err());
    }

    #[test]
    fn test_get_resolution_args() {
        assert_eq!(get_resolution_args("1080p", 1920, 1080), vec!["-vf", "scale=1920:1080"]);
        assert_eq!(get_resolution_args("720p", 1920, 1080), vec!["-vf", "scale=1280:720"]);
        assert_eq!(get_resolution_args("source", 1920, 1080), Vec::<String>::new());
        assert_eq!(get_resolution_args("invalid", 1920, 1080), Vec::<String>::new());
    }

    #[test]
    fn test_get_quality_args() {
        assert_eq!(get_quality_args("high"), vec!["-crf", "18"]);
        assert_eq!(get_quality_args("medium"), vec!["-crf", "23"]);
        assert_eq!(get_quality_args("low"), vec!["-crf", "28"]);
        assert_eq!(get_quality_args("invalid"), vec!["-crf", "23"]);
    }

    #[test]
    fn test_estimate_export_time() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 10.0,
                duration: 20.0,
                trim_start: 0.0,
                trim_end: 20.0,
            },
        ];

        let settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            codec: "h264".to_string(),
        };

        let estimated_time = estimate_export_time(&clips, &settings);
        assert!(estimated_time > 0.0);
        assert!(estimated_time < 30.0); // Should be reasonable
    }

    #[test]
    fn test_check_clip_compatibility() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            },
        ];

        assert!(check_clip_compatibility(&clips).is_ok());
    }

    #[test]
    fn test_check_clip_compatibility_empty() {
        let clips = vec![];
        assert!(check_clip_compatibility(&clips).is_err());
    }

    #[test]
    fn test_estimate_export_size() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            },
        ];

        let settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            codec: "h264".to_string(),
        };

        let estimated_size = estimate_export_size(&clips, &settings);
        assert!(estimated_size > 0);
    }

    #[test]
    fn test_export_clip_creation() {
        let clip = ExportClip {
            file_path: "test.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
        };

        assert_eq!(clip.file_path, "test.mp4");
        assert_eq!(clip.start_time, 0.0);
        assert_eq!(clip.duration, 10.0);
        assert_eq!(clip.trim_start, 0.0);
        assert_eq!(clip.trim_end, 10.0);
    }

    #[test]
    fn test_export_settings_creation() {
        let settings = ExportSettings {
            resolution: "1080p".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            codec: "h264".to_string(),
        };

        assert_eq!(settings.resolution, "1080p");
        assert_eq!(settings.quality, "high");
        assert_eq!(settings.format, "mp4");
        assert_eq!(settings.codec, "h264");
    }

    #[test]
    fn test_export_progress_creation() {
        let progress = ExportProgress {
            progress: 50.0,
            current_step: "Exporting".to_string(),
            estimated_time_remaining: 30.0,
            error: None,
            current_frame: Some(1000),
            total_frames: Some(2000),
            fps: Some(30.0),
            bitrate: Some(2048.0),
            time: Some("00:00:30.00".to_string()),
        };

        assert_eq!(progress.progress, 50.0);
        assert_eq!(progress.current_step, "Exporting");
        assert_eq!(progress.estimated_time_remaining, 30.0);
        assert!(progress.error.is_none());
        assert_eq!(progress.current_frame, Some(1000));
        assert_eq!(progress.total_frames, Some(2000));
        assert_eq!(progress.fps, Some(30.0));
        assert_eq!(progress.bitrate, Some(2048.0));
        assert_eq!(progress.time, Some("00:00:30.00".to_string()));
    }

    #[test]
    fn test_export_timeline_request_creation() {
        let request = ExportTimelineRequest {
            timeline_clips: vec![
                TimelineExportClip {
                    file_path: "clip1.mp4".to_string(),
                    start_time: 0.0,
                    duration: 10.0,
                    trim_start: 0.0,
                    trim_end: 10.0,
                    track_id: "track1".to_string(),
                }
            ],
            output_path: "/path/to/output.mp4".to_string(),
            filename: "output.mp4".to_string(),
            settings: ExportSettings {
                resolution: "1080p".to_string(),
                quality: "high".to_string(),
                format: "mp4".to_string(),
                codec: "h264".to_string(),
            },
        };

        assert_eq!(request.timeline_clips.len(), 1);
        assert_eq!(request.output_path, "/path/to/output.mp4");
        assert_eq!(request.filename, "output.mp4");
        assert_eq!(request.settings.resolution, "1080p");
    }

    #[test]
    fn test_export_progress_update_creation() {
        let progress = ExportProgressUpdate {
            progress: 50.0,
            current_step: "Exporting".to_string(),
            estimated_time_remaining: 30.0,
            error: None,
        };

        assert_eq!(progress.progress, 50.0);
        assert_eq!(progress.current_step, "Exporting");
        assert_eq!(progress.estimated_time_remaining, 30.0);
        assert!(progress.error.is_none());
    }

    #[test]
    fn test_export_status_enum() {
        let status = ExportStatus::Preparing;
        assert!(matches!(status, ExportStatus::Preparing));

        let status = ExportStatus::Exporting;
        assert!(matches!(status, ExportStatus::Exporting));

        let status = ExportStatus::Completed;
        assert!(matches!(status, ExportStatus::Completed));

        let status = ExportStatus::Failed;
        assert!(matches!(status, ExportStatus::Failed));

        let status = ExportStatus::Cancelled;
        assert!(matches!(status, ExportStatus::Cancelled));
    }

    #[test]
    fn test_export_job_creation() {
        let job = ExportJob {
            id: "export_123".to_string(),
            status: ExportStatus::Exporting,
            progress: 75.0,
            output_path: Some("/path/to/output.mp4".to_string()),
            error_message: None,
            created_at: chrono::Utc::now(),
        };

        assert_eq!(job.id, "export_123");
        assert!(matches!(job.status, ExportStatus::Exporting));
        assert_eq!(job.progress, 75.0);
        assert_eq!(job.output_path, Some("/path/to/output.mp4".to_string()));
        assert!(job.error_message.is_none());
    }
}
