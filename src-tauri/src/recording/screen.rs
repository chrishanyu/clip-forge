/**
 * Screen Recording Module
 * 
 * Handles screen capture functionality using CoreGraphics and AVFoundation.
 * Provides screen enumeration and screen recording capabilities.
 */

use serde::{Deserialize, Serialize};
use core_graphics::display::{CGDisplay, CGDisplayBounds, CGGetActiveDisplayList};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

/// Screen information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_primary: bool,
    pub scale_factor: f64,
}

/// Screen recording settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenRecordingSettings {
    pub screen_id: String,
    pub quality: String,
    pub frame_rate: u32,
    pub audio_enabled: bool,
    pub capture_area: Option<CaptureArea>,
}

/// Capture area for screen recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Screen recording session
#[derive(Debug, Clone)]
pub struct ScreenRecordingSession {
    pub id: String,
    pub settings: ScreenRecordingSettings,
    pub is_recording: bool,
    pub start_time: Option<std::time::Instant>,
    pub file_path: Option<String>,
}

impl ScreenRecordingSession {
    pub fn new(id: String, settings: ScreenRecordingSettings) -> Self {
        Self {
            id,
            settings,
            is_recording: false,
            start_time: None,
            file_path: None,
        }
    }
}

/// Get all available screens
pub fn get_available_screens() -> Result<Vec<ScreenInfo>, String> {
    let mut screens = Vec::new();
    
    // Get the number of active displays
    let mut display_count: u32 = 0;
    let result = unsafe {
        CGGetActiveDisplayList(0, std::ptr::null_mut(), &mut display_count)
    };
    
    if result != 0 {
        return Err("Failed to get display count".to_string());
    }
    
    if display_count == 0 {
        return Ok(screens);
    }
    
    // Allocate array for display IDs
    let mut display_ids = vec![0u32; display_count as usize];
    let result = unsafe {
        CGGetActiveDisplayList(display_count, display_ids.as_mut_ptr(), &mut display_count)
    };
    
    if result != 0 {
        return Err("Failed to get display list".to_string());
    }
    
    // Get the main display ID
    let main_display_id = CGDisplay::main().id;
    
    // Process each display
    for (index, &display_id) in display_ids.iter().enumerate() {
        let _display = CGDisplay::new(display_id);
        
        // Get display bounds
        let bounds = unsafe { CGDisplayBounds(display_id) };
        
        // Get display name (try to get a meaningful name)
        let name = get_display_name(display_id, index);
        
        // Calculate scale factor (simplified - in reality this is more complex)
        let scale_factor = if display_id == main_display_id { 2.0 } else { 1.0 };
        
        let screen_info = ScreenInfo {
            id: format!("screen-{}", display_id),
            name,
            width: bounds.size.width as u32,
            height: bounds.size.height as u32,
            x: bounds.origin.x as i32,
            y: bounds.origin.y as i32,
            is_primary: display_id == main_display_id,
            scale_factor,
        };
        
        screens.push(screen_info);
    }
    
    Ok(screens)
}

/// Get display name (simplified implementation)
fn get_display_name(display_id: u32, index: usize) -> String {
    // Try to get display name from system
    // This is a simplified implementation - in reality you'd use more CoreGraphics APIs
    if display_id == CGDisplay::main().id {
        "Built-in Retina Display".to_string()
    } else {
        format!("Display {}", index + 1)
    }
}

/// Start screen recording with provided session ID and project ID
pub fn start_screen_recording_with_id(
    session_id: String,
    settings: ScreenRecordingSettings,
    ffmpeg_path: String,
    project_id: String,
) -> Result<ScreenRecordingSession, String> {
    let mut session = ScreenRecordingSession::new(session_id.clone(), settings.clone());
    
    // Generate output file path in project assets directory
    let output_dir = get_project_assets_directory(&project_id)?;
    
    let filename = format!("recording_{}.mp4", session.id);
    let file_path = output_dir.join(filename);
    session.file_path = Some(file_path.to_string_lossy().to_string());
    
    // Start actual screen recording using FFmpeg + AVFoundation
    match start_avfoundation_recording(&session_id, &settings, &file_path, &ffmpeg_path) {
        Ok(_) => {
            session.is_recording = true;
            session.start_time = Some(std::time::Instant::now());
            Ok(session)
        }
        Err(e) => Err(format!("Failed to start screen recording: {}", e))
    }
}

/// Get the project assets directory
fn get_project_assets_directory(project_id: &str) -> Result<std::path::PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    
    let assets_dir = home_dir
        .join("Library")
        .join("Application Support")
        .join("com.clipforge.app")
        .join("projects")
        .join(project_id)
        .join("assets");
    
    // Create assets directory if it doesn't exist
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    
    Ok(assets_dir)
}

/// Start screen recording (generates own session ID)
/// Note: This function requires FFmpeg to be in system PATH and uses a default project
/// This is primarily for testing - production code should use start_screen_recording_with_id
pub fn start_screen_recording(
    settings: ScreenRecordingSettings,
    project_id: String,
) -> Result<ScreenRecordingSession, String> {
    // Try to find FFmpeg in system PATH
    let ffmpeg_path = which::which("ffmpeg")
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|_| "FFmpeg not found in system PATH. Please use start_screen_recording_with_id instead.".to_string())?;
    
    let session_id = format!("screen_recording_{}", chrono::Utc::now().timestamp_millis());
    start_screen_recording_with_id(session_id, settings, ffmpeg_path, project_id)
}

