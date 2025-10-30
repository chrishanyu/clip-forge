// ============================================================================
// COMMANDS MODULE
// ============================================================================
// This module contains all Tauri command handlers for the ClipForge application.
// Commands are organized by functionality and provide the bridge between
// the React frontend and Rust backend.

pub mod export;
pub mod file_ops;
pub mod metadata;
pub mod project;
pub mod project_import;
pub mod recording;

// ============================================================================
// COMMON ERROR TYPES
// ============================================================================

use serde::{Deserialize, Serialize};

/// Standard error response for all commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandError {
    pub message: String,
    pub error_type: String,
}

impl CommandError {
    pub fn new(message: String, error_type: String) -> Self {
        Self {
            message,
            error_type,
        }
    }

    pub fn io_error(message: String) -> Self {
        Self::new(message, "io_error".to_string())
    }

    pub fn ffmpeg_error(message: String) -> Self {
        Self::new(message, "ffmpeg_error".to_string())
    }

    pub fn validation_error(message: String) -> Self {
        Self::new(message, "validation_error".to_string())
    }

    pub fn unsupported_format(message: String) -> Self {
        Self::new(message, "unsupported_format".to_string())
    }

    pub fn file_error(message: String) -> Self {
        Self::new(message, "file_error".to_string())
    }

    pub fn serialization_error(message: String) -> Self {
        Self::new(message, "serialization_error".to_string())
    }

    pub fn recording_error(message: String) -> Self {
        Self::new(message, "recording_error".to_string())
    }
}

impl From<std::io::Error> for CommandError {
    fn from(error: std::io::Error) -> Self {
        Self::io_error(error.to_string())
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(error: serde_json::Error) -> Self {
        Self::new(error.to_string(), "json_error".to_string())
    }
}

// ============================================================================
// COMMON RESULT TYPE
// ============================================================================

/// Standard result type for all commands
pub type CommandResult<T> = Result<T, CommandError>;

// ============================================================================
// PROJECT TYPES
// ============================================================================

/// Project - Represents a video editing project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub project_path: String,
    pub assets_path: String,
    pub thumbnails_path: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
}

/// ProjectSettings - Configuration for a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    pub project_id: String,
    pub default_video_format: String,
    pub default_resolution: String,
    pub default_framerate: u32,
    pub auto_save: bool,
    pub auto_save_interval: u32,
}

/// ProjectMetadata - Additional project information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub project_id: String,
    pub total_clips: u32,
    pub total_duration: f64,
    pub export_count: u32,
    pub file_size: u64,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Get the application data directory for storing thumbnails and cache
pub fn get_app_data_dir() -> CommandResult<std::path::PathBuf> {
    use std::env;

    let home_dir = env::var("HOME")
        .map_err(|_| CommandError::io_error("Could not get home directory".to_string()))?;

    let app_data_dir = std::path::PathBuf::from(home_dir)
        .join("Library")
        .join("Application Support")
        .join("com.clipforge.app");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir).map_err(|e| {
        CommandError::io_error(format!("Failed to create app data directory: {}", e))
    })?;

    Ok(app_data_dir)
}

/// Get the thumbnails directory
pub fn get_thumbnails_dir() -> CommandResult<std::path::PathBuf> {
    let app_data_dir = get_app_data_dir()?;
    let thumbnails_dir = app_data_dir.join("thumbnails");

    // Create thumbnails directory if it doesn't exist
    std::fs::create_dir_all(&thumbnails_dir).map_err(|e| {
        CommandError::io_error(format!("Failed to create thumbnails directory: {}", e))
    })?;

    Ok(thumbnails_dir)
}

/// Get the temporary files directory
pub fn get_temp_dir() -> CommandResult<std::path::PathBuf> {
    let temp_dir = std::path::PathBuf::from("/tmp").join("clipforge");

    // Create temp directory if it doesn't exist
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| CommandError::io_error(format!("Failed to create temp directory: {}", e)))?;

    Ok(temp_dir)
}

