// ============================================================================
// RECORDING COMMANDS
// ============================================================================
// This module provides Tauri commands for recording operations,
// acting as a bridge between the frontend and the recording module.

use crate::commands::{CommandError, CommandResult};
use crate::recording::screen::{get_available_screens as get_screens, ScreenInfo};
use crate::recording::camera::{get_available_cameras as get_cameras, CameraInfo};
use crate::recording::session::RECORDING_MANAGER;
use crate::recording::permissions;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

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
}

/// Recording session response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSessionResponse {
    pub session_id: String,
    pub file_path: Option<String>,
    pub status: String,
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
        Ok(_) => {
            // Permissions are granted
        }
        Err(_) => {
            // Request permissions
            permissions::request_permissions_for_recording_type(&settings.recording_type)
                .map_err(|e| CommandError::validation_error(format!("Permission error: {}", e)))?;
            
            // Check again after requesting
            permissions::check_permissions_for_recording_type(&settings.recording_type)
                .map_err(|e| CommandError::validation_error(format!("Permission not granted: {}", e)))?;
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
        status: "recording".to_string(),
    })
}

/// Stop recording
#[tauri::command]
pub async fn stop_recording(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> CommandResult<()> {
    // Stop the recording session
    RECORDING_MANAGER
        .stop_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to stop recording: {}", e)))?;
    
    // Emit event to frontend
    app_handle.emit("recording-stopped", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    Ok(())
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
        status: format!("{:?}", session.status).to_lowercase(),
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
    // Create session
    let session_id = RECORDING_MANAGER
        .create_session(crate::recording::session::RecordingSessionType::Screen)
        .map_err(|e| CommandError::validation_error(format!("Failed to create session: {}", e)))?;
    
    // Start session
    RECORDING_MANAGER
        .start_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to start recording: {}", e)))?;
    
    // Emit event to frontend
    app_handle.emit("recording-started", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    // TODO: Start actual AVFoundation screen recording
    // For now, just return the session ID
    
    Ok(session_id)
}

/// Start webcam recording implementation
async fn start_webcam_recording_impl(
    app_handle: tauri::AppHandle,
    settings: RecordingSettingsRequest,
) -> Result<String, CommandError> {
    // Create session
    let session_id = RECORDING_MANAGER
        .create_session(crate::recording::session::RecordingSessionType::Camera)
        .map_err(|e| CommandError::validation_error(format!("Failed to create session: {}", e)))?;
    
    // Start session
    RECORDING_MANAGER
        .start_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to start recording: {}", e)))?;
    
    // Emit event to frontend
    app_handle.emit("recording-started", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    // TODO: Start actual AVFoundation camera recording
    // For now, just return the session ID
    
    Ok(session_id)
}

/// Start Picture-in-Picture recording implementation
async fn start_pip_recording_impl(
    app_handle: tauri::AppHandle,
    settings: RecordingSettingsRequest,
) -> Result<String, CommandError> {
    // Create session
    let session_id = RECORDING_MANAGER
        .create_session(crate::recording::session::RecordingSessionType::PiP)
        .map_err(|e| CommandError::validation_error(format!("Failed to create session: {}", e)))?;
    
    // Start session
    RECORDING_MANAGER
        .start_session(&session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to start recording: {}", e)))?;
    
    // Emit event to frontend
    app_handle.emit("recording-started", &session_id)
        .map_err(|e| CommandError::validation_error(format!("Failed to emit event: {}", e)))?;
    
    // TODO: Start actual AVFoundation PiP recording
    // This will involve combining screen and camera streams
    // For now, just return the session ID
    
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