/// Start AVFoundation screen recording using FFmpeg
fn start_avfoundation_recording(
    session_id: &str,
    settings: &ScreenRecordingSettings,
    output_path: &PathBuf,
    ffmpeg_path: &str,
) -> Result<(), String> {
    use crate::recording::process_manager::PROCESS_MANAGER;
    
    // Get the display ID from settings  
    let display_id = settings.screen_id
        .strip_prefix("screen-")
        .ok_or("Invalid screen ID format")?
        .parse::<u32>()
        .map_err(|_| "Invalid screen ID")?;
    
    // Build FFmpeg command for screen recording
    // Using AVFoundation input on macOS
    let mut args = vec![
        "-f".to_string(),
        "avfoundation".to_string(),
        "-capture_cursor".to_string(),
        "1".to_string(),
        "-capture_mouse_clicks".to_string(),
        "1".to_string(),
    ];
    
    // Frame rate
    args.push("-r".to_string());
    args.push(settings.frame_rate.to_string());
    
    // Input device (screen capture)
    // For AVFoundation screen capture, we need to use "Capture screen N" format
    // where N is 0 for the first screen, 1 for the second, etc.
    // The format is: -i "Capture screen N:"
    let screen_index = if display_id > 0 { display_id - 1 } else { 0 };
    let input_device = format!("Capture screen {}:", screen_index);
    
    args.push("-i".to_string());
    args.push(input_device);
    
    // Video codec and quality settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    
    // Quality preset based on settings
    let preset = match settings.quality.as_str() {
        "low" => "veryfast",
        "medium" => "medium",
        "high" => "slow",
        _ => "medium",
    };
    args.push("-preset".to_string());
    args.push(preset.to_string());
    
    // CRF (Constant Rate Factor) for quality
    let crf = match settings.quality.as_str() {
        "low" => "28",
        "medium" => "23",
        "high" => "18",
        _ => "23",
    };
    args.push("-crf".to_string());
    args.push(crf.to_string());
    
    // Pixel format
    args.push("-pix_fmt".to_string());
    args.push("yuv420p".to_string());
    
    // Overwrite output file if it exists
    args.push("-y".to_string());
    
    // Output file
    args.push(output_path.to_string_lossy().to_string());
    
    // Start FFmpeg process using process manager
    PROCESS_MANAGER.start_process(
        session_id.to_string(),
        ffmpeg_path.to_string(),
        args,
    )?;
    
    Ok(())
}

/// Stop screen recording
pub fn stop_screen_recording(session: &mut ScreenRecordingSession) -> Result<(), String> {
    if !session.is_recording {
        return Err("No active recording session".to_string());
    }
    
    // Stop the AVFoundation recording
    match stop_avfoundation_recording(session) {
        Ok(_) => {
            session.is_recording = false;
            session.start_time = None;
            Ok(())
        }
        Err(e) => Err(format!("Failed to stop screen recording: {}", e))
    }
}

/// Stop AVFoundation screen recording
fn stop_avfoundation_recording(session: &ScreenRecordingSession) -> Result<(), String> {
    // For MVP, we'll just update the file to indicate recording stopped
    // In a full implementation, this would stop the AVCaptureSession
    
    if let Some(ref file_path) = session.file_path {
        let stop_content = format!(
            "Screen recording stopped at {}\nDuration: {:.2} seconds",
            chrono::Utc::now().to_rfc3339(),
            session.start_time
                .map(|start| start.elapsed().as_secs_f64())
                .unwrap_or(0.0)
        );
        
        std::fs::write(file_path, stop_content)
            .map_err(|e| format!("Failed to update recording file: {}", e))?;
    }
    
    // In a full implementation, we would:
    // 1. Stop the AVCaptureSession
    // 2. Finalize the output file
    // 3. Clean up resources
    
    Ok(())
}

/// Pause screen recording
pub fn pause_screen_recording(session: &mut ScreenRecordingSession) -> Result<(), String> {
    if !session.is_recording {
        return Err("No active recording session".to_string());
    }
    
    // TODO: Implement actual AVFoundation pause recording
    // For MVP, we'll treat pause as stop
    stop_screen_recording(session)
}

/// Resume screen recording
pub fn resume_screen_recording(session: &mut ScreenRecordingSession) -> Result<(), String> {
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
pub fn get_recording_duration(session: &ScreenRecordingSession) -> f64 {
    if let Some(start_time) = session.start_time {
        start_time.elapsed().as_secs_f64()
    } else {
        0.0
    }
}

/// Validate screen recording settings
pub fn validate_screen_settings(settings: &ScreenRecordingSettings) -> Result<(), String> {
    if settings.screen_id.is_empty() {
        return Err("Screen ID is required".to_string());
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_available_screens() {
        let screens = get_available_screens().unwrap();
        assert!(!screens.is_empty());
        assert!(screens.iter().any(|s| s.is_primary));
    }

    #[test]
    fn test_screen_recording_session_creation() {
        let settings = ScreenRecordingSettings {
            screen_id: "screen-1".to_string(),
            quality: "medium".to_string(),
            frame_rate: 30,
            audio_enabled: false,
            capture_area: None,
        };
        
        let session = ScreenRecordingSession::new("test-session".to_string(), settings);
        assert_eq!(session.id, "test-session");
        assert!(!session.is_recording);
        assert!(session.start_time.is_none());
    }

    #[test]
    fn test_validate_screen_settings() {
        let valid_settings = ScreenRecordingSettings {
            screen_id: "screen-1".to_string(),
            quality: "medium".to_string(),
            frame_rate: 30,
            audio_enabled: false,
            capture_area: None,
        };
        
        assert!(validate_screen_settings(&valid_settings).is_ok());
        
        let invalid_settings = ScreenRecordingSettings {
            screen_id: "".to_string(),
            quality: "medium".to_string(),
            frame_rate: 30,
            audio_enabled: false,
            capture_area: None,
        };
        
        assert!(validate_screen_settings(&invalid_settings).is_err());
    }
}
