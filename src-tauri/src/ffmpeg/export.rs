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
    pub track_id: String, // Track ID for ordering
    pub trimmed_file_path: Option<String>, // Path to trimmed file if available
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

    // Validate trim data for all clips
    validate_export_clips_trim_data(&clips)?;

    // Validate timeline order and structure
    validate_timeline_clips_for_export(&clips)?;

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

    // Validate trim data for all clips
    validate_export_clips_trim_data(&clips)?;

    // Validate timeline order and structure
    validate_timeline_clips_for_export(&clips)?;

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
    // Create temporary file tracker
    let mut tracker = TempFileTracker::new();

    // Trim clips that need trimming with tracking
    let trimmed_clips = trim_clips_for_export_with_tracking(app_handle, clips, &mut tracker).await?;

    // Generate concat file using trimmed clips and track it
    let concat_file_path = generate_concat_file_with_tracking(&trimmed_clips, &mut tracker).await?;

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
        // Clean up temporary files even on failure
        let _ = tracker.cleanup_all().await;
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg export failed: {}",
            stderr
        )));
    }

    // Clean up all temporary files
    tracker.cleanup_all().await?;

    Ok(())
}

/// Generate FFmpeg concat file
async fn generate_concat_file(clips: &[ExportClip]) -> CommandResult<String> {
    let temp_dir = get_temp_dir()?;
    let concat_file_path = temp_dir.join(format!("concat_{}.txt", chrono::Utc::now().timestamp()));

    // Sort clips by track order and timeline position to ensure correct order
    let sorted_clips = sort_clips_by_track_and_timeline_position(clips);

    // Generate concat file content
    let mut content = String::new();
    for clip in &sorted_clips {
        // Use trimmed file path if available, otherwise use original file path
        let file_path = clip.trimmed_file_path.as_ref().unwrap_or(&clip.file_path);
        content.push_str(&format!("file '{}'\n", file_path));
    }

    // Write concat file
    std::fs::write(&concat_file_path, content)
        .map_err(|e| CommandError::io_error(format!("Failed to write concat file: {}", e)))?;

    Ok(concat_file_path.to_string_lossy().to_string())
}

/// Generate FFmpeg concat file with temporary file tracking
async fn generate_concat_file_with_tracking(
    clips: &[ExportClip],
    tracker: &mut TempFileTracker,
) -> CommandResult<String> {
    let concat_file_path = create_and_track_temp_file(tracker, "concat", "txt").await?;

    // Sort clips by track order and timeline position to ensure correct order
    let sorted_clips = sort_clips_by_track_and_timeline_position(clips);

    // Generate concat file content
    let mut content = String::new();
    for clip in &sorted_clips {
        // Use trimmed file path if available, otherwise use original file path
        let file_path = clip.trimmed_file_path.as_ref().unwrap_or(&clip.file_path);
        content.push_str(&format!("file '{}'\n", file_path));
    }

    // Write concat file
    std::fs::write(&concat_file_path, content)
        .map_err(|e| CommandError::io_error(format!("Failed to write concat file: {}", e)))?;

    Ok(concat_file_path)
}

// ============================================================================
// TIMELINE ORDER PRESERVATION FUNCTIONS
// ============================================================================

/// Sort clips by timeline start time
pub fn sort_clips_by_timeline_position(clips: &[ExportClip]) -> Vec<ExportClip> {
    let mut sorted_clips = clips.to_vec();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
    sorted_clips
}

/// Sort clips by track order and timeline position
pub fn sort_clips_by_track_and_timeline_position(clips: &[ExportClip]) -> Vec<ExportClip> {
    let mut sorted_clips = clips.to_vec();
    sorted_clips.sort_by(|a, b| {
        // First sort by track_id
        let track_cmp = a.track_id.cmp(&b.track_id);
        if track_cmp != std::cmp::Ordering::Equal {
            return track_cmp;
        }
        // Then sort by start_time within the same track
        a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal)
    });
    sorted_clips
}

/// Validate that clips are in chronological order
pub fn validate_timeline_chronological_order(clips: &[ExportClip]) -> CommandResult<()> {
    for (i, clip) in clips.iter().enumerate() {
        if i > 0 {
            let prev_clip = &clips[i - 1];
            if clip.start_time < prev_clip.start_time {
                return Err(CommandError::validation_error(format!(
                    "Clips are not in chronological order: clip {} starts at {}s but previous clip starts at {}s",
                    i + 1,
                    clip.start_time,
                    prev_clip.start_time
                )));
            }
        }
    }
    Ok(())
}

/// Check for overlapping clips within the same track
pub fn check_for_overlapping_clips(clips: &[ExportClip]) -> CommandResult<()> {
    // Group clips by track
    let mut track_groups: std::collections::HashMap<String, Vec<&ExportClip>> = std::collections::HashMap::new();
    for clip in clips {
        track_groups.entry(clip.track_id.clone()).or_insert_with(Vec::new).push(clip);
    }
    
    // Check for overlaps within each track
    for (track_id, track_clips) in track_groups {
        // Sort clips within the track by start time
        let mut sorted_clips = track_clips;
        sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
        
        for (i, clip) in sorted_clips.iter().enumerate() {
            if i > 0 {
                let prev_clip = sorted_clips[i - 1];
                let prev_end_time = prev_clip.start_time + prev_clip.duration;
                
                if clip.start_time < prev_end_time {
                    return Err(CommandError::validation_error(format!(
                        "Overlapping clips detected on track '{}': clip {} starts at {}s but previous clip ends at {}s",
                        track_id,
                        i + 1,
                        clip.start_time,
                        prev_end_time
                    )));
                }
            }
        }
    }
    Ok(())
}

