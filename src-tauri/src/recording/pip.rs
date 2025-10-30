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
#[serde(rename_all = "kebab-case")]
pub enum PiPPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

/// Picture-in-Picture size
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
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
    session_id: String,
    settings: PiPRecordingSettings,
    ffmpeg_path: &str,
    project_id: String,
) -> Result<String, String> {
    start_pip_recording_with_id(session_id, settings, ffmpeg_path, project_id)
}

/// Start PiP recording with specified session ID
fn start_pip_recording_with_id(
    session_id: String,
    settings: PiPRecordingSettings,
    ffmpeg_path: &str,
    project_id: String,
) -> Result<String, String> {
    use crate::recording::process_manager::PROCESS_MANAGER;
    
    // Validate settings
    validate_pip_settings(&settings)?;
    
    // Get project assets directory
    let output_dir = get_project_assets_directory(&project_id)?;
    
    // Generate output file path
    let filename = format!("pip_recording_{}.mp4", session_id);
    let output_path = output_dir.join(&filename);
    
    // Start FFmpeg PiP recording
    start_avfoundation_pip_recording(&session_id, &settings, &output_path, ffmpeg_path)?;
    
    Ok(output_path.to_string_lossy().to_string())
}

/// Get project assets directory
fn get_project_assets_directory(project_id: &str) -> Result<std::path::PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?;
    
    let assets_dir = home_dir
        .join("Library")
        .join("Application Support")
        .join("com.clipforge.app")
        .join("projects")
        .join(project_id)
        .join("assets");
    
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    
    Ok(assets_dir)
}

/// Start AVFoundation PiP recording using FFmpeg with overlay filter
fn start_avfoundation_pip_recording(
    session_id: &str,
    settings: &PiPRecordingSettings,
    output_path: &std::path::PathBuf,
    ffmpeg_path: &str,
) -> Result<(), String> {
    use crate::recording::process_manager::PROCESS_MANAGER;
    
    // Parse display ID from screen_id
    let display_id = settings.screen_id
        .strip_prefix("screen-")
        .ok_or("Invalid screen ID format")?
        .parse::<u32>()
        .map_err(|_| "Invalid screen ID")?;
    
    let screen_index = if display_id > 0 { display_id - 1 } else { 0 };
    
    // Parse camera device ID
    let camera_device_id = settings.camera_id.parse::<u32>().unwrap_or(0);
    
    // Build FFmpeg command for PiP recording
    let mut args = vec![
        // Screen input (AVFoundation format - video only, no audio from screen)
        "-f".to_string(),
        "avfoundation".to_string(),
        "-r".to_string(),
        settings.frame_rate.to_string(),
        "-i".to_string(),
        format!("Capture screen {}:", screen_index),
        
        // Camera input (AVFoundation format - video:audio)
        // Format is "video_device:audio_device" for AVFoundation
        // Using "N:0" captures video from device N and audio from default mic
        "-f".to_string(),
        "avfoundation".to_string(),
        "-r".to_string(),
        settings.frame_rate.to_string(),
        "-i".to_string(),
        format!("{}:0", camera_device_id),  // Capture both video AND audio from camera
        
        // Use wallclock as timestamps to ensure sync between inputs
        "-use_wallclock_as_timestamps".to_string(),
        "1".to_string(),
    ];
    
    // Calculate PiP overlay dimensions and position
    // We'll use a fixed screen resolution for now (will be scaled by FFmpeg)
    // For "medium" size: 1/4 of screen width and height
    // For "bottom-left" position: 20px padding from left and bottom edges
    
    // Create overlay filter with setpts for timestamp synchronization
    // [0:v] = screen input, [1:v] = camera input
    // Scale camera to 1/4 screen size, then overlay at bottom-left with 20px padding
    // Use setpts to reset timestamps to ensure sync
    let filter_complex = format!(
        "[0:v]setpts=PTS-STARTPTS[screen];[1:v]setpts=PTS-STARTPTS,scale=iw/4:ih/4[pip];[screen][pip]overlay=20:main_h-overlay_h-20[vout]"
    );
    
    args.push("-filter_complex".to_string());
    args.push(filter_complex);
    
    // Map the video output from filter
    args.push("-map".to_string());
    args.push("[vout]".to_string());
    
    // Audio handling (if enabled, use audio from camera input [1:a])
    if settings.audio_enabled {
        args.push("-map".to_string());
        args.push("1:a?".to_string()); // Map audio from camera input if available
        args.push("-c:a".to_string());
        args.push("aac".to_string());
        args.push("-b:a".to_string());
        args.push("128k".to_string());
        // Use async to resample audio to match video and handle A/V drift
        args.push("-af".to_string());
        args.push("aresample=async=1:first_pts=0".to_string());
    }
    
    // Video codec and quality settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    
    // Quality preset
    args.push("-preset".to_string());
    args.push("ultrafast".to_string());
    
    // CRF quality (lower = better quality, 18-28 is good range)
    let crf = match settings.quality.as_str() {
        "high" => "18",
        "medium" => "23",
        "low" => "28",
        _ => "23",
    };
    args.push("-crf".to_string());
    args.push(crf.to_string());
    
    // Pixel format for compatibility
    args.push("-pix_fmt".to_string());
    args.push("yuv420p".to_string());
    
    // Video sync method - sync video to audio timestamps
    args.push("-vsync".to_string());
    args.push("1".to_string());
    
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