/// Generate a hash for a file path (for thumbnail caching)
pub fn hash_file_path(file_path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Validate that a file exists and is readable
pub fn validate_file_path(file_path: &str) -> CommandResult<()> {
    let path = std::path::Path::new(file_path);

    if !path.exists() {
        return Err(CommandError::validation_error(format!(
            "File does not exist: {}",
            file_path
        )));
    }

    if !path.is_file() {
        return Err(CommandError::validation_error(format!(
            "Path is not a file: {}",
            file_path
        )));
    }

    // Check if file is readable
    std::fs::metadata(path)
        .map_err(|e| CommandError::io_error(format!("Cannot read file metadata: {}", e)))?;

    Ok(())
}

/// Check if a file is a supported video format
pub fn is_supported_video_format(file_path: &str) -> bool {
    let path = std::path::Path::new(file_path);

    if let Some(extension) = path.extension() {
        if let Some(ext_str) = extension.to_str() {
            let ext_lower = ext_str.to_lowercase();
            return matches!(ext_lower.as_str(), "mp4" | "mov" | "webm" | "avi" | "mkv");
        }
    }

    false
}

/// Get file size in bytes
pub fn get_file_size(file_path: &str) -> CommandResult<u64> {
    let metadata = std::fs::metadata(file_path)
        .map_err(|e| CommandError::io_error(format!("Failed to get file metadata: {}", e)))?;

    Ok(metadata.len())
}

/// Clean up temporary files
pub fn cleanup_temp_files() -> CommandResult<()> {
    let temp_dir = get_temp_dir()?;

    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)
            .map_err(|e| CommandError::io_error(format!("Failed to cleanup temp files: {}", e)))?;
    }

    Ok(())
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

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_hash_file_path() {
        let path1 = "/path/to/video.mp4";
        let path2 = "/path/to/video.mp4";
        let path3 = "/different/path/video.mp4";

        let hash1 = hash_file_path(path1);
        let hash2 = hash_file_path(path2);
        let hash3 = hash_file_path(path3);

        // Same path should produce same hash
        assert_eq!(hash1, hash2);

        // Different paths should produce different hashes
        assert_ne!(hash1, hash3);

        // Hash should not be empty
        assert!(!hash1.is_empty());
    }

    #[test]
    fn test_is_supported_video_format() {
        // Supported formats
        assert!(is_supported_video_format("video.mp4"));
        assert!(is_supported_video_format("video.MP4"));
        assert!(is_supported_video_format("video.mov"));
        assert!(is_supported_video_format("video.MOV"));
        assert!(is_supported_video_format("video.webm"));
        assert!(is_supported_video_format("video.WEBM"));
        assert!(is_supported_video_format("video.avi"));
        assert!(is_supported_video_format("video.mkv"));

        // Unsupported formats
        assert!(!is_supported_video_format("video.txt"));
        assert!(!is_supported_video_format("video.jpg"));
        assert!(!is_supported_video_format("video.png"));
        assert!(!is_supported_video_format("video"));
        assert!(!is_supported_video_format(""));
    }

    #[test]
    fn test_get_file_extension() {
        assert_eq!(get_file_extension("video.mp4"), Some("mp4".to_string()));
        assert_eq!(get_file_extension("video.MP4"), Some("mp4".to_string()));
        assert_eq!(get_file_extension("video.mov"), Some("mov".to_string()));
        assert_eq!(get_file_extension("video"), None);
        assert_eq!(get_file_extension(""), None);
    }

    #[test]
    fn test_get_filename_without_extension() {
        assert_eq!(
            get_filename_without_extension("video.mp4"),
            Some("video".to_string())
        );
        assert_eq!(
            get_filename_without_extension("my-video.mov"),
            Some("my-video".to_string())
        );
        assert_eq!(
            get_filename_without_extension("video"),
            Some("video".to_string())
        );
        assert_eq!(get_filename_without_extension(""), None); // Empty string has no filename
    }

    #[test]
    fn test_get_filename_with_extension() {
        assert_eq!(
            get_filename_with_extension("video.mp4"),
            Some("video.mp4".to_string())
        );
        assert_eq!(
            get_filename_with_extension("my-video.mov"),
            Some("my-video.mov".to_string())
        );
        assert_eq!(
            get_filename_with_extension("video"),
            Some("video".to_string())
        );
        assert_eq!(get_filename_with_extension(""), None); // Empty string has no filename
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
    fn test_is_absolute_path() {
        assert!(is_absolute_path("/path/to/file.mp4"));
        assert!(is_absolute_path("/"));
        assert!(!is_absolute_path("relative/path.mp4"));
        assert!(!is_absolute_path("file.mp4"));
        assert!(!is_absolute_path(""));
    }

    #[test]
    fn test_command_error_creation() {
        let io_error = CommandError::io_error("IO error".to_string());
        assert_eq!(io_error.error_type, "io_error");
        assert_eq!(io_error.message, "IO error");

        let ffmpeg_error = CommandError::ffmpeg_error("FFmpeg error".to_string());
        assert_eq!(ffmpeg_error.error_type, "ffmpeg_error");
        assert_eq!(ffmpeg_error.message, "FFmpeg error");

        let validation_error = CommandError::validation_error("Validation error".to_string());
        assert_eq!(validation_error.error_type, "validation_error");
        assert_eq!(validation_error.message, "Validation error");

        let unsupported_error = CommandError::unsupported_format("Unsupported format".to_string());
        assert_eq!(unsupported_error.error_type, "unsupported_format");
        assert_eq!(unsupported_error.message, "Unsupported format");
    }

    #[test]
    fn test_command_error_from_std_io_error() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "File not found");
        let command_error: CommandError = io_error.into();

        assert_eq!(command_error.error_type, "io_error");
        assert!(command_error.message.contains("File not found"));
    }

    #[test]
    fn test_command_error_from_serde_json_error() {
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let command_error: CommandError = json_error.into();

        assert_eq!(command_error.error_type, "json_error");
        assert!(!command_error.message.is_empty());
    }
}