/// Get timeline duration (end time of the last clip)
pub fn get_timeline_duration(clips: &[ExportClip]) -> f64 {
    if clips.is_empty() {
        return 0.0;
    }
    
    let sorted_clips = sort_clips_by_timeline_position(clips);
    let last_clip = sorted_clips.last().unwrap();
    last_clip.start_time + last_clip.duration
}

/// Validate track ordering for clips
pub fn validate_track_ordering(clips: &[ExportClip]) -> CommandResult<()> {
    // Group clips by track without sorting
    let mut track_groups: std::collections::HashMap<String, Vec<&ExportClip>> = std::collections::HashMap::new();
    for clip in clips {
        track_groups.entry(clip.track_id.clone()).or_insert_with(Vec::new).push(clip);
    }
    
    // Validate each track's chronological order
    for (track_id, track_clips) in track_groups {
        for (i, clip) in track_clips.iter().enumerate() {
            if i > 0 {
                let prev_clip = track_clips[i - 1];
                if clip.start_time < prev_clip.start_time {
                    return Err(CommandError::validation_error(format!(
                        "Clips on track '{}' are not in chronological order: clip {} starts at {}s but previous clip starts at {}s",
                        track_id,
                        i + 1,
                        clip.start_time,
                        prev_clip.start_time
                    )));
                }
            }
        }
    }
    
    Ok(())
}

/// Get unique track IDs from clips
pub fn get_unique_track_ids(clips: &[ExportClip]) -> Vec<String> {
    let mut track_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for clip in clips {
        track_ids.insert(clip.track_id.clone());
    }
    let mut sorted_track_ids: Vec<String> = track_ids.into_iter().collect();
    sorted_track_ids.sort();
    sorted_track_ids
}

/// Check if a clip needs trimming based on trim data
pub fn clip_needs_trimming(clip: &ExportClip) -> bool {
    clip.trim_start > 0.0 || clip.trim_end < (clip.trim_start + clip.duration)
}

/// Update clip with trimmed file path
pub fn set_trimmed_file_path(clip: &mut ExportClip, trimmed_path: String) {
    clip.trimmed_file_path = Some(trimmed_path);
}

/// Validate timeline clips for export
pub fn validate_timeline_clips_for_export(clips: &[ExportClip]) -> CommandResult<()> {
    if clips.is_empty() {
        return Err(CommandError::validation_error(
            "No clips provided for export".to_string(),
        ));
    }

    // Validate track ordering
    validate_track_ordering(clips)?;

    // Check for overlapping clips within tracks
    check_for_overlapping_clips(clips)?;

    // Validate individual clips
    for (i, clip) in clips.iter().enumerate() {
        if clip.start_time < 0.0 {
            return Err(CommandError::validation_error(format!(
                "Clip {} has negative start time: {}s",
                i + 1,
                clip.start_time
            )));
        }

        if clip.duration <= 0.0 {
            return Err(CommandError::validation_error(format!(
                "Clip {} has invalid duration: {}s",
                i + 1,
                clip.duration
            )));
        }

        if clip.track_id.is_empty() {
            return Err(CommandError::validation_error(format!(
                "Clip {} has empty track ID",
                i + 1
            )));
        }
    }

    Ok(())
}

/// Export video with progress tracking (real implementation)
async fn export_video_with_progress_internal(
    app_handle: &tauri::AppHandle,
    clips: &[ExportClip],
    output_path: &str,
    settings: &ExportSettings,
    total_duration: f64,
) -> CommandResult<()> {
    // Create temporary file tracker
    let mut tracker = TempFileTracker::new();

    // Trim clips that need trimming with tracking
    let trimmed_clips = trim_clips_for_export_with_tracking(app_handle, clips, &mut tracker).await?;

    // Generate concat file using trimmed clips and track it
    let concat_file_path = generate_concat_file_with_tracking(&trimmed_clips, &mut tracker).await?;

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

    // Get FFmpeg output for error handling
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check if command succeeded
    if !output.status.success() {
        let error_progress = create_export_error_progress(format!("FFmpeg export failed: {}", stderr));
        let _ = app_handle.emit("export-progress", &error_progress);
        
        // Clean up temporary files even on failure
        let _ = tracker.cleanup_all().await;
        
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg export failed: {}",
            stderr
        )));
    }

    // Emit completion progress
    let complete_progress = create_export_complete_progress();
    app_handle.emit("export-progress", &complete_progress)
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to emit completion progress: {}", e)))?;

    // Clean up all temporary files
    tracker.cleanup_all().await?;

    Ok(())
}

// ============================================================================
// TRIM DATA VALIDATION FUNCTIONS
// ============================================================================

/// Validate trim data for a single clip
pub fn validate_trim_data(
    trim_start: f64,
    trim_end: f64,
    original_duration: f64,
    clip_index: usize,
) -> CommandResult<()> {
    // Validate trimStart >= 0
    if trim_start < 0.0 {
        return Err(CommandError::validation_error(format!(
            "Clip {} has negative trim start: {}",
            clip_index + 1,
            trim_start
        )));
    }

    // Validate trimEnd > trimStart
    if trim_end <= trim_start {
        return Err(CommandError::validation_error(format!(
            "Clip {} has invalid trim range: {} to {} (end must be greater than start)",
            clip_index + 1,
            trim_start,
            trim_end
        )));
    }

    // Validate trimEnd <= original video duration
    if trim_end > original_duration {
        return Err(CommandError::validation_error(format!(
            "Clip {} trim end ({}s) exceeds original video duration ({}s)",
            clip_index + 1,
            trim_end,
            original_duration
        )));
    }

    // Validate minimum clip duration (0.1 seconds)
    let clip_duration = trim_end - trim_start;
    if clip_duration < 0.1 {
        return Err(CommandError::validation_error(format!(
            "Clip {} duration too short: {}s (minimum 0.1s)",
            clip_index + 1,
            clip_duration
        )));
    }

    Ok(())
}

