use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use uuid::Uuid;

use crate::commands::{
    get_file_size, get_filename_with_extension, is_supported_video_format, validate_file_path,
    CommandError, CommandResult, Project,
};
use crate::ffmpeg::probe::{extract_video_metadata, ExtractMetadataRequest, VideoMetadata};
use crate::ffmpeg::thumbnail::{generate_thumbnail, GenerateThumbnailRequest};

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/// Request to import a video file into a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVideoToProjectRequest {
    pub project_id: String,
    pub source_file_path: String,
}

/// Response from importing a video file into a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVideoToProjectResponse {
    pub clip_id: String,
    pub project_file_path: String,
    pub metadata: VideoMetadata,
    pub thumbnail_path: String,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get the project directory for a given project ID
fn get_project_directory(project_id: &str) -> CommandResult<PathBuf> {
    let home_dir = dirs::home_dir().ok_or_else(|| {
        CommandError::validation_error("Could not find home directory".to_string())
    })?;

    let project_dir = home_dir
        .join("Library")
        .join("Application Support")
        .join("com.clipforge.app")
        .join("projects")
        .join(project_id);

    Ok(project_dir)
}

/// Get the assets directory for a given project
fn get_project_assets_directory(project_id: &str) -> CommandResult<PathBuf> {
    let project_dir = get_project_directory(project_id)?;
    let assets_dir = project_dir.join("assets");

    // Create assets directory if it doesn't exist
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| {
            CommandError::file_error(format!("Failed to create assets directory: {}", e))
        })?;
    }

    Ok(assets_dir)
}

/// Get the thumbnails directory for a given project
fn get_project_thumbnails_directory(project_id: &str) -> CommandResult<PathBuf> {
    let project_dir = get_project_directory(project_id)?;
    let thumbnails_dir = project_dir.join("thumbnails");

    // Create thumbnails directory if it doesn't exist
    if !thumbnails_dir.exists() {
        fs::create_dir_all(&thumbnails_dir).map_err(|e| {
            CommandError::file_error(format!("Failed to create thumbnails directory: {}", e))
        })?;
    }

    Ok(thumbnails_dir)
}

