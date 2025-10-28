// ============================================================================
// METADATA COMMANDS
// ============================================================================
// This module provides Tauri commands for video metadata extraction
// and thumbnail generation, acting as a bridge between the frontend
// and the FFmpeg modules.

use crate::commands::{CommandResult, CommandError};
use crate::ffmpeg::probe::{extract_video_metadata, ExtractMetadataRequest, ExtractMetadataResponse};
use crate::ffmpeg::thumbnail::{
    generate_thumbnail, generate_multiple_thumbnails, thumbnail_exists, delete_thumbnail,
    GenerateThumbnailRequest, GenerateThumbnailResponse,
    GenerateMultipleThumbnailsRequest, GenerateMultipleThumbnailsResponse,
};
use serde::{Deserialize, Serialize};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Request to import a video file with metadata extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVideoWithMetadataRequest {
    pub file_path: String,
    pub extract_metadata: bool,
    pub generate_thumbnail: bool,
    pub thumbnail_timestamp: Option<f64>,
}

/// Response from video import with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVideoWithMetadataResponse {
    pub success: bool,
    pub file_path: String,
    pub metadata: Option<crate::ffmpeg::probe::VideoMetadata>,
    pub thumbnail_path: Option<String>,
    pub error_message: Option<String>,
}

/// Request to get video metadata only
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetVideoMetadataRequest {
    pub file_path: String,
}