/// Check if a clip needs trimming (has trim points different from full duration)
pub fn needs_trimming(trim_start: f64, trim_end: f64, original_duration: f64) -> bool {
    // Allow small floating point differences (0.01 seconds tolerance)
    const TOLERANCE: f64 = 0.01;
    
    let start_diff = (trim_start - 0.0).abs();
    let end_diff = (trim_end - original_duration).abs();
    
    start_diff > TOLERANCE || end_diff > TOLERANCE
}

/// Calculate trimmed clip duration
pub fn calculate_trimmed_duration(trim_start: f64, trim_end: f64) -> f64 {
    trim_end - trim_start
}

/// Validate all clips in an export request for trim data
pub fn validate_export_clips_trim_data(clips: &[ExportClip]) -> CommandResult<()> {
    if clips.is_empty() {
        return Err(CommandError::validation_error(
            "No clips to export".to_string(),
        ));
    }

    for (index, clip) in clips.iter().enumerate() {
        // For MVP, we'll assume all clips have the same duration as their trim_end
        // In a full implementation, we'd need to probe the video to get actual duration
        let original_duration = clip.trim_end; // This is a simplification for MVP
        
        validate_trim_data(
            clip.trim_start,
            clip.trim_end,
            original_duration,
            index,
        )?;
    }

    Ok(())
}

/// Get clips that need trimming (for optimization)
pub fn get_clips_needing_trimming(clips: &[ExportClip]) -> Vec<usize> {
    clips
        .iter()
        .enumerate()
        .filter_map(|(index, clip)| {
            let original_duration = clip.trim_end; // MVP simplification
            if needs_trimming(clip.trim_start, clip.trim_end, original_duration) {
                Some(index)
            } else {
                None
            }
        })
        .collect()
}

/// Get clips that don't need trimming (for optimization)
pub fn get_clips_not_needing_trimming(clips: &[ExportClip]) -> Vec<usize> {
    clips
        .iter()
        .enumerate()
        .filter_map(|(index, clip)| {
            let original_duration = clip.trim_end; // MVP simplification
            if !needs_trimming(clip.trim_start, clip.trim_end, original_duration) {
                Some(index)
            } else {
                None
            }
        })
        .collect()
}

// ============================================================================
// FFMPEG TRIM IMPLEMENTATION FUNCTIONS
// ============================================================================

/// Generate FFmpeg trim command arguments for a single clip
pub fn generate_trim_command_args(
    input_path: &str,
    output_path: &str,
    trim_start: f64,
    trim_duration: f64,
    use_copy_codec: bool,
) -> Vec<String> {
    let mut args = vec![
        "-i".to_string(),
        input_path.to_string(),
        "-ss".to_string(),
        format!("{:.3}", trim_start), // 3 decimal places for precision
        "-t".to_string(),
        format!("{:.3}", trim_duration), // 3 decimal places for precision
    ];

    if use_copy_codec {
        // Use copy codec to avoid re-encoding
        args.extend(vec![
            "-c".to_string(),
            "copy".to_string(),
        ]);
    } else {
        // Use default encoding (will be slower but more compatible)
        args.extend(vec![
            "-c:v".to_string(),
            "libx264".to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
        ]);
    }

    // Add output path
    args.push("-y".to_string()); // Overwrite output file
    args.push(output_path.to_string());

    args
}

/// Trim a single video clip using FFmpeg
pub async fn trim_video_clip(
    app_handle: &tauri::AppHandle,
    input_path: &str,
    output_path: &str,
    trim_start: f64,
    trim_duration: f64,
    use_copy_codec: bool,
) -> CommandResult<()> {
    // Generate FFmpeg command arguments
    let args = generate_trim_command_args(input_path, output_path, trim_start, trim_duration, use_copy_codec);

    // Get FFmpeg sidecar
    let sidecar = app_handle.shell().sidecar("ffmpeg").map_err(|e| {
        CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e))
    })?;

    // Execute FFmpeg trim command
    let output = sidecar
        .args(&args)
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to execute ffmpeg trim: {}", e)))?;

    // Check if command succeeded
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg trim failed: {}",
            stderr
        )));
    }

    Ok(())
}

/// Create temporary file path for trimmed clip
pub fn create_temp_trim_file_path(clip_index: usize, extension: &str) -> CommandResult<String> {
    let temp_dir = get_temp_dir()?;
    let timestamp = chrono::Utc::now().timestamp();
    let filename = format!("trimmed_clip_{}_{}.{}", clip_index, timestamp, extension);
    let temp_path = temp_dir.join(filename);
    
    Ok(temp_path.to_string_lossy().to_string())
}

/// Generate unique filename for temporary files
pub fn generate_unique_temp_filename(prefix: &str, extension: &str) -> CommandResult<String> {
    let temp_dir = get_temp_dir()?;
    let timestamp = chrono::Utc::now().timestamp();
    let nanoseconds = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0) % 1_000_000_000;
    let filename = format!("{}_{}_{}.{}", prefix, timestamp, nanoseconds, extension);
    let temp_path = temp_dir.join(filename);
    
    Ok(temp_path.to_string_lossy().to_string())
}

/// Create temporary file path with custom prefix
pub fn create_temp_file_path(prefix: &str, extension: &str) -> CommandResult<String> {
    generate_unique_temp_filename(prefix, extension)
}

/// Create temporary directory path
pub fn create_temp_dir_path(dir_name: &str) -> CommandResult<String> {
    let temp_dir = get_temp_dir()?;
    let timestamp = chrono::Utc::now().timestamp();
    let dir_path = temp_dir.join(format!("{}_{}", dir_name, timestamp));
    
    Ok(dir_path.to_string_lossy().to_string())
}

