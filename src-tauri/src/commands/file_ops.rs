// ============================================================================
// FILE OPERATIONS COMMANDS
// ============================================================================
// This module handles file import operations, including validation,
// file system operations, and integration with the media store.

use crate::commands::{CommandResult, CommandError, validate_file_path, is_supported_video_format, get_file_size};
use crate::ffmpeg::probe::{extract_video_metadata, ExtractMetadataRequest, VideoMetadata};
use crate::ffmpeg::thumbnail::{generate_thumbnail, GenerateThumbnailRequest};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;
use chrono;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Request to import a video file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVideoRequest {
    pub file_path: String,
}

/// Response from video import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVideoResponse {
    pub clip: MediaClip,
    pub metadata: VideoMetadata,
    pub thumbnail_path: String,
}

/// MediaClip represents a video clip in the media library
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaClip {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub metadata: VideoMetadata,
    pub thumbnail_path: String,
    pub created_at: String,
}

/// Create a new MediaClip instance
pub fn create_media_clip(
    id: String,
    filename: String,
    filepath: String,
    metadata: VideoMetadata,
    thumbnail_path: String,
) -> MediaClip {
    MediaClip {
        id,
        filename,
        filepath,
        metadata,
        thumbnail_path,
        created_at: chrono::Utc::now().to_rfc3339(),
    }
}

/// Request to validate a file path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateFileRequest {
    pub file_path: String,
}

/// Response from file validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateFileResponse {
    pub is_valid: bool,
    pub is_supported: bool,
    pub file_size: u64,
    pub error_message: Option<String>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Import a video file into the application