/// Request to generate thumbnail only
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateThumbnailOnlyRequest {
    pub file_path: String,
    pub timestamp: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Request to check thumbnail existence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckThumbnailRequest {
    pub file_path: String,
    pub timestamp: Option<f64>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Import a video file with metadata extraction and thumbnail generation
#[tauri::command]
pub async fn import_video_with_metadata(
    app_handle: tauri::AppHandle,
    request: ImportVideoWithMetadataRequest,
) -> CommandResult<ImportVideoWithMetadataResponse> {
    let file_path = request.file_path.clone();
    
    // Validate file path first
    crate::commands::validate_file_path(&file_path)?;
    
    let mut metadata = None;
    let mut thumbnail_path = None;
    let mut error_message = None;
    
    // Extract metadata if requested
    if request.extract_metadata {
        match extract_video_metadata(app_handle.clone(), ExtractMetadataRequest {
            file_path: file_path.clone(),
        }).await {
            Ok(response) => {
                if response.success {
                    metadata = response.metadata;
                } else {
                    error_message = response.error_message;
                }
            }
            Err(error) => {
                error_message = Some(error.message);
            }
        }
    }
    
    // Generate thumbnail if requested and no error occurred
    if request.generate_thumbnail && error_message.is_none() {
        match generate_thumbnail(app_handle.clone(), GenerateThumbnailRequest {
            file_path: file_path.clone(),
            timestamp: request.thumbnail_timestamp,
            width: None,
            height: None,
        }).await {
            Ok(response) => {
                if response.success {
                    thumbnail_path = response.thumbnail_path;
                } else if error_message.is_none() {
                    error_message = response.error_message;
                }
            }
            Err(error) => {
                if error_message.is_none() {
                    error_message = Some(error.message);
                }
            }
        }
    }
    
    let success = error_message.is_none();
    
    Ok(ImportVideoWithMetadataResponse {
        success,
        file_path,
        metadata,
        thumbnail_path,
        error_message,
    })
}

/// Get video metadata only
#[tauri::command]
pub async fn get_video_metadata(
    app_handle: tauri::AppHandle,
    request: GetVideoMetadataRequest,
) -> CommandResult<ExtractMetadataResponse> {
    extract_video_metadata(app_handle, ExtractMetadataRequest {
        file_path: request.file_path,
    }).await
}

/// Generate thumbnail only
#[tauri::command]
pub async fn generate_video_thumbnail(
    app_handle: tauri::AppHandle,
    request: GenerateThumbnailOnlyRequest,
) -> CommandResult<GenerateThumbnailResponse> {
    generate_thumbnail(app_handle, GenerateThumbnailRequest {
        file_path: request.file_path,
        timestamp: request.timestamp,
        width: request.width,
        height: request.height,
    }).await
}

/// Generate multiple thumbnails for a video
#[tauri::command]
pub async fn generate_video_thumbnails(
    app_handle: tauri::AppHandle,
    request: GenerateMultipleThumbnailsRequest,
) -> CommandResult<GenerateMultipleThumbnailsResponse> {
    generate_multiple_thumbnails(app_handle, request).await
}

/// Check if thumbnail exists
#[tauri::command]
pub async fn check_thumbnail_exists(
    request: CheckThumbnailRequest,
) -> CommandResult<bool> {
    thumbnail_exists(GenerateThumbnailRequest {
        file_path: request.file_path,
        timestamp: request.timestamp,
        width: None,
        height: None,
    }).await
}

/// Delete a thumbnail
#[tauri::command]
pub async fn delete_video_thumbnail(
    request: GenerateThumbnailOnlyRequest,
) -> CommandResult<bool> {
    delete_thumbnail(GenerateThumbnailRequest {
        file_path: request.file_path,
        timestamp: request.timestamp,
        width: request.width,
        height: request.height,
    }).await
}

/// Batch import multiple video files
#[tauri::command]
pub async fn batch_import_videos(
    app_handle: tauri::AppHandle,
    file_paths: Vec<String>,
) -> CommandResult<Vec<ImportVideoWithMetadataResponse>> {
    let mut results = Vec::new();
    
    for file_path in file_paths {
        let request = ImportVideoWithMetadataRequest {
            file_path: file_path.clone(),
            extract_metadata: true,
            generate_thumbnail: true,
            thumbnail_timestamp: Some(1.0),
        };
        
        match import_video_with_metadata(app_handle.clone(), request).await {
            Ok(response) => results.push(response),
            Err(error) => {
                results.push(ImportVideoWithMetadataResponse {
                    success: false,
                    file_path,
                    metadata: None,
                    thumbnail_path: None,
                    error_message: Some(error.message),
                });
            }
        }
    }
    
    Ok(results)
}

/// Get FFmpeg version information
#[tauri::command]
pub async fn get_ffmpeg_version(
    app_handle: tauri::AppHandle,
) -> CommandResult<String> {
    crate::ffmpeg::probe::get_ffmpeg_version(&app_handle).await
}

/// Check FFmpeg availability
#[tauri::command]
pub async fn check_ffmpeg_availability(
    app_handle: tauri::AppHandle,
) -> CommandResult<bool> {
    crate::ffmpeg::probe::check_ffmpeg_probe_availability(&app_handle).await
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Validate video file format using FFmpeg
pub async fn validate_video_format(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> CommandResult<bool> {
    crate::ffmpeg::probe::validate_video_format(app_handle, file_path).await
}

/// Get default thumbnail timestamp based on video duration
pub fn get_default_thumbnail_timestamp(duration: f64) -> f64 {
    if duration <= 0.0 {
        1.0
    } else if duration < 2.0 {
        duration / 2.0
    } else {
        1.0
    }
}

/// Generate thumbnail timestamps for timeline preview
pub fn generate_timeline_thumbnail_timestamps(duration: f64, count: usize) -> Vec<f64> {
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

/// Check if file is a video format
pub fn is_video_file(file_path: &str) -> bool {
    crate::commands::is_supported_video_format(file_path)
}

/// Get file information for display
pub async fn get_file_display_info(file_path: &str) -> CommandResult<FileDisplayInfo> {
    let metadata = std::fs::metadata(file_path)
        .map_err(|e| CommandError::io_error(format!("Failed to get file metadata: {}", e)))?;
    
    let filename = std::path::Path::new(file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    Ok(FileDisplayInfo {
        filename,
        extension,
        file_size: metadata.len(),
        is_video: is_video_file(file_path),
        created: metadata.created().ok(),
        modified: metadata.modified().ok(),
    })
}

/// File display information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDisplayInfo {
    pub filename: String,
    pub extension: String,
    pub file_size: u64,
    pub is_video: bool,
    pub created: Option<std::time::SystemTime>,
    pub modified: Option<std::time::SystemTime>,
}