/// Get file extension from path
pub fn get_file_extension(file_path: &str) -> String {
    std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("mp4")
        .to_lowercase()
}

/// Check if video format supports copy codec
pub fn supports_copy_codec(file_extension: &str) -> bool {
    matches!(file_extension, "mp4" | "mov" | "avi" | "mkv" | "webm")
}

/// Trim all clips that need trimming and return updated clip list
pub async fn trim_clips_for_export(
    app_handle: &tauri::AppHandle,
    clips: &[ExportClip],
) -> CommandResult<Vec<ExportClip>> {
    let mut trimmed_clips = Vec::new();
    let clips_needing_trim = get_clips_needing_trimming(clips);

    for (index, clip) in clips.iter().enumerate() {
        if clips_needing_trim.contains(&index) {
            // This clip needs trimming
            let file_extension = get_file_extension(&clip.file_path);
            let temp_path = create_temp_trim_file_path(index, &file_extension)?;
            let trim_duration = calculate_trimmed_duration(clip.trim_start, clip.trim_end);
            let use_copy_codec = supports_copy_codec(&file_extension);

            // Trim the clip
            trim_video_clip(
                app_handle,
                &clip.file_path,
                &temp_path,
                clip.trim_start,
                trim_duration,
                use_copy_codec,
            ).await?;

            // Create new clip with trimmed file path
            let trimmed_clip = ExportClip {
                file_path: temp_path.clone(),
                start_time: clip.start_time,
                duration: trim_duration, // Update duration to trimmed duration
                trim_start: 0.0, // Reset trim points since we've already trimmed
                trim_end: trim_duration,
                track_id: clip.track_id.clone(),
                trimmed_file_path: Some(temp_path),
            };
            trimmed_clips.push(trimmed_clip);
        } else {
            // This clip doesn't need trimming, use as-is
            trimmed_clips.push(clip.clone());
        }
    }

    Ok(trimmed_clips)
}

/// Trim all clips that need trimming with temporary file tracking
pub async fn trim_clips_for_export_with_tracking(
    app_handle: &tauri::AppHandle,
    clips: &[ExportClip],
    tracker: &mut TempFileTracker,
) -> CommandResult<Vec<ExportClip>> {
    let mut trimmed_clips = Vec::new();
    let clips_needing_trim = get_clips_needing_trimming(clips);

    for (index, clip) in clips.iter().enumerate() {
        if clips_needing_trim.contains(&index) {
            // This clip needs trimming
            let file_extension = get_file_extension(&clip.file_path);
            let temp_path = create_and_track_temp_file(tracker, "trimmed_clip", &file_extension).await?;
            let trim_duration = calculate_trimmed_duration(clip.trim_start, clip.trim_end);
            let use_copy_codec = supports_copy_codec(&file_extension);

            // Trim the clip
            trim_video_clip(
                app_handle,
                &clip.file_path,
                &temp_path,
                clip.trim_start,
                trim_duration,
                use_copy_codec,
            ).await?;

            // Create new clip with trimmed file path
            let trimmed_clip = ExportClip {
                file_path: temp_path.clone(),
                start_time: clip.start_time,
                duration: trim_duration, // Update duration to trimmed duration
                trim_start: 0.0, // Reset trim points since we've already trimmed
                trim_end: trim_duration,
                track_id: clip.track_id.clone(),
                trimmed_file_path: Some(temp_path),
            };
            trimmed_clips.push(trimmed_clip);
        } else {
            // This clip doesn't need trimming, use as-is
            trimmed_clips.push(clip.clone());
        }
    }

    Ok(trimmed_clips)
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
                if path.is_file() {
                    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    // Clean up both concat files (.txt) and trimmed clip files
                    if filename.ends_with(".txt") || filename.starts_with("trimmed_clip_") {
                        std::fs::remove_file(&path).map_err(|e| {
                            CommandError::io_error(format!("Failed to delete temp file: {}", e))
                        })?;
                    }
                }
            }
        }
    }

    Ok(())
}

/// Clean up specific trimmed clip files
pub async fn cleanup_trimmed_clip_files(trimmed_clips: &[ExportClip]) -> CommandResult<()> {
    for clip in trimmed_clips {
        if clip.file_path.contains("trimmed_clip_") {
            if std::path::Path::new(&clip.file_path).exists() {
                std::fs::remove_file(&clip.file_path).map_err(|e| {
                    CommandError::io_error(format!("Failed to delete trimmed clip file: {}", e))
                })?;
            }
        }
    }
    Ok(())
}

// ============================================================================
// TEMPORARY FILE MANAGEMENT SYSTEM
// ============================================================================

/// Track temporary files for cleanup
#[derive(Debug, Clone)]
pub struct TempFileTracker {
    pub files: Vec<String>,
    pub directories: Vec<String>,
}

impl TempFileTracker {
    /// Create a new temporary file tracker
    pub fn new() -> Self {
        Self {
            files: Vec::new(),
            directories: Vec::new(),
        }
    }

    /// Add a temporary file to track
    pub fn add_file(&mut self, file_path: String) {
        self.files.push(file_path);
    }

    /// Add a temporary directory to track
    pub fn add_directory(&mut self, dir_path: String) {
        self.directories.push(dir_path);
    }

    /// Clean up all tracked files and directories
    pub async fn cleanup_all(&self) -> CommandResult<()> {
        // Clean up files first
        for file_path in &self.files {
            if std::path::Path::new(file_path).exists() {
                if let Err(e) = std::fs::remove_file(file_path) {
                    eprintln!("Warning: Failed to delete temporary file {}: {}", file_path, e);
                    // Don't fail the entire cleanup for individual file errors
                }
            }
        }

        // Clean up directories (in reverse order to handle nested dirs)
        for dir_path in self.directories.iter().rev() {
            if std::path::Path::new(dir_path).exists() {
                if let Err(e) = std::fs::remove_dir_all(dir_path) {
                    eprintln!("Warning: Failed to delete temporary directory {}: {}", dir_path, e);
                    // Don't fail the entire cleanup for individual directory errors
                }
            }
        }

        Ok(())
    }

