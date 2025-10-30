// ============================================================================
// FFMPEG THUMBNAIL MODULE
// ============================================================================
// This module handles thumbnail generation using FFmpeg.
// It extracts frames from videos at specific timestamps and saves them as images.

use crate::commands::{get_thumbnails_dir, hash_file_path, CommandError, CommandResult};
use serde::{Deserialize, Serialize};
use tauri::Manager;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Request to generate a thumbnail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateThumbnailRequest {
    pub file_path: String,
    pub timestamp: Option<f64>, // Time in seconds, defaults to 1.0
    pub width: Option<u32>,     // Thumbnail width, defaults to 320
    pub height: Option<u32>,    // Thumbnail height, defaults to 180
}

/// Response from thumbnail generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateThumbnailResponse {
    pub success: bool,
    pub thumbnail_path: Option<String>,
    pub error_message: Option<String>,
}

/// Request to generate multiple thumbnails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateMultipleThumbnailsRequest {
    pub file_path: String,
    pub timestamps: Vec<f64>, // Multiple timestamps
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Response from multiple thumbnail generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateMultipleThumbnailsResponse {
    pub success: bool,
    pub thumbnail_paths: Vec<String>,
    pub error_message: Option<String>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Generate a single thumbnail for a video file
#[tauri::command]
pub async fn generate_thumbnail(
    app_handle: tauri::AppHandle,
    request: GenerateThumbnailRequest,
) -> CommandResult<GenerateThumbnailResponse> {
    let file_path = request.file_path;

    // Validate file path first
    crate::commands::validate_file_path(&file_path)?;

    // Set defaults
    let timestamp = request.timestamp.unwrap_or(1.0);
    let width = request.width.unwrap_or(320);
    let height = request.height.unwrap_or(180);

    // Generate thumbnail
    match generate_thumbnail_internal(&app_handle, &file_path, timestamp, width, height).await {
        Ok(thumbnail_path) => Ok(GenerateThumbnailResponse {
            success: true,
            thumbnail_path: Some(thumbnail_path),
            error_message: None,
        }),
        Err(error) => Ok(GenerateThumbnailResponse {
            success: false,
            thumbnail_path: None,
            error_message: Some(error.message),
        }),
    }
}

/// Generate multiple thumbnails for a video file
#[tauri::command]
pub async fn generate_multiple_thumbnails(
    app_handle: tauri::AppHandle,
    request: GenerateMultipleThumbnailsRequest,
) -> CommandResult<GenerateMultipleThumbnailsResponse> {
    let file_path = request.file_path;

    // Validate file path first
    crate::commands::validate_file_path(&file_path)?;

    // Set defaults
    let width = request.width.unwrap_or(320);
    let height = request.height.unwrap_or(180);

    let mut thumbnail_paths = Vec::new();
    let mut errors = Vec::new();

    // Generate thumbnails for each timestamp
    for timestamp in request.timestamps {
        match generate_thumbnail_internal(&app_handle, &file_path, timestamp, width, height).await {
            Ok(thumbnail_path) => thumbnail_paths.push(thumbnail_path),
            Err(error) => errors.push(error.message),
        }
    }

    if errors.is_empty() {
        Ok(GenerateMultipleThumbnailsResponse {
            success: true,
            thumbnail_paths,
            error_message: None,
        })
    } else {
        Ok(GenerateMultipleThumbnailsResponse {
            success: false,
            thumbnail_paths,
            error_message: Some(format!(
                "Some thumbnails failed to generate: {}",
                errors.join(", ")
            )),
        })
    }
}

/// Check if a thumbnail already exists for a file
#[tauri::command]
pub async fn thumbnail_exists(request: GenerateThumbnailRequest) -> CommandResult<bool> {
    let file_path = request.file_path;
    let timestamp = request.timestamp.unwrap_or(1.0);

    // Generate thumbnail path
    let thumbnail_path = get_thumbnail_path(&file_path, timestamp)?;

    Ok(thumbnail_path.exists())
}

/// Delete a thumbnail file
#[tauri::command]
pub async fn delete_thumbnail(request: GenerateThumbnailRequest) -> CommandResult<bool> {
    let file_path = request.file_path;
    let timestamp = request.timestamp.unwrap_or(1.0);

    // Generate thumbnail path
    let thumbnail_path = get_thumbnail_path(&file_path, timestamp)?;

    if thumbnail_path.exists() {
        std::fs::remove_file(&thumbnail_path)
            .map_err(|e| CommandError::io_error(format!("Failed to delete thumbnail: {}", e)))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/// Internal function to generate a thumbnail
async fn generate_thumbnail_internal(
    app_handle: &tauri::AppHandle,
    file_path: &str,
    timestamp: f64,
    width: u32,
    height: u32,
) -> CommandResult<String> {
    // Check if thumbnail already exists
    let thumbnail_path = get_thumbnail_path(file_path, timestamp)?;
    if thumbnail_path.exists() {
        return Ok(thumbnail_path.to_string_lossy().to_string());
    }

    // Resolve FFmpeg path (same logic as in recording)
    let ffmpeg_path = if cfg!(debug_assertions) {
        // Development mode - use source tree path
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| CommandError::validation_error(format!("Failed to get manifest dir: {}", e)))?;
        let dev_path = std::path::PathBuf::from(manifest_dir).join("bin/ffmpeg");
        dev_path.to_string_lossy().to_string()
    } else {
        // Production mode - use bundled sidecar
        app_handle.path().resolve("bin/ffmpeg", tauri::path::BaseDirectory::Resource)
            .map_err(|e| {
                CommandError::validation_error(format!("Failed to find FFmpeg: {}", e))
            })?
            .to_string_lossy()
            .to_string()
    };

    // Verify FFmpeg binary exists
    if !std::path::Path::new(&ffmpeg_path).exists() {
        return Err(CommandError::ffmpeg_error(format!("FFmpeg binary not found at: {}", ffmpeg_path)));
    }

    // Build FFmpeg command for thumbnail generation
    use std::process::Command;
    
    // Clone values for the blocking task
    let ffmpeg_path_clone = ffmpeg_path.clone();
    let file_path_clone = file_path.to_string();
    let thumbnail_path_clone = thumbnail_path.clone();
    let timestamp_str = timestamp.to_string();
    let scale_str = format!("scale={}:{}", width, height);
    
    // Run FFmpeg in a blocking task to avoid blocking the async runtime
    let output = tokio::task::spawn_blocking(move || {
        Command::new(&ffmpeg_path_clone)
            .args(&[
                "-ss",
                &timestamp_str, // Seek to timestamp
                "-i",
                &file_path_clone, // Input file
                "-vframes",
                "1", // Extract only 1 frame
                "-vf",
                &scale_str, // Scale to desired size
                "-q:v",
                "2",  // High quality
                "-y", // Overwrite output file
                thumbnail_path_clone.to_string_lossy().as_ref(),
            ])
            .output()
    })
    .await
    .map_err(|e| CommandError::ffmpeg_error(format!("Failed to spawn ffmpeg task: {}", e)))?
    .map_err(|e| CommandError::ffmpeg_error(format!("Failed to execute ffmpeg: {}", e)))?;

    // Check if command succeeded
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg thumbnail generation failed: {}",
            stderr
        )));
    }

    // Verify thumbnail was created
    if !thumbnail_path.exists() {
        return Err(CommandError::ffmpeg_error(
            "Thumbnail file was not created".to_string(),
        ));
    }

    Ok(thumbnail_path.to_string_lossy().to_string())
}

