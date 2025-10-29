/**
 * Picture-in-Picture Recording Module
 * 
 * Handles simultaneous screen and camera recording with Picture-in-Picture overlay.
 * Combines screen capture and camera recording using AVFoundation.
 */

use serde::{Deserialize, Serialize};
use crate::recording::screen::CaptureArea;

/// PiP recording settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiPRecordingSettings {
    pub screen_id: String,
    pub camera_id: String,
    pub quality: String,
    pub frame_rate: u32,
    pub audio_enabled: bool,
    pub pip_position: PiPPosition,
    pub pip_size: PiPSize,
    pub capture_area: Option<CaptureArea>,
    pub audio_device_id: Option<String>,
}

/// Picture-in-Picture position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PiPPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

/// Picture-in-Picture size
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PiPSize {
    Small,
    Medium,
    Large,
}

/// PiP recording session
#[derive(Debug, Clone)]
pub struct PiPRecordingSession {
    pub id: String,
    pub settings: PiPRecordingSettings,
    pub is_recording: bool,
    pub start_time: Option<std::time::Instant>,
    pub file_path: Option<String>,
    pub screen_session: Option<String>, // Reference to screen recording session
    pub camera_session: Option<String>, // Reference to camera recording session
}

impl PiPRecordingSession {
    pub fn new(id: String, settings: PiPRecordingSettings) -> Self {
        Self {
            id,
            settings,
            is_recording: false,
            start_time: None,
            file_path: None,
            screen_session: None,
            camera_session: None,
        }
    }
}

/// Start Picture-in-Picture recording
pub fn start_pip_recording(
    settings: PiPRecordingSettings,
) -> Result<PiPRecordingSession, String> {
    let session_id = format!("pip_recording_{}", chrono::Utc::now().timestamp_millis());
    let mut session = PiPRecordingSession::new(session_id, settings);
    
    // TODO: Implement actual AVFoundation PiP recording
    // This will involve:
    // 1. Starting screen recording
    // 2. Starting camera recording
    // 3. Combining them with PiP overlay
    // For now, just mark as recording
    session.is_recording = true;
    session.start_time = Some(std::time::Instant::now());
    
    // Generate output file path
    let output_dir = std::env::temp_dir().join("clipforge_recordings");
    std::fs::create_dir_all(&output_dir).map_err(|e| format!("Failed to create output directory: {}", e))?;
    
    let filename = format!("pip_recording_{}.mp4", session.id);
    session.file_path = Some(output_dir.join(filename).to_string_lossy().to_string());
    
    // Create sub-sessions for tracking
    session.screen_session = Some(format!("screen_{}", session.id));
    session.camera_session = Some(format!("camera_{}", session.id));
    
    Ok(session)
}

/// Stop Picture-in-Picture recording
pub fn stop_pip_recording(session: &mut PiPRecordingSession) -> Result<(), String> {
    if !session.is_recording {
        return Err("No active recording session".to_string());
    }
    
    // TODO: Implement actual AVFoundation stop recording
    // This will involve:
    // 1. Stopping screen recording
    // 2. Stopping camera recording
    // 3. Finalizing the combined output
    session.is_recording = false;
    session.start_time = None;
    session.screen_session = None;
    session.camera_session = None;
    
    Ok(())
}

/// Pause Picture-in-Picture recording
pub fn pause_pip_recording(session: &mut PiPRecordingSession) -> Result<(), String> {
    if !session.is_recording {
        return Err("No active recording session".to_string());
    }
    
    // TODO: Implement actual AVFoundation pause recording
    // For MVP, we'll treat pause as stop
    stop_pip_recording(session)
}

/// Resume Picture-in-Picture recording
pub fn resume_pip_recording(session: &mut PiPRecordingSession) -> Result<(), String> {
    if session.is_recording {
        return Err("Recording session is already active".to_string());
    }
    
    // TODO: Implement actual AVFoundation resume recording
    // For MVP, we'll treat resume as start
    session.is_recording = true;
    session.start_time = Some(std::time::Instant::now());
    
    Ok(())
}

/// Get recording duration
pub fn get_recording_duration(session: &PiPRecordingSession) -> f64 {
    if let Some(start_time) = session.start_time {
        start_time.elapsed().as_secs_f64()
    } else {
        0.0
    }
}