    /// Get count of tracked files
    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    /// Get count of tracked directories
    pub fn directory_count(&self) -> usize {
        self.directories.len()
    }

    /// Check if tracker is empty
    pub fn is_empty(&self) -> bool {
        self.files.is_empty() && self.directories.is_empty()
    }
}

/// Create a temporary file and track it
pub async fn create_and_track_temp_file(
    tracker: &mut TempFileTracker,
    prefix: &str,
    extension: &str,
) -> CommandResult<String> {
    let file_path = create_temp_file_path(prefix, extension)?;
    tracker.add_file(file_path.clone());
    Ok(file_path)
}

/// Create a temporary directory and track it
pub async fn create_and_track_temp_dir(
    tracker: &mut TempFileTracker,
    dir_name: &str,
) -> CommandResult<String> {
    let dir_path = create_temp_dir_path(dir_name)?;
    std::fs::create_dir_all(&dir_path).map_err(|e| {
        CommandError::io_error(format!("Failed to create temporary directory: {}", e))
    })?;
    tracker.add_directory(dir_path.clone());
    Ok(dir_path)
}

/// Clean up all temporary files in the temp directory (emergency cleanup)
pub async fn cleanup_all_temp_files() -> CommandResult<()> {
    let temp_dir = get_temp_dir()?;

    if temp_dir.exists() {
        let entries = std::fs::read_dir(&temp_dir)
            .map_err(|e| CommandError::io_error(format!("Failed to read temp directory: {}", e)))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    // Clean up all temporary files (concat, trimmed clips, etc.)
                    if filename.ends_with(".txt") || 
                       filename.starts_with("trimmed_clip_") ||
                       filename.starts_with("temp_") ||
                       filename.starts_with("export_") {
                        if let Err(e) = std::fs::remove_file(&path) {
                            eprintln!("Warning: Failed to delete temp file {}: {}", filename, e);
                        }
                    }
                } else if path.is_dir() {
                    let dirname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    // Clean up temporary directories
                    if dirname.starts_with("temp_") || dirname.starts_with("export_") {
                        if let Err(e) = std::fs::remove_dir_all(&path) {
                            eprintln!("Warning: Failed to delete temp directory {}: {}", dirname, e);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Clean up temporary files older than specified hours
pub async fn cleanup_old_temp_files(max_age_hours: u64) -> CommandResult<()> {
    let temp_dir = get_temp_dir()?;
    let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(max_age_hours as i64);

    if temp_dir.exists() {
        let entries = std::fs::read_dir(&temp_dir)
            .map_err(|e| CommandError::io_error(format!("Failed to read temp directory: {}", e)))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Ok(metadata) = path.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        let modified_time = chrono::DateTime::<chrono::Utc>::from(modified);
                        if modified_time < cutoff_time {
                            if path.is_file() {
                                let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                if filename.ends_with(".txt") || 
                                   filename.starts_with("trimmed_clip_") ||
                                   filename.starts_with("temp_") ||
                                   filename.starts_with("export_") {
                                    if let Err(e) = std::fs::remove_file(&path) {
                                        eprintln!("Warning: Failed to delete old temp file {}: {}", filename, e);
                                    }
                                }
                            } else if path.is_dir() {
                                let dirname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                if dirname.starts_with("temp_") || dirname.starts_with("export_") {
                                    if let Err(e) = std::fs::remove_dir_all(&path) {
                                        eprintln!("Warning: Failed to delete old temp directory {}: {}", dirname, e);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Get temporary file size
pub fn get_temp_file_size(file_path: &str) -> CommandResult<u64> {
    let metadata = std::fs::metadata(file_path)
        .map_err(|e| CommandError::io_error(format!("Failed to get file metadata: {}", e)))?;
    Ok(metadata.len())
}

/// Get total size of all temporary files
pub async fn get_total_temp_files_size() -> CommandResult<u64> {
    let temp_dir = get_temp_dir()?;
    let mut total_size = 0u64;

    if temp_dir.exists() {
        let entries = std::fs::read_dir(&temp_dir)
            .map_err(|e| CommandError::io_error(format!("Failed to read temp directory: {}", e)))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if filename.ends_with(".txt") || 
                       filename.starts_with("trimmed_clip_") ||
                       filename.starts_with("temp_") ||
                       filename.starts_with("export_") {
                        if let Ok(metadata) = path.metadata() {
                            total_size += metadata.len();
                        }
                    }
                }
            }
        }
    }

    Ok(total_size)
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
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 10.0,
                duration: 20.0,
                trim_start: 0.0,
                trim_end: 20.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
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
            track_id: "track1".to_string(),
            trimmed_file_path: None,
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
            track_id: "track1".to_string(),
            trimmed_file_path: None,
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
            track_id: "track1".to_string(),
            trimmed_file_path: None,
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

    // ============================================================================
    // TRIM VALIDATION TESTS
    // ============================================================================

    #[test]
    fn test_validate_trim_data_valid() {
        let result = validate_trim_data(5.0, 10.0, 15.0, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_trim_data_negative_start() {
        let result = validate_trim_data(-1.0, 10.0, 15.0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("negative trim start"));
    }

    #[test]
    fn test_validate_trim_data_invalid_range() {
        let result = validate_trim_data(10.0, 5.0, 15.0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("invalid trim range"));
    }

    #[test]
    fn test_validate_trim_data_end_equals_start() {
        let result = validate_trim_data(5.0, 5.0, 15.0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("invalid trim range"));
    }

    #[test]
    fn test_validate_trim_data_exceeds_duration() {
        let result = validate_trim_data(5.0, 20.0, 15.0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("exceeds original video duration"));
    }

    #[test]
    fn test_validate_trim_data_too_short() {
        let result = validate_trim_data(5.0, 5.05, 15.0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("duration too short"));
    }

    #[test]
    fn test_validate_trim_data_minimum_duration() {
        let result = validate_trim_data(5.0, 5.11, 15.0, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_needs_trimming_true() {
        assert!(needs_trimming(5.0, 10.0, 15.0));
        assert!(needs_trimming(0.0, 10.0, 15.0));
        assert!(needs_trimming(5.0, 15.0, 15.0));
    }

    #[test]
    fn test_needs_trimming_false() {
        assert!(!needs_trimming(0.0, 15.0, 15.0));
        assert!(!needs_trimming(0.01, 14.99, 15.0)); // Within tolerance
    }

    #[test]
    fn test_calculate_trimmed_duration() {
        assert_eq!(calculate_trimmed_duration(5.0, 10.0), 5.0);
        assert_eq!(calculate_trimmed_duration(0.0, 15.0), 15.0);
        assert_eq!(calculate_trimmed_duration(2.5, 7.5), 5.0);
    }

    #[test]
    fn test_validate_export_clips_trim_data_valid() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 5.0,
                duration: 3.0,
                trim_start: 2.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_export_clips_trim_data(&clips);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_export_clips_trim_data_empty() {
        let clips = vec![];
        let result = validate_export_clips_trim_data(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("No clips to export"));
    }

    #[test]
    fn test_validate_export_clips_trim_data_invalid() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: -1.0, // Invalid
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_export_clips_trim_data(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("negative trim start"));
    }

    #[test]
    fn test_get_clips_needing_trimming() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0, // No trimming needed
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 5.0,
                duration: 3.0,
                trim_start: 2.0,
                trim_end: 5.0, // Trimming needed
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 8.0,
                duration: 2.0,
                trim_start: 0.0,
                trim_end: 2.0, // No trimming needed
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let indices = get_clips_needing_trimming(&clips);
        assert_eq!(indices, vec![1]); // Only clip 2 needs trimming
    }

    #[test]
    fn test_get_clips_not_needing_trimming() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0, // No trimming needed
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 5.0,
                duration: 3.0,
                trim_start: 2.0,
                trim_end: 5.0, // Trimming needed
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 8.0,
                duration: 2.0,
                trim_start: 0.0,
                trim_end: 2.0, // No trimming needed
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let indices = get_clips_not_needing_trimming(&clips);
        assert_eq!(indices, vec![0, 2]); // Clips 1 and 3 don't need trimming
    }

    // ============================================================================
    // FFMPEG TRIM FUNCTIONALITY TESTS
    // ============================================================================

    #[test]
    fn test_generate_trim_command_args_with_copy_codec() {
        let args = generate_trim_command_args(
            "input.mp4",
            "output.mp4",
            5.0,
            10.0,
            true, // use_copy_codec
        );

        assert!(args.contains(&"-i".to_string()));
        assert!(args.contains(&"input.mp4".to_string()));
        assert!(args.contains(&"-ss".to_string()));
        assert!(args.contains(&"5.000".to_string()));
        assert!(args.contains(&"-t".to_string()));
        assert!(args.contains(&"10.000".to_string()));
        assert!(args.contains(&"-c".to_string()));
        assert!(args.contains(&"copy".to_string()));
        assert!(args.contains(&"-y".to_string()));
        assert!(args.contains(&"output.mp4".to_string()));
    }

    #[test]
    fn test_generate_trim_command_args_without_copy_codec() {
        let args = generate_trim_command_args(
            "input.mp4",
            "output.mp4",
            5.0,
            10.0,
            false, // use_copy_codec
        );

        assert!(args.contains(&"-i".to_string()));
        assert!(args.contains(&"input.mp4".to_string()));
        assert!(args.contains(&"-ss".to_string()));
        assert!(args.contains(&"5.000".to_string()));
        assert!(args.contains(&"-t".to_string()));
        assert!(args.contains(&"10.000".to_string()));
        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"libx264".to_string()));
        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"aac".to_string()));
        assert!(args.contains(&"-y".to_string()));
        assert!(args.contains(&"output.mp4".to_string()));
    }

    #[test]
    fn test_create_temp_trim_file_path() {
        let result = create_temp_trim_file_path(0, "mp4");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.contains("trimmed_clip_0_"));
        assert!(path.ends_with(".mp4"));
    }

    #[test]
    fn test_get_file_extension() {
        assert_eq!(get_file_extension("video.mp4"), "mp4");
        assert_eq!(get_file_extension("video.MOV"), "mov");
        assert_eq!(get_file_extension("video.avi"), "avi");
        assert_eq!(get_file_extension("video"), "mp4"); // default
        assert_eq!(get_file_extension("video.mkv"), "mkv");
    }

    #[test]
    fn test_supports_copy_codec() {
        assert!(supports_copy_codec("mp4"));
        assert!(supports_copy_codec("mov"));
        assert!(supports_copy_codec("avi"));
        assert!(supports_copy_codec("mkv"));
        assert!(supports_copy_codec("webm"));
        assert!(!supports_copy_codec("wmv"));
        assert!(!supports_copy_codec("flv"));
        assert!(!supports_copy_codec("unknown"));
    }

    #[test]
    fn test_trim_command_precision() {
        let args = generate_trim_command_args(
            "input.mp4",
            "output.mp4",
            1.234567,
            5.678901,
            true,
        );

        // Check that precision is limited to 3 decimal places
        assert!(args.contains(&"1.235".to_string()));
        assert!(args.contains(&"5.679".to_string()));
    }

    // ============================================================================
    // TEMPORARY FILE MANAGEMENT TESTS
    // ============================================================================

    #[test]
    fn test_temp_file_tracker_creation() {
        let tracker = TempFileTracker::new();
        assert!(tracker.is_empty());
        assert_eq!(tracker.file_count(), 0);
        assert_eq!(tracker.directory_count(), 0);
    }

    #[test]
    fn test_temp_file_tracker_add_file() {
        let mut tracker = TempFileTracker::new();
        tracker.add_file("test_file.txt".to_string());
        assert!(!tracker.is_empty());
        assert_eq!(tracker.file_count(), 1);
        assert_eq!(tracker.directory_count(), 0);
    }

    #[test]
    fn test_temp_file_tracker_add_directory() {
        let mut tracker = TempFileTracker::new();
        tracker.add_directory("test_dir".to_string());
        assert!(!tracker.is_empty());
        assert_eq!(tracker.file_count(), 0);
        assert_eq!(tracker.directory_count(), 1);
    }

    #[test]
    fn test_temp_file_tracker_add_multiple() {
        let mut tracker = TempFileTracker::new();
        tracker.add_file("file1.txt".to_string());
        tracker.add_file("file2.txt".to_string());
        tracker.add_directory("dir1".to_string());
        tracker.add_directory("dir2".to_string());
        
        assert!(!tracker.is_empty());
        assert_eq!(tracker.file_count(), 2);
        assert_eq!(tracker.directory_count(), 2);
    }

    #[test]
    fn test_generate_unique_temp_filename() {
        let result1 = generate_unique_temp_filename("test", "txt");
        let result2 = generate_unique_temp_filename("test", "txt");
        
        assert!(result1.is_ok());
        assert!(result2.is_ok());
        
        let filename1 = result1.unwrap();
        let filename2 = result2.unwrap();
        
        // Should be different due to nanosecond precision
        assert_ne!(filename1, filename2);
        
        // Should contain the prefix and extension
        assert!(filename1.contains("test_"));
        assert!(filename1.ends_with(".txt"));
        assert!(filename2.contains("test_"));
        assert!(filename2.ends_with(".txt"));
    }

    #[test]
    fn test_create_temp_file_path() {
        let result = create_temp_file_path("export", "mp4");
        assert!(result.is_ok());
        
        let file_path = result.unwrap();
        assert!(file_path.contains("export_"));
        assert!(file_path.ends_with(".mp4"));
    }

    #[test]
    fn test_create_temp_dir_path() {
        let result = create_temp_dir_path("export");
        assert!(result.is_ok());
        
        let dir_path = result.unwrap();
        assert!(dir_path.contains("export_"));
    }

    #[test]
    fn test_get_temp_file_size() {
        // Create a temporary file for testing
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_size.txt");
        let test_content = "Hello, World!";
        
        std::fs::write(&test_file, test_content).unwrap();
        
        let result = get_temp_file_size(test_file.to_str().unwrap());
        assert!(result.is_ok());
        
        let size = result.unwrap();
        assert_eq!(size, test_content.len() as u64);
        
        // Clean up
        std::fs::remove_file(&test_file).unwrap();
    }

    #[test]
    fn test_get_temp_file_size_nonexistent() {
        let result = get_temp_file_size("/nonexistent/file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_create_temp_trim_file_path_different_index() {
        let result1 = create_temp_trim_file_path(0, "mp4");
        let result2 = create_temp_trim_file_path(1, "mp4");
        
        assert!(result1.is_ok());
        assert!(result2.is_ok());
        
        let path1 = result1.unwrap();
        let path2 = result2.unwrap();
        
        // Should be different due to different indices
        assert_ne!(path1, path2);
        
        // Should contain correct indices
        assert!(path1.contains("trimmed_clip_0_"));
        assert!(path2.contains("trimmed_clip_1_"));
    }

    // ============================================================================
    // TIMELINE ORDER PRESERVATION TESTS
    // ============================================================================

    #[test]
    fn test_sort_clips_by_timeline_position() {
        let clips = vec![
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 20.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let sorted_clips = sort_clips_by_timeline_position(&clips);

        assert_eq!(sorted_clips[0].file_path, "clip1.mp4");
        assert_eq!(sorted_clips[0].start_time, 0.0);
        assert_eq!(sorted_clips[1].file_path, "clip2.mp4");
        assert_eq!(sorted_clips[1].start_time, 10.0);
        assert_eq!(sorted_clips[2].file_path, "clip3.mp4");
        assert_eq!(sorted_clips[2].start_time, 20.0);
    }

    #[test]
    fn test_sort_clips_by_track_and_timeline_position() {
        let clips = vec![
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 20.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track2".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip4.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track2".to_string(),
            trimmed_file_path: None,
        },
        ];

        let sorted_clips = sort_clips_by_track_and_timeline_position(&clips);

        // Should be sorted by track first, then by start time within each track
        assert_eq!(sorted_clips[0].file_path, "clip1.mp4"); // track1, 0.0s
        assert_eq!(sorted_clips[0].track_id, "track1");
        assert_eq!(sorted_clips[1].file_path, "clip2.mp4"); // track1, 10.0s
        assert_eq!(sorted_clips[1].track_id, "track1");
        assert_eq!(sorted_clips[2].file_path, "clip4.mp4"); // track2, 0.0s
        assert_eq!(sorted_clips[2].track_id, "track2");
        assert_eq!(sorted_clips[3].file_path, "clip3.mp4"); // track2, 20.0s
        assert_eq!(sorted_clips[3].track_id, "track2");
    }

    #[test]
    fn test_validate_timeline_chronological_order_valid() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 15.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_chronological_order(&clips);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_timeline_chronological_order_invalid() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 10.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_chronological_order(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("not in chronological order"));
    }

    #[test]
    fn test_check_for_overlapping_clips_no_overlap() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = check_for_overlapping_clips(&clips);
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_for_overlapping_clips_with_overlap() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 5.0, // Overlaps with clip1
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = check_for_overlapping_clips(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Overlapping clips detected"));
    }

    #[test]
    fn test_get_timeline_duration() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let duration = get_timeline_duration(&clips);
        assert_eq!(duration, 15.0); // 10 + 5
    }

    #[test]
    fn test_get_timeline_duration_empty() {
        let clips = vec![];
        let duration = get_timeline_duration(&clips);
        assert_eq!(duration, 0.0);
    }

    #[test]
    fn test_validate_timeline_clips_for_export_valid() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_clips_for_export(&clips);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_timeline_clips_for_export_empty() {
        let clips = vec![];
        let result = validate_timeline_clips_for_export(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("No clips provided"));
    }

    #[test]
    fn test_validate_timeline_clips_for_export_negative_start_time() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: -1.0, // Invalid
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_clips_for_export(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("negative start time"));
    }

    #[test]
    fn test_validate_timeline_clips_for_export_invalid_duration() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 0.0, // Invalid
                trim_start: 0.0,
                trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_clips_for_export(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("invalid duration"));
    }

    #[test]
    fn test_validate_timeline_clips_for_export_out_of_order() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 10.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_clips_for_export(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("not in chronological order"));
    }

    #[test]
    fn test_validate_track_ordering_valid() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 10.0,
            duration: 5.0,
            trim_start: 0.0,
            trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track2".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_track_ordering(&clips);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_track_ordering_invalid() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 10.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = validate_track_ordering(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("not in chronological order"));
    }

    #[test]
    fn test_get_unique_track_ids() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 10.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track2".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip3.mp4".to_string(),
                start_time: 0.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
        ];

        let track_ids = get_unique_track_ids(&clips);
        assert_eq!(track_ids.len(), 2);
        assert!(track_ids.contains(&"track1".to_string()));
        assert!(track_ids.contains(&"track2".to_string()));
    }

    #[test]
    fn test_validate_timeline_clips_for_export_empty_track_id() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
            track_id: "".to_string(), // Empty track ID
            trimmed_file_path: None,
        },
        ];

        let result = validate_timeline_clips_for_export(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("empty track ID"));
    }

    #[test]
    fn test_check_for_overlapping_clips_different_tracks_ok() {
        let clips = vec![
        ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 5.0, // Overlaps with clip1 but on different track
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
            track_id: "track2".to_string(),
            trimmed_file_path: None,
        },
        ];

        let result = check_for_overlapping_clips(&clips);
        assert!(result.is_ok()); // Should be OK since they're on different tracks
    }

    #[test]
    fn test_check_for_overlapping_clips_same_track_error() {
        let clips = vec![
            ExportClip {
                file_path: "clip1.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
                track_id: "track1".to_string(),
                trimmed_file_path: None,
            },
            ExportClip {
                file_path: "clip2.mp4".to_string(),
                start_time: 5.0, // Overlaps with clip1 on same track
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
                track_id: "track1".to_string(),
                trimmed_file_path: None,
            },
        ];

        let result = check_for_overlapping_clips(&clips);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Overlapping clips detected on track"));
    }

    #[test]
    fn test_clip_needs_trimming() {
        // Clip that doesn't need trimming
        let clip_no_trim = ExportClip {
            file_path: "clip1.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        };
        assert!(!clip_needs_trimming(&clip_no_trim));

        // Clip that needs trimming (trim_start > 0)
        let clip_trim_start = ExportClip {
            file_path: "clip2.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 2.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        };
        assert!(clip_needs_trimming(&clip_trim_start));

        // Clip that needs trimming (trim_end < full duration)
        let clip_trim_end = ExportClip {
            file_path: "clip3.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 8.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        };
        assert!(clip_needs_trimming(&clip_trim_end));
    }

    #[test]
    fn test_set_trimmed_file_path() {
        let mut clip = ExportClip {
            file_path: "original.mp4".to_string(),
            start_time: 0.0,
            duration: 10.0,
            trim_start: 0.0,
            trim_end: 10.0,
            track_id: "track1".to_string(),
            trimmed_file_path: None,
        };

        set_trimmed_file_path(&mut clip, "trimmed.mp4".to_string());
        assert_eq!(clip.trimmed_file_path, Some("trimmed.mp4".to_string()));
    }

    #[test]
    fn test_concat_file_generation_with_trimmed_files() {
        let clips = vec![
            ExportClip {
                file_path: "original1.mp4".to_string(),
                start_time: 0.0,
                duration: 10.0,
                trim_start: 0.0,
                trim_end: 10.0,
                track_id: "track1".to_string(),
                trimmed_file_path: Some("trimmed1.mp4".to_string()),
            },
            ExportClip {
                file_path: "original2.mp4".to_string(),
                start_time: 10.0,
                duration: 5.0,
                trim_start: 0.0,
                trim_end: 5.0,
                track_id: "track1".to_string(),
                trimmed_file_path: None, // No trimming
            },
        ];

        // Test that the function uses trimmed files when available
        let result = tokio::runtime::Runtime::new().unwrap().block_on(generate_concat_file(&clips));
        assert!(result.is_ok());
        
        let concat_file_path = result.unwrap();
        let content = std::fs::read_to_string(&concat_file_path).unwrap();
        
        // Should contain trimmed file for first clip, original file for second clip
        assert!(content.contains("file 'trimmed1.mp4'"));
        assert!(content.contains("file 'original2.mp4'"));
        
        // Clean up
        let _ = std::fs::remove_file(&concat_file_path);
    }
}
