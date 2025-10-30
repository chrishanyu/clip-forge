// ============================================================================
// RECORDING COMMANDS
// ============================================================================
// This module provides Tauri commands for recording operations,
// acting as a bridge between the frontend and the recording module.

use crate::commands::{CommandError, CommandResult};
use crate::recording::screen::{get_available_screens as get_screens, ScreenInfo};
use crate::recording::camera::{get_available_cameras as get_cameras, CameraInfo, start_camera_preview, stop_camera_preview, get_camera_preview_data};
use crate::recording::session::RECORDING_MANAGER;
use crate::recording::permissions;
use crate::ffmpeg::thumbnail::generate_default_thumbnail;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, AppHandle};
use std::path::PathBuf;
use std::fs;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Recording settings from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSettingsRequest {
    pub recording_type: String, // "screen", "webcam", or "pip"
    pub screen_id: Option<String>,
    pub camera_id: Option<String>,
    pub quality: String,
    pub frame_rate: u32,
    pub audio_enabled: bool,
    pub audio_device_id: Option<String>,
    pub show_preview: Option<bool>,
    pub pip_position: Option<String>,
    pub pip_size: Option<String>,
    pub project_id: String, // Project ID for saving recordings
}

/// Recording session response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSessionResponse {
    pub session_id: String,
    pub file_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub status: String,
    pub metadata: Option<crate::ffmpeg::probe::VideoMetadata>,
}

/// Recording progress update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingProgressUpdate {
    pub session_id: String,
    pub duration: f64,
    pub file_size: u64,
    pub frame_count: u64,
    pub is_recording: bool,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Get all available screens for recording
#[tauri::command]
pub async fn get_available_screens() -> CommandResult<Vec<ScreenInfo>> {
    get_screens()
        .map_err(|e| CommandError::validation_error(format!("Failed to get screens: {}", e)))
}

/// Get all available cameras for recording
#[tauri::command]
pub async fn get_available_cameras() -> CommandResult<Vec<CameraInfo>> {
    get_cameras()
        .map_err(|e| CommandError::validation_error(format!("Failed to get cameras: {}", e)))
}

/// Start recording
#[tauri::command]
pub async fn start_recording(
    app_handle: tauri::AppHandle,
    settings: RecordingSettingsRequest,
) -> CommandResult<RecordingSessionResponse> {
    // Validate settings
    validate_recording_settings(&settings)?;
    
    // Check and request permissions
    match permissions::check_permissions_for_recording_type(&settings.recording_type) {
        Ok(_) => {}
        Err(_) => {
            // Request permissions
            permissions::request_permissions_for_recording_type(&settings.recording_type)
                .map_err(|e| {
                    CommandError::validation_error(format!("Permission error: {}", e))
                })?;
            
            // Check again after requesting
            permissions::check_permissions_for_recording_type(&settings.recording_type)
                .map_err(|e| {
                    CommandError::validation_error(format!("Permission not granted: {}", e))
                })?;
        }
    }
    
    // Create recording session based on type
    let session_id = match settings.recording_type.as_str() {
        "screen" => {
            start_screen_recording_impl(app_handle, settings).await?
        }
        "webcam" => {
            start_webcam_recording_impl(app_handle, settings).await?
        }
        "pip" => {
            start_pip_recording_impl(app_handle, settings).await?
        }
        _ => {
            return Err(CommandError::validation_error(
                format!("Unknown recording type: {}", settings.recording_type)
            ));
        }
    };
    
    Ok(RecordingSessionResponse {
        session_id,
        file_path: None,
        thumbnail_path: None,
        status: "recording".to_string(),
        metadata: None,
    })
}