/// Validate PiP recording settings
pub fn validate_pip_settings(settings: &PiPRecordingSettings) -> Result<(), String> {
    if settings.screen_id.is_empty() {
        return Err("Screen ID is required".to_string());
    }
    
    if settings.camera_id.is_empty() {
        return Err("Camera ID is required".to_string());
    }
    
    if settings.frame_rate == 0 || settings.frame_rate > 60 {
        return Err("Frame rate must be between 1 and 60 fps".to_string());
    }
    
    if let Some(ref area) = settings.capture_area {
        if area.width == 0 || area.height == 0 {
            return Err("Capture area dimensions must be greater than 0".to_string());
        }
    }
    
    Ok(())
}

/// Calculate PiP overlay dimensions based on screen size and PiP size
pub fn calculate_pip_dimensions(
    screen_width: u32,
    screen_height: u32,
    pip_size: &PiPSize,
) -> (u32, u32) {
    let base_width = screen_width / 4; // Base width is 1/4 of screen width
    let base_height = screen_height / 4; // Base height is 1/4 of screen height
    
    match pip_size {
        PiPSize::Small => (base_width / 2, base_height / 2),
        PiPSize::Medium => (base_width, base_height),
        PiPSize::Large => (base_width * 2, base_height * 2),
    }
}

/// Calculate PiP overlay position based on screen size and position
pub fn calculate_pip_position(
    screen_width: u32,
    screen_height: u32,
    pip_width: u32,
    pip_height: u32,
    position: &PiPPosition,
) -> (i32, i32) {
    match position {
        PiPPosition::TopLeft => (0, 0),
        PiPPosition::TopRight => ((screen_width - pip_width) as i32, 0),
        PiPPosition::BottomLeft => (0, (screen_height - pip_height) as i32),
        PiPPosition::BottomRight => (
            (screen_width - pip_width) as i32,
            (screen_height - pip_height) as i32,
        ),
    }
}

/// Get PiP preview data (for live preview)
pub fn get_pip_preview(_screen_id: &str, _camera_id: &str) -> Result<Vec<u8>, String> {
    // TODO: Implement actual PiP preview using AVFoundation
    // This will combine screen and camera previews
    // For now, return empty data
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pip_recording_session_creation() {
        let settings = PiPRecordingSettings {
            screen_id: "screen-1".to_string(),
            camera_id: "camera-1".to_string(),
            quality: "medium".to_string(),
            frame_rate: 30,
            audio_enabled: true,
            pip_position: PiPPosition::BottomRight,
            pip_size: PiPSize::Medium,
            capture_area: None,
            audio_device_id: None,
        };
        
        let session = PiPRecordingSession::new("test-session".to_string(), settings);
        assert_eq!(session.id, "test-session");
        assert!(!session.is_recording);
        assert!(session.start_time.is_none());
    }

    #[test]
    fn test_validate_pip_settings() {
        let valid_settings = PiPRecordingSettings {
            screen_id: "screen-1".to_string(),
            camera_id: "camera-1".to_string(),
            quality: "medium".to_string(),
            frame_rate: 30,
            audio_enabled: true,
            pip_position: PiPPosition::BottomRight,
            pip_size: PiPSize::Medium,
            capture_area: None,
            audio_device_id: None,
        };
        
        assert!(validate_pip_settings(&valid_settings).is_ok());
        
        let invalid_settings = PiPRecordingSettings {
            screen_id: "".to_string(),
            camera_id: "camera-1".to_string(),
            quality: "medium".to_string(),
            frame_rate: 30,
            audio_enabled: true,
            pip_position: PiPPosition::BottomRight,
            pip_size: PiPSize::Medium,
            capture_area: None,
            audio_device_id: None,
        };
        
        assert!(validate_pip_settings(&invalid_settings).is_err());
    }

    #[test]
    fn test_calculate_pip_dimensions() {
        let (width, height) = calculate_pip_dimensions(1920, 1080, &PiPSize::Medium);
        assert_eq!(width, 480); // 1920 / 4
        assert_eq!(height, 270); // 1080 / 4
        
        let (width, height) = calculate_pip_dimensions(1920, 1080, &PiPSize::Small);
        assert_eq!(width, 240); // 1920 / 4 / 2
        assert_eq!(height, 135); // 1080 / 4 / 2
    }

    #[test]
    fn test_calculate_pip_position() {
        let (x, y) = calculate_pip_position(1920, 1080, 480, 270, &PiPPosition::TopLeft);
        assert_eq!(x, 0);
        assert_eq!(y, 0);
        
        let (x, y) = calculate_pip_position(1920, 1080, 480, 270, &PiPPosition::BottomRight);
        assert_eq!(x, 1440); // 1920 - 480
        assert_eq!(y, 810); // 1080 - 270
    }
}