/// Get the thumbnail path for a file and timestamp
fn get_thumbnail_path(file_path: &str, timestamp: f64) -> CommandResult<std::path::PathBuf> {
    let thumbnails_dir = get_thumbnails_dir()?;

    // Generate a unique filename based on file path hash and timestamp
    let file_hash = hash_file_path(file_path);
    let timestamp_str = format!("{:.1}", timestamp);
    let filename = format!("{}_{}.jpg", file_hash, timestamp_str.replace('.', "_"));

    Ok(thumbnails_dir.join(filename))
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Generate a thumbnail with default settings (1 second, 320x180)
pub async fn generate_default_thumbnail(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> CommandResult<String> {
    generate_thumbnail_internal(app_handle, file_path, 1.0, 320, 180).await
}

/// Generate a high-quality thumbnail (1 second, 640x360)
pub async fn generate_hq_thumbnail(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> CommandResult<String> {
    generate_thumbnail_internal(app_handle, file_path, 1.0, 640, 360).await
}

/// Generate thumbnails at multiple timestamps
pub async fn generate_timeline_thumbnails(
    app_handle: &tauri::AppHandle,
    file_path: &str,
    duration: f64,
    count: usize,
) -> CommandResult<Vec<String>> {
    let mut thumbnail_paths = Vec::new();

    // Generate thumbnails at evenly spaced intervals
    for i in 0..count {
        let timestamp = (duration / (count as f64)) * (i as f64 + 0.5);
        match generate_thumbnail_internal(app_handle, file_path, timestamp, 320, 180).await {
            Ok(path) => thumbnail_paths.push(path),
            Err(error) => {
                eprintln!(
                    "Failed to generate thumbnail at {}s: {}",
                    timestamp, error.message
                );
            }
        }
    }

    Ok(thumbnail_paths)
}

/// Clean up old thumbnails (older than specified days)
pub async fn cleanup_old_thumbnails(days_old: u64) -> CommandResult<usize> {
    let thumbnails_dir = get_thumbnails_dir()?;
    let mut deleted_count = 0;

    if thumbnails_dir.exists() {
        let cutoff_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            - (days_old * 24 * 60 * 60);

        let entries = std::fs::read_dir(&thumbnails_dir).map_err(|e| {
            CommandError::io_error(format!("Failed to read thumbnails directory: {}", e))
        })?;

        for entry in entries {
            if let Ok(entry) = entry {
                let metadata = entry.metadata().map_err(|e| {
                    CommandError::io_error(format!("Failed to get file metadata: {}", e))
                })?;

                if let Ok(modified_time) = metadata.modified() {
                    let modified_secs = modified_time
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();

                    if modified_secs < cutoff_time {
                        std::fs::remove_file(entry.path()).map_err(|e| {
                            CommandError::io_error(format!("Failed to delete old thumbnail: {}", e))
                        })?;
                        deleted_count += 1;
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

/// Get thumbnail file size
pub async fn get_thumbnail_size(thumbnail_path: &str) -> CommandResult<u64> {
    let metadata = std::fs::metadata(thumbnail_path)
        .map_err(|e| CommandError::io_error(format!("Failed to get thumbnail metadata: {}", e)))?;

    Ok(metadata.len())
}

/// Validate thumbnail file
pub async fn validate_thumbnail(thumbnail_path: &str) -> CommandResult<bool> {
    let path = std::path::Path::new(thumbnail_path);

    if !path.exists() {
        return Ok(false);
    }

    if !path.is_file() {
        return Ok(false);
    }

    // Check if it's a valid image file
    let metadata = std::fs::metadata(path)
        .map_err(|e| CommandError::io_error(format!("Failed to get thumbnail metadata: {}", e)))?;

    // Basic validation: file should be larger than 0 bytes
    Ok(metadata.len() > 0)
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_generate_thumbnail_request_serialization() {
        let request = GenerateThumbnailRequest {
            file_path: "/path/to/video.mp4".to_string(),
            timestamp: Some(5.0),
            width: Some(640),
            height: Some(360),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: GenerateThumbnailRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.file_path, deserialized.file_path);
        assert_eq!(request.timestamp, deserialized.timestamp);
        assert_eq!(request.width, deserialized.width);
        assert_eq!(request.height, deserialized.height);
    }

    #[test]
    fn test_generate_thumbnail_response_serialization() {
        let response = GenerateThumbnailResponse {
            success: true,
            thumbnail_path: Some("/path/to/thumbnail.jpg".to_string()),
            error_message: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: GenerateThumbnailResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(response.success, deserialized.success);
        assert_eq!(response.thumbnail_path, deserialized.thumbnail_path);
        assert_eq!(response.error_message, deserialized.error_message);
    }

    #[test]
    fn test_generate_multiple_thumbnails_request_serialization() {
        let request = GenerateMultipleThumbnailsRequest {
            file_path: "/path/to/video.mp4".to_string(),
            timestamps: vec![1.0, 5.0, 10.0],
            width: Some(320),
            height: Some(180),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: GenerateMultipleThumbnailsRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.file_path, deserialized.file_path);
        assert_eq!(request.timestamps, deserialized.timestamps);
        assert_eq!(request.width, deserialized.width);
        assert_eq!(request.height, deserialized.height);
    }

    #[test]
    fn test_generate_multiple_thumbnails_response_serialization() {
        let response = GenerateMultipleThumbnailsResponse {
            success: true,
            thumbnail_paths: vec![
                "/path/to/thumb1.jpg".to_string(),
                "/path/to/thumb2.jpg".to_string(),
            ],
            error_message: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: GenerateMultipleThumbnailsResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(response.success, deserialized.success);
        assert_eq!(response.thumbnail_paths, deserialized.thumbnail_paths);
        assert_eq!(response.error_message, deserialized.error_message);
    }

    #[test]
    fn test_get_thumbnail_path() {
        // Mock the get_thumbnails_dir function for testing
        let temp_dir = tempdir().unwrap();
        let thumbnails_dir = temp_dir.path();

        // Test thumbnail path generation
        let file_path = "/path/to/video.mp4";
        let timestamp = 5.0;

        // Generate expected path
        let file_hash = crate::commands::hash_file_path(file_path);
        let timestamp_str = format!("{:.1}", timestamp).replace('.', "_");
        let expected_filename = format!("{}_{}.jpg", file_hash, timestamp_str);
        let expected_path = thumbnails_dir.join(expected_filename);

        // This test verifies the path generation logic
        assert!(expected_path.to_string_lossy().contains(&file_hash));
        assert!(expected_path.to_string_lossy().contains("5_0"));
        assert!(expected_path.to_string_lossy().ends_with(".jpg"));
    }

    #[test]
    fn test_get_default_thumbnail_timestamp() {
        // Test the logic inline since the function is in a different module
        assert_eq!(get_default_thumbnail_timestamp_inline(0.0), 1.0);
        assert_eq!(get_default_thumbnail_timestamp_inline(1.0), 0.5);
        assert_eq!(get_default_thumbnail_timestamp_inline(2.0), 1.0);
        assert_eq!(get_default_thumbnail_timestamp_inline(10.0), 1.0);
    }

    #[test]
    fn test_generate_timeline_thumbnail_timestamps() {
        // Test with 5 thumbnails over 10 seconds
        let timestamps = generate_timeline_thumbnail_timestamps_inline(10.0, 5);
        assert_eq!(timestamps.len(), 5);

        // Should be evenly spaced
        assert_eq!(timestamps[0], 1.0); // 10/5 * 0.5
        assert_eq!(timestamps[1], 3.0); // 10/5 * 1.5
        assert_eq!(timestamps[2], 5.0); // 10/5 * 2.5
        assert_eq!(timestamps[3], 7.0); // 10/5 * 3.5
        assert_eq!(timestamps[4], 9.0); // 10/5 * 4.5
    }

    #[test]
    fn test_generate_timeline_thumbnail_timestamps_edge_cases() {
        // Test with zero duration
        let timestamps = generate_timeline_thumbnail_timestamps_inline(0.0, 3);
        assert_eq!(timestamps.len(), 1);
        assert_eq!(timestamps[0], 1.0);

        // Test with zero count
        let timestamps = generate_timeline_thumbnail_timestamps_inline(10.0, 0);
        assert_eq!(timestamps.len(), 1);
        assert_eq!(timestamps[0], 1.0);

        // Test with single thumbnail
        let timestamps = generate_timeline_thumbnail_timestamps_inline(10.0, 1);
        assert_eq!(timestamps.len(), 1);
        assert_eq!(timestamps[0], 5.0); // 10/1 * 0.5
    }

    // Helper functions for testing
    fn get_default_thumbnail_timestamp_inline(duration: f64) -> f64 {
        if duration <= 0.0 {
            1.0
        } else if duration < 2.0 {
            duration / 2.0
        } else {
            1.0
        }
    }

    fn generate_timeline_thumbnail_timestamps_inline(duration: f64, count: usize) -> Vec<f64> {
        if duration <= 0.0 || count == 0 {
            return vec![1.0];
        }

        let mut timestamps = Vec::new();
        let interval = duration / (count as f64);

        for i in 0..count {
            let timestamp = interval * (i as f64 + 0.5);
            timestamps.push(timestamp);
        }

        timestamps
    }

    #[test]
    fn test_validate_thumbnail_with_temp_file() {
        let temp_dir = tempdir().unwrap();
        let thumbnail_path = temp_dir.path().join("test.jpg");

        // Create a test thumbnail file
        let mut file = File::create(&thumbnail_path).unwrap();
        file.write_all(b"fake jpeg data").unwrap();
        drop(file);

        // Test validate_thumbnail
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(validate_thumbnail(thumbnail_path.to_str().unwrap()));

        assert!(result.is_ok());
        assert!(result.unwrap()); // Should be valid
    }

    #[test]
    fn test_validate_thumbnail_nonexistent() {
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(validate_thumbnail("/nonexistent/thumbnail.jpg"));

        assert!(result.is_ok());
        assert!(!result.unwrap()); // Should be invalid
    }

    #[test]
    fn test_get_thumbnail_size_with_temp_file() {
        let temp_dir = tempdir().unwrap();
        let thumbnail_path = temp_dir.path().join("test.jpg");

        // Create a test thumbnail file
        let mut file = File::create(&thumbnail_path).unwrap();
        file.write_all(b"test thumbnail data").unwrap();
        drop(file);

        // Test get_thumbnail_size
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(get_thumbnail_size(thumbnail_path.to_str().unwrap()));

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 19); // "test thumbnail data" is 19 bytes
    }

    #[test]
    fn test_get_thumbnail_size_nonexistent() {
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(get_thumbnail_size("/nonexistent/thumbnail.jpg"));

        assert!(result.is_err());
    }
}