/// Stop recording
#[tauri::command]
pub async fn stop_recording(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> CommandResult<RecordingSessionResponse> {
    // Get session info before stopping to retrieve the file path
    let session_info = RECORDING_MANAGER
        .get_session(&session_id)
        .map_err(|e| {
            CommandError::validation_error(format!("Failed to get session info: {}", e))
        })?;
    
    let file_path = session_info.file_path.clone();
    
    // Stop the FFmpeg recording process if it's a screen recording
    use crate::recording::process_manager::PROCESS_MANAGER;
    if PROCESS_MANAGER.is_process_running(&session_id) {
        PROCESS_MANAGER.stop_process(&session_id)
            .map_err(|e| {
                CommandError::validation_error(format!("Failed to stop recording process: {}", e))
            })?;
    }
    
    // Stop the recording session in manager
    RECORDING_MANAGER
        .stop_session(&session_id)
        .map_err(|e| {
            CommandError::validation_error(format!("Failed to stop recording: {}", e))
        })?;
    
    // Extract video metadata
    let video_metadata = if let Some(ref path) = file_path {
        match crate::ffmpeg::probe::extract_video_metadata(
            app_handle.clone(),
            crate::ffmpeg::probe::ExtractMetadataRequest {
                file_path: path.clone(),
            }
        ).await {
            Ok(metadata_response) => metadata_response.metadata,
            Err(e) => {
                eprintln!("Failed to extract metadata: {}", e.message);
                None
            }
        }
    } else {
        None
    };
    
    // Generate thumbnail if we have a file path
    let thumbnail_path = if let Some(ref path) = file_path {
        match generate_default_thumbnail(&app_handle, path).await {
            Ok(thumb_path) => Some(thumb_path),
            Err(e) => {
                eprintln!("Failed to generate thumbnail: {}", e.message);
                None
            }
        }
    } else {
        None
    };
    
    // Emit event to frontend
    app_handle.emit("recording-stopped", &session_id)
        .map_err(|e| {
            CommandError::validation_error(format!("Failed to emit event: {}", e))
        })?;
    
    Ok(RecordingSessionResponse {
        session_id,
        file_path,
        thumbnail_path,
        status: "stopped".to_string(),
        metadata: video_metadata,
    })
}

/// Pause recording
#[tauri::command]
pub async fn pause_recording(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> CommandResult<()> {
    RECORDING_MANAGER
        .pause_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to pause recording: {}", e)))?;
    
    app_handle.emit("recording-paused", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    Ok(())
}

/// Resume recording
#[tauri::command]
pub async fn resume_recording(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> CommandResult<()> {
    RECORDING_MANAGER
        .resume_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to resume recording: {}", e)))?;
    
    app_handle.emit("recording-resumed", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    Ok(())
}

/// Get recording progress
#[tauri::command]
pub async fn get_recording_progress(
    session_id: String,
) -> CommandResult<RecordingProgressUpdate> {
    let progress = RECORDING_MANAGER
        .get_session_progress(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to get progress: {}", e)))?;
    
    Ok(RecordingProgressUpdate {
        session_id: progress.session_id,
        duration: progress.duration,
        file_size: progress.file_size,
        frame_count: progress.frame_count,
        is_recording: progress.is_recording,
    })
}

/// Get recording session information
#[tauri::command]
pub async fn get_recording_session(
    session_id: String,
) -> CommandResult<RecordingSessionResponse> {
    let session = RECORDING_MANAGER
        .get_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to get session: {}", e)))?;
    
    Ok(RecordingSessionResponse {
        session_id: session.id,
        file_path: session.file_path,
        thumbnail_path: None, // Thumbnail is generated only when stopping recording
        status: format!("{:?}", session.status).to_lowercase(),
        metadata: None,
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Validate recording settings
fn validate_recording_settings(settings: &RecordingSettingsRequest) -> Result<(), CommandError> {
    if settings.frame_rate == 0 || settings.frame_rate > 60 {
        return Err(CommandError::validation_error(
            "Frame rate must be between 1 and 60 fps".to_string()
        ));
    }
    
    match settings.recording_type.as_str() {
        "screen" => {
            if settings.screen_id.is_none() {
                return Err(CommandError::validation_error(
                    "Screen ID is required for screen recording".to_string()
                ));
            }
        }
        "webcam" => {
            if settings.camera_id.is_none() {
                return Err(CommandError::validation_error(
                    "Camera ID is required for webcam recording".to_string()
                ));
            }
        }
        "pip" => {
            if settings.screen_id.is_none() || settings.camera_id.is_none() {
                return Err(CommandError::validation_error(
                    "Both screen ID and camera ID are required for PiP recording".to_string()
                ));
            }
        }
        _ => {
            return Err(CommandError::validation_error(
                format!("Unknown recording type: {}", settings.recording_type)
            ));
        }
    }
    
    Ok(())
}

/// Start screen recording implementation
async fn start_screen_recording_impl(
    app_handle: tauri::AppHandle,
    settings: RecordingSettingsRequest,
) -> Result<String, CommandError> {
    use crate::recording::screen::ScreenRecordingSettings;
    
    // Convert settings to screen recording settings
    let screen_settings = ScreenRecordingSettings {
        screen_id: settings.screen_id
            .ok_or_else(|| {
                CommandError::validation_error("Screen ID is required for screen recording".to_string())
            })?,
        quality: settings.quality,
        frame_rate: settings.frame_rate,
        audio_enabled: settings.audio_enabled,
        capture_area: None, // TODO: Implement capture area from settings
    };
    
    // Create session in manager first
    let manager_session_id = RECORDING_MANAGER
        .create_session(crate::recording::session::RecordingSessionType::Screen)
        .map_err(|e| {
            CommandError::validation_error(format!("Failed to create session: {}", e))
        })?;
    
    // Get FFmpeg sidecar path
    // In dev mode, use the binary from src-tauri/bin/
    // In production, use the bundled binary
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
    
    // Verify FFmpeg binary exists and is executable
    if !std::path::Path::new(&ffmpeg_path).exists() {
        return Err(CommandError::validation_error(format!("FFmpeg binary not found at: {}", ffmpeg_path)));
    }
    
    // Start actual screen recording with the manager's session ID
    let recording_session = crate::recording::screen::start_screen_recording_with_id(
        manager_session_id.clone(),
        screen_settings,
        ffmpeg_path,
        settings.project_id
    ).map_err(|e| {
        // Clean up manager session if recording fails
        let _ = RECORDING_MANAGER.stop_session(&manager_session_id);
        CommandError::validation_error(format!("Failed to start screen recording: {}", e))
    })?;
    
    // Update manager session with file path
    if let Some(ref file_path) = recording_session.file_path {
        RECORDING_MANAGER
            .update_file_path(&manager_session_id, file_path.clone())
            .map_err(|e| {
                CommandError::validation_error(format!("Failed to update file path: {}", e))
            })?;
    }
    
    // Start the session in manager
    RECORDING_MANAGER
        .start_session(&manager_session_id)
        .map_err(|e| {
            CommandError::validation_error(format!("Failed to start session: {}", e))
        })?;
    
    // Emit event to frontend
    app_handle.emit("recording-started", &manager_session_id)
        .map_err(|e| {
            CommandError::validation_error(format!("Failed to emit event: {}", e))
        })?;
    
    Ok(manager_session_id)
}

/// Start webcam recording implementation
/// NOTE: Webcam recording is handled entirely in the frontend using Web APIs (getUserMedia + MediaRecorder).
/// This function just creates a session for tracking purposes.
async fn start_webcam_recording_impl(
    app_handle: tauri::AppHandle,
    _settings: RecordingSettingsRequest,
) -> Result<String, CommandError> {
    // Create session for tracking
    let session_id = RECORDING_MANAGER
        .create_session(crate::recording::session::RecordingSessionType::Camera)
        .map_err(|e| CommandError::validation_error(format!("Failed to create session: {}", e)))?;
    
    // Start session
    RECORDING_MANAGER
        .start_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to start recording: {}", e)))?;
    
    // Set a dummy file path (actual recording is handled in frontend)
    // We'll update this when the frontend provides the real file path
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| CommandError::io_error(format!("Failed to get app data dir: {}", e)))?;
    
    let recordings_dir = app_data_dir.join("recordings");
    std::fs::create_dir_all(&recordings_dir)
        .map_err(|e| CommandError::io_error(format!("Failed to create recordings dir: {}", e)))?;
    
    let file_path = recordings_dir
        .join(format!("webcam_{}.webm", chrono::Utc::now().timestamp()))
        .to_string_lossy()
        .to_string();
    
    // Update session with file path
    RECORDING_MANAGER
        .update_file_path(&session_id, file_path.clone())
        .map_err(|e| CommandError::validation_error(format!("Failed to update file path: {}", e)))?;
    
    // Emit event to frontend
    app_handle.emit("recording-started", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    Ok(session_id)
}

/// Start Picture-in-Picture recording implementation
async fn start_pip_recording_impl(
    app_handle: tauri::AppHandle,
    settings: RecordingSettingsRequest,
) -> Result<String, CommandError> {
    // Resolve FFmpeg path
    let ffmpeg_path = if cfg!(debug_assertions) {
        // Development mode: use direct path
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| CommandError::validation_error(format!("Failed to get manifest dir: {}", e)))?;
        format!("{}/bin/ffmpeg", manifest_dir)
    } else {
        // Production mode: resolve from resources
        use tauri::Manager;
        app_handle
            .path()
            .resolve("bin/ffmpeg", tauri::path::BaseDirectory::Resource)
            .map_err(|e| CommandError::validation_error(format!("Failed to resolve FFmpeg path: {}", e)))?
            .to_string_lossy()
            .to_string()
    };
    
    // Create session
    let session_id = RECORDING_MANAGER
        .create_session(crate::recording::session::RecordingSessionType::PiP)
        .map_err(|e| CommandError::validation_error(format!("Failed to create session: {}", e)))?;
    
    // Convert settings to PiP settings
    let pip_settings = crate::recording::pip::PiPRecordingSettings {
        screen_id: settings.screen_id.clone().unwrap_or_default(),
        camera_id: settings.camera_id.clone().unwrap_or_default(),
        quality: settings.quality.clone(),
        frame_rate: settings.frame_rate,
        audio_enabled: settings.audio_enabled,
        pip_position: match settings.pip_position.as_deref() {
            Some("top-left") => crate::recording::pip::PiPPosition::TopLeft,
            Some("top-right") => crate::recording::pip::PiPPosition::TopRight,
            Some("bottom-right") => crate::recording::pip::PiPPosition::BottomRight,
            _ => crate::recording::pip::PiPPosition::BottomLeft,
        },
        pip_size: match settings.pip_size.as_deref() {
            Some("small") => crate::recording::pip::PiPSize::Small,
            Some("large") => crate::recording::pip::PiPSize::Large,
            _ => crate::recording::pip::PiPSize::Medium,
        },
        capture_area: None,
        audio_device_id: settings.audio_device_id.clone(),
    };
    
    // Start PiP recording
    let file_path = crate::recording::pip::start_pip_recording(
        session_id.clone(),
        pip_settings,
        &ffmpeg_path,
        settings.project_id.clone(),
    ).map_err(|e| CommandError::validation_error(format!("Failed to start PiP recording: {}", e)))?;
    
    // Update session with file path
    RECORDING_MANAGER
        .update_file_path(&session_id, file_path.clone())
        .map_err(|e| CommandError::validation_error(format!("Failed to update file path: {}", e)))?;
    
    // Start session
    RECORDING_MANAGER
        .start_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to start recording: {}", e)))?;
    
    // Emit event to frontend
    app_handle.emit("recording-started", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    Ok(session_id)
}

/// Check if screen recording permission is granted
#[tauri::command]
pub async fn check_screen_recording_permission() -> CommandResult<bool> {
    Ok(permissions::check_screen_recording_permission())
}

/// Request screen recording permission
#[tauri::command]
pub async fn request_screen_recording_permission() -> CommandResult<bool> {
    Ok(permissions::request_screen_recording_permission())
}

/// Check if camera permission is granted
#[tauri::command]
pub async fn check_camera_permission() -> CommandResult<bool> {
    Ok(permissions::check_camera_permission())
}

/// Request camera permission
#[tauri::command]
pub async fn request_camera_permission() -> CommandResult<bool> {
    Ok(permissions::request_camera_permission())
}

/// Check if microphone permission is granted
#[tauri::command]
pub async fn check_microphone_permission() -> CommandResult<bool> {
    Ok(permissions::check_microphone_permission())
}

/// Request microphone permission
#[tauri::command]
pub async fn request_microphone_permission() -> CommandResult<bool> {
    Ok(permissions::request_microphone_permission())
}

/// Start camera preview
#[tauri::command]
pub async fn start_camera_preview_command(camera_id: String) -> CommandResult<String> {
    start_camera_preview(&camera_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to start camera preview: {}", e)))
}

/// Stop camera preview
#[tauri::command]
pub async fn stop_camera_preview_command(session_id: String) -> CommandResult<()> {
    stop_camera_preview(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to stop camera preview: {}", e)))
}

/// Get camera preview data
#[tauri::command]
pub async fn get_camera_preview_data_command(session_id: String) -> CommandResult<(Vec<u8>, u32, u32)> {
    get_camera_preview_data(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to get camera preview data: {}", e)))
}

/// Save webcam recording data to disk
#[tauri::command]
pub async fn save_webcam_recording(
    app_handle: AppHandle,
    file_name: String,
    data: Vec<u8>
) -> CommandResult<String> {
    // Get app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::recording_error(format!("Failed to get app data directory: {}", e)))?;
    
    // Create recordings directory if it doesn't exist
    let recordings_dir = app_data_dir.join("recordings");
    fs::create_dir_all(&recordings_dir)
        .map_err(|e| CommandError::recording_error(format!("Failed to create recordings directory: {}", e)))?;
    
    // Save file
    let file_path = recordings_dir.join(&file_name);
    fs::write(&file_path, data)
        .map_err(|e| CommandError::recording_error(format!("Failed to write recording file: {}", e)))?;
    
    // Return absolute path as string
    file_path
        .to_str()
        .ok_or_else(|| CommandError::recording_error("Invalid path encoding".to_string()))
        .map(|s| s.to_string())
}