/// This command validates the file, extracts metadata, generates thumbnails, and creates a MediaClip
#[tauri::command]
pub async fn import_video_file(
    app_handle: tauri::AppHandle,
    request: ImportVideoRequest,
) -> CommandResult<ImportVideoResponse> {
    let file_path = request.file_path;
    
    // Validate file path
    validate_file_path(&file_path)?;
    
    // Check if file is a supported video format
    if !is_supported_video_format(&file_path) {
        return Err(CommandError::unsupported_format(
            format!("Unsupported video format: {}", file_path)
        ));
    }
    
    // Get file size
    let file_size = get_file_size(&file_path)?;
    
    // Check file size limit (100MB for MVP)
    const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100MB
    if file_size > MAX_FILE_SIZE {
        return Err(CommandError::validation_error(
            format!("File too large: {}MB (max: 100MB)", file_size / (1024 * 1024))
        ));
    }
    
    // Extract video metadata using FFmpeg
    let metadata_response = extract_video_metadata(
        app_handle.clone(),
        ExtractMetadataRequest {
            file_path: file_path.clone(),
        }
    ).await?;
    
    let metadata = metadata_response.metadata
        .ok_or_else(|| CommandError::ffmpeg_error("Failed to extract video metadata".to_string()))?;
    
    // Generate thumbnail
    let thumbnail_response = generate_thumbnail(
        app_handle.clone(),
        GenerateThumbnailRequest {
            file_path: file_path.clone(),
            timestamp: Some(1.0), // Extract frame at 1 second
            width: Some(320),
            height: Some(180),
        }
    ).await?;
    
    // Extract thumbnail path
    let thumbnail_path = thumbnail_response.thumbnail_path
        .ok_or_else(|| CommandError::ffmpeg_error("Failed to generate thumbnail".to_string()))?;
    
    // Get filename from path
    let filename = Path::new(&file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    // Create MediaClip
    let clip = create_media_clip(
        Uuid::new_v4().to_string(),
        filename.clone(),
        file_path.clone(),
        metadata.clone(),
        thumbnail_path.clone(),
    );
    
    Ok(ImportVideoResponse {
        clip,
        metadata,
        thumbnail_path,
    })
}

/// Validate a file path and return information about it
#[tauri::command]
pub async fn validate_file(
    request: ValidateFileRequest,
) -> CommandResult<ValidateFileResponse> {
    let file_path = request.file_path;
    
    // Try to validate the file
    match validate_file_path(&file_path) {
        Ok(_) => {
            let is_supported = is_supported_video_format(&file_path);
            let file_size = get_file_size(&file_path).unwrap_or(0);
            
            Ok(ValidateFileResponse {
                is_valid: true,
                is_supported,
                file_size,
                error_message: None,
            })
        }
        Err(error) => {
            Ok(ValidateFileResponse {
                is_valid: false,
                is_supported: false,
                file_size: 0,
                error_message: Some(error.message),
            })
        }
    }
}

/// Get information about a file without importing it
#[tauri::command]
pub async fn get_file_info(
    request: ValidateFileRequest,
) -> CommandResult<ValidateFileResponse> {
    validate_file(request).await
}

/// Clean up temporary files
#[tauri::command]
pub async fn cleanup_files() -> CommandResult<()> {
    crate::commands::cleanup_temp_files()
}

/// Get the application data directory path
#[tauri::command]
pub async fn get_app_data_directory() -> CommandResult<String> {
    let app_data_dir = crate::commands::get_app_data_dir()?;
    Ok(app_data_dir.to_string_lossy().to_string())
}

/// Get the thumbnails directory path
#[tauri::command]
pub async fn get_thumbnails_directory() -> CommandResult<String> {
    let thumbnails_dir = crate::commands::get_thumbnails_dir()?;
    Ok(thumbnails_dir.to_string_lossy().to_string())
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Check if a file is already imported (by file path)
pub fn is_file_already_imported(_file_path: &str) -> bool {
    // This would typically check against the media store
    // For now, we'll implement this as a placeholder
    // In a real implementation, this would query the frontend store
    false
}

/// Get file extension from path
pub fn get_file_extension(file_path: &str) -> Option<String> {
    std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

/// Get filename without extension
pub fn get_filename_without_extension(file_path: &str) -> Option<String> {
    std::path::Path::new(file_path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(|stem| stem.to_string())
}

/// Get filename with extension
pub fn get_filename_with_extension(file_path: &str) -> Option<String> {
    std::path::Path::new(file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
}

/// Convert file size to human readable format
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

/// Check if file path is absolute
pub fn is_absolute_path(file_path: &str) -> bool {
    std::path::Path::new(file_path).is_absolute()
}

/// Resolve relative path to absolute path
pub fn resolve_absolute_path(file_path: &str) -> CommandResult<String> {
    let path = std::path::Path::new(file_path);
    
    if path.is_absolute() {
        Ok(file_path.to_string())
    } else {
        // Convert to absolute path
        let current_dir = std::env::current_dir()
            .map_err(|e| CommandError::io_error(format!("Failed to get current directory: {}", e)))?;
        
        let absolute_path = current_dir.join(path);
        
        Ok(absolute_path.to_string_lossy().to_string())
    }
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
    fn test_import_video_request_serialization() {
        let request = ImportVideoRequest {
            file_path: "/path/to/video.mp4".to_string(),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ImportVideoRequest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(request.file_path, deserialized.file_path);
    }

    #[test]
    fn test_import_video_response_serialization() {
        let response = ImportVideoResponse {
            success: true,
            message: "Success".to_string(),
            file_path: "/path/to/video.mp4".to_string(),
        };
        
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: ImportVideoResponse = serde_json::from_str(&json).unwrap();
        
        assert_eq!(response.success, deserialized.success);
        assert_eq!(response.message, deserialized.message);
        assert_eq!(response.file_path, deserialized.file_path);
    }

    #[test]
    fn test_validate_file_request_serialization() {
        let request = ValidateFileRequest {
            file_path: "/path/to/video.mp4".to_string(),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ValidateFileRequest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(request.file_path, deserialized.file_path);
    }

    #[test]
    fn test_validate_file_response_serialization() {
        let response = ValidateFileResponse {
            is_valid: true,
            is_supported: true,
            file_size: 1024,
            error_message: None,
        };
        
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: ValidateFileResponse = serde_json::from_str(&json).unwrap();
        
        assert_eq!(response.is_valid, deserialized.is_valid);
        assert_eq!(response.is_supported, deserialized.is_supported);
        assert_eq!(response.file_size, deserialized.file_size);
        assert_eq!(response.error_message, deserialized.error_message);
    }

    #[test]
    fn test_is_file_already_imported() {
        // This is a placeholder test since the function is not fully implemented
        assert!(!is_file_already_imported("/path/to/video.mp4"));
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(0), "0 B");
        assert_eq!(format_file_size(1023), "1023 B");
        assert_eq!(format_file_size(1024), "1.0 KB");
        assert_eq!(format_file_size(1536), "1.5 KB");
        assert_eq!(format_file_size(1048576), "1.0 MB");
        assert_eq!(format_file_size(1073741824), "1.0 GB");
    }

    #[test]
    fn test_resolve_absolute_path() {
        // Test absolute path
        let absolute_path = "/absolute/path/video.mp4";
        let result = resolve_absolute_path(absolute_path).unwrap();
        assert_eq!(result, absolute_path);
        
        // Test relative path
        let relative_path = "relative/video.mp4";
        let result = resolve_absolute_path(relative_path).unwrap();
        assert!(result.contains("relative/video.mp4"));
        assert!(result.starts_with('/'));
    }

    #[test]
    fn test_get_file_size_with_temp_file() {
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        
        // Create a test file
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test content").unwrap();
        drop(file);
        
        // Test get_file_size
        let size = get_file_size(file_path.to_str().unwrap()).unwrap();
        assert_eq!(size, 12); // "test content" is 12 bytes
    }

    #[test]
    fn test_get_file_size_nonexistent() {
        let result = get_file_size("/nonexistent/file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_file_path_with_temp_file() {
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        
        // Create a test file
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test content").unwrap();
        drop(file);
        
        // Test validate_file_path
        let result = validate_file_path(file_path.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_file_path_nonexistent() {
        let result = validate_file_path("/nonexistent/file.txt");
        assert!(result.is_err());
        
        if let Err(error) = result {
            assert_eq!(error.error_type, "validation_error");
            assert!(error.message.contains("File does not exist"));
        }
    }

    #[test]
    fn test_validate_file_path_directory() {
        let temp_dir = tempdir().unwrap();
        let result = validate_file_path(temp_dir.path().to_str().unwrap());
        assert!(result.is_err());
        
        if let Err(error) = result {
            assert_eq!(error.error_type, "validation_error");
            assert!(error.message.contains("Path is not a file"));
        }
    }
}