/// Generate a unique filename for a project asset
fn generate_project_asset_filename(original_filename: &str, project_id: &str) -> String {
    let timestamp = chrono::Utc::now().timestamp();
    let extension = Path::new(original_filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("mp4");

    let base_name = Path::new(original_filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("video");

    format!("{}_{}_{}.{}", base_name, project_id, timestamp, extension)
}

/// Copy file from source to destination
fn copy_file(source: &Path, destination: &Path) -> CommandResult<()> {
    // Create parent directories if they don't exist
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            CommandError::file_error(format!("Failed to create parent directory: {}", e))
        })?;
    }

    // Copy the file
    fs::copy(source, destination)
        .map_err(|e| CommandError::file_error(format!("Failed to copy file: {}", e)))?;

    Ok(())
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Import a video file into a project by copying it to the project's assets directory
#[tauri::command]
pub async fn import_video_to_project(
    app_handle: tauri::AppHandle,
    request: ImportVideoToProjectRequest,
) -> CommandResult<ImportVideoToProjectResponse> {
    let source_path = Path::new(&request.source_file_path);

    // Validate source file
    validate_file_path(&request.source_file_path)?;

    // Check if file is a supported video format
    if !is_supported_video_format(&request.source_file_path) {
        return Err(CommandError::unsupported_format(format!(
            "Unsupported video format: {}",
            request.source_file_path
        )));
    }

    // Get file size
    let file_size = get_file_size(&request.source_file_path)?;

    // Check file size limit (100MB for MVP)
    const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100MB
    if file_size > MAX_FILE_SIZE {
        return Err(CommandError::validation_error(format!(
            "File too large: {}MB (max: 100MB)",
            file_size / (1024 * 1024)
        )));
    }

    // Get project assets directory
    let assets_dir = get_project_assets_directory(&request.project_id)?;

    // Generate unique filename for the project asset
    let original_filename = get_filename_with_extension(&request.source_file_path)
        .unwrap_or_else(|| "video.mp4".to_string());
    let project_filename = generate_project_asset_filename(&original_filename, &request.project_id);
    let project_file_path = assets_dir.join(&project_filename);

    // Check if file already exists in project
    if project_file_path.exists() {
        return Err(CommandError::validation_error(format!(
            "File already exists in project: {}",
            project_filename
        )));
    }

    // Copy file to project assets directory
    copy_file(source_path, &project_file_path)?;

    // Extract video metadata using FFmpeg (from the copied file)
    let metadata_response = extract_video_metadata(
        app_handle.clone(),
        ExtractMetadataRequest {
            file_path: project_file_path.to_string_lossy().to_string(),
        },
    )
    .await?;

    let metadata = metadata_response.metadata.ok_or_else(|| {
        CommandError::ffmpeg_error("Failed to extract video metadata".to_string())
    })?;

    // Generate thumbnail (save to project thumbnails directory)
    let thumbnails_dir = get_project_thumbnails_directory(&request.project_id)?;
    let thumbnail_filename = format!("{}.jpg", Uuid::new_v4());
    let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);

    let thumbnail_response = generate_thumbnail(
        app_handle.clone(),
        GenerateThumbnailRequest {
            file_path: project_file_path.to_string_lossy().to_string(),
            timestamp: Some(1.0), // Extract frame at 1 second
            width: Some(320),
            height: Some(180),
        },
    )
    .await?;

    // Extract thumbnail path from response
    let thumbnail_path_str = thumbnail_response
        .thumbnail_path
        .ok_or_else(|| CommandError::ffmpeg_error("Failed to generate thumbnail".to_string()))?;

    // Generate unique clip ID
    let clip_id = Uuid::new_v4().to_string();

    Ok(ImportVideoToProjectResponse {
        clip_id,
        project_file_path: project_file_path.to_string_lossy().to_string(),
        metadata,
        thumbnail_path: thumbnail_path_str,
    })
}

/// Get project asset file path
#[tauri::command]
pub async fn get_project_asset_path(
    app_handle: tauri::AppHandle,
    project_id: String,
    asset_filename: String,
) -> CommandResult<String> {
    let assets_dir = get_project_assets_directory(&project_id)?;
    let asset_path = assets_dir.join(&asset_filename);

    if !asset_path.exists() {
        return Err(CommandError::validation_error(format!(
            "Asset not found: {}",
            asset_filename
        )));
    }

    Ok(asset_path.to_string_lossy().to_string())
}

/// List all assets in a project
#[tauri::command]
pub async fn list_project_assets(
    app_handle: tauri::AppHandle,
    project_id: String,
) -> CommandResult<Vec<String>> {
    let assets_dir = get_project_assets_directory(&project_id)?;
    let mut assets = Vec::new();

    if assets_dir.exists() {
        let entries = fs::read_dir(&assets_dir).map_err(|e| {
            CommandError::file_error(format!("Failed to read assets directory: {}", e))
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| {
                CommandError::file_error(format!("Failed to read directory entry: {}", e))
            })?;

            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|name| name.to_str()) {
                    assets.push(filename.to_string());
                }
            }
        }
    }

    Ok(assets)
}

/// Delete an asset from a project
#[tauri::command]
pub async fn delete_project_asset(
    app_handle: tauri::AppHandle,
    project_id: String,
    asset_filename: String,
) -> CommandResult<()> {
    let assets_dir = get_project_assets_directory(&project_id)?;
    let asset_path = assets_dir.join(&asset_filename);

    if !asset_path.exists() {
        return Err(CommandError::validation_error(format!(
            "Asset not found: {}",
            asset_filename
        )));
    }

    fs::remove_file(&asset_path)
        .map_err(|e| CommandError::file_error(format!("Failed to delete asset: {}", e)))?;

    Ok(())
}
