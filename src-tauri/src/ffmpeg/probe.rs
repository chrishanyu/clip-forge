// ============================================================================
// FFMPEG PROBE MODULE
// ============================================================================
// This module handles video metadata extraction using FFmpeg's ffprobe command.
// It extracts duration, resolution, fps, codec information, and other metadata.

use crate::commands::{CommandResult, CommandError};
use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Request to extract video metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractMetadataRequest {
    pub file_path: String,
}

/// Video metadata extracted from FFmpeg probe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub duration: f64,           // Duration in seconds
    pub width: u32,              // Video width in pixels
    pub height: u32,             // Video height in pixels
    pub fps: f64,                // Frames per second
    pub codec: String,           // Video codec (e.g., "h264", "h265")
    pub bitrate: u64,            // Bitrate in bits per second
    pub file_size: u64,          // File size in bytes
    pub format: String,          // Container format (e.g., "mp4", "mov")
    pub has_audio: bool,         // Whether the video has audio track
    pub audio_codec: Option<String>, // Audio codec if present
    pub audio_bitrate: Option<u64>,  // Audio bitrate if present
}

/// Response from metadata extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractMetadataResponse {
    pub success: bool,
    pub metadata: Option<VideoMetadata>,
    pub error_message: Option<String>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Extract video metadata using FFmpeg probe
#[tauri::command]
pub async fn extract_video_metadata(
    app_handle: tauri::AppHandle,
    request: ExtractMetadataRequest,
) -> CommandResult<ExtractMetadataResponse> {
    let file_path = request.file_path;
    
    // Validate file path first
    crate::commands::validate_file_path(&file_path)?;
    
    // Extract metadata using FFmpeg probe
    match extract_metadata_internal(&app_handle, &file_path).await {
        Ok(metadata) => Ok(ExtractMetadataResponse {
            success: true,
            metadata: Some(metadata),
            error_message: None,
        }),
        Err(error) => Ok(ExtractMetadataResponse {
            success: false,
            metadata: None,
            error_message: Some(error.message),
        }),
    }
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/// Internal function to extract metadata using FFmpeg probe
async fn extract_metadata_internal(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> CommandResult<VideoMetadata> {
    // Get FFmpeg sidecar
    let sidecar = app_handle.shell()
        .sidecar("ffmpeg")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e)))?;
    
    // Build FFmpeg probe command (using ffmpeg instead of ffprobe)
    let output = sidecar
        .args(&[
            "-i", file_path,
            "-f", "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to execute ffmpeg: {}", e)))?;
    
    // Check if command succeeded
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CommandError::ffmpeg_error(format!(
            "FFmpeg probe failed: {}",
            stderr
        )));
    }
    
    // Parse stderr output (FFmpeg outputs metadata to stderr)
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Extract metadata from FFmpeg stderr output
    extract_metadata_from_ffmpeg_output(&stderr, file_path).await
}

/// Extract metadata from FFmpeg stderr output
async fn extract_metadata_from_ffmpeg_output(
    stderr: &str,
    file_path: &str,
) -> CommandResult<VideoMetadata> {
    // Get file size
    let file_size = crate::commands::get_file_size(file_path)?;
    
    // Parse FFmpeg stderr output using regex
    let duration_regex = regex::Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create duration regex: {}", e)))?;
    
    let video_stream_regex = regex::Regex::new(r"Stream #\d+:\d+.*Video: (\w+).*?(\d+)x(\d+).*?(\d+(?:\.\d+)?) fps")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create video stream regex: {}", e)))?;
    
    let bitrate_regex = regex::Regex::new(r"bitrate: (\d+) kb/s")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create bitrate regex: {}", e)))?;
    
    // Extract duration
    let duration = if let Some(captures) = duration_regex.captures(stderr) {
        let hours: f64 = captures.get(1).unwrap().as_str().parse().unwrap_or(0.0);
        let minutes: f64 = captures.get(2).unwrap().as_str().parse().unwrap_or(0.0);
        let seconds: f64 = captures.get(3).unwrap().as_str().parse().unwrap_or(0.0);
        let centiseconds: f64 = captures.get(4).unwrap().as_str().parse().unwrap_or(0.0);
        
        hours * 3600.0 + minutes * 60.0 + seconds + centiseconds / 100.0
    } else {
        return Err(CommandError::ffmpeg_error("Could not extract duration from FFmpeg output".to_string()));
    };
    
    // Extract video stream info
    let (width, height, fps, codec) = if let Some(captures) = video_stream_regex.captures(stderr) {
        let codec = captures.get(1).unwrap().as_str().to_string();
        let width: u32 = captures.get(2).unwrap().as_str().parse().unwrap_or(0);
        let height: u32 = captures.get(3).unwrap().as_str().parse().unwrap_or(0);
        let fps: f64 = captures.get(4).unwrap().as_str().parse().unwrap_or(0.0);
        
        (width, height, fps, codec)
    } else {
        return Err(CommandError::ffmpeg_error("Could not extract video stream info from FFmpeg output".to_string()));
    };
    
    // Extract bitrate
    let bitrate = if let Some(captures) = bitrate_regex.captures(stderr) {
        captures.get(1).unwrap().as_str().parse::<u64>().unwrap_or(0) * 1000 // Convert kb/s to b/s
    } else {
        0 // Default bitrate if not found
    };
    
    // Extract format from file extension
    let format = std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("unknown")
        .to_lowercase();
    
    // Check for audio stream (simplified - assume has audio if we can't determine)
    let has_audio = stderr.contains("Audio:");
    let audio_codec = if has_audio {
        // Try to extract audio codec
        let audio_regex = regex::Regex::new(r"Audio: (\w+)").ok();
        audio_regex.and_then(|re| re.captures(stderr))
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string())
    } else {
        None
    };
    
    let audio_bitrate = if has_audio {
        // Try to extract audio bitrate
        let audio_bitrate_regex = regex::Regex::new(r"Audio:.*?(\d+) kb/s").ok();
        audio_bitrate_regex.and_then(|re| re.captures(stderr))
            .and_then(|caps| caps.get(1))
            .and_then(|m| m.as_str().parse::<u64>().ok())
            .map(|rate| rate * 1000) // Convert kb/s to b/s
    } else {
        None
    };
    
    Ok(VideoMetadata {
        duration,
        width,
        height,
        fps,
        codec,
        bitrate,
        file_size,
        format,
        has_audio,
        audio_codec,
        audio_bitrate,
    })
}

// ============================================================================
// FFMPEG PROBE DATA STRUCTURES
// ============================================================================

/// FFmpeg probe JSON output structure
#[derive(Debug, Deserialize)]
struct ProbeData {
    streams: Vec<Stream>,
    format: Format,
}

#[derive(Debug, Deserialize)]
struct Stream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    bit_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Format {
    format_name: Option<String>,
    duration: Option<String>,
    bit_rate: Option<String>,
}

// ============================================================================
// FFMPEG PROBE DATA STRUCTURES
// ============================================================================

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Check if FFmpeg probe is available
pub async fn check_ffmpeg_probe_availability(app_handle: &tauri::AppHandle) -> CommandResult<bool> {
    let sidecar = app_handle.shell()
        .sidecar("ffprobe")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e)))?;
    
    let output = sidecar
        .args(&["-version"])
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to check FFmpeg version: {}", e)))?;
    
    Ok(output.status.success())
}

/// Get FFmpeg version information
pub async fn get_ffmpeg_version(app_handle: &tauri::AppHandle) -> CommandResult<String> {
    let sidecar = app_handle.shell()
        .sidecar("ffprobe")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e)))?;
    
    let output = sidecar
        .args(&["-version"])
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to get FFmpeg version: {}", e)))?;
    
    if !output.status.success() {
        return Err(CommandError::ffmpeg_error("Failed to get FFmpeg version".to_string()));
    }
    
    let version_output = String::from_utf8_lossy(&output.stdout);
    let first_line = version_output.lines().next().unwrap_or("Unknown version");
    
    Ok(first_line.to_string())
}

/// Validate video file format
pub async fn validate_video_format(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> CommandResult<bool> {
    let sidecar = app_handle.shell()
        .sidecar("ffprobe")
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to create FFmpeg sidecar: {}", e)))?;
    
    let output = sidecar
        .args(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            file_path,
        ])
        .output()
        .await
        .map_err(|e| CommandError::ffmpeg_error(format!("Failed to validate video format: {}", e)))?;
    
    Ok(output.status.success())
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_metadata_request_serialization() {
        let request = ExtractMetadataRequest {
            file_path: "/path/to/video.mp4".to_string(),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ExtractMetadataRequest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(request.file_path, deserialized.file_path);
    }

    #[test]
    fn test_extract_metadata_response_serialization() {
        let metadata = VideoMetadata {
            duration: 120.5,
            width: 1920,
            height: 1080,
            fps: 30.0,
            codec: "h264".to_string(),
            bitrate: 5000000,
            file_size: 1000000,
            format: "mp4".to_string(),
            has_audio: true,
            audio_codec: Some("aac".to_string()),
            audio_bitrate: Some(128000),
        };
        
        let response = ExtractMetadataResponse {
            success: true,
            metadata: Some(metadata.clone()),
            error_message: None,
        };
        
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: ExtractMetadataResponse = serde_json::from_str(&json).unwrap();
        
        assert_eq!(response.success, deserialized.success);
        assert_eq!(response.error_message, deserialized.error_message);
        
        if let (Some(orig), Some(deser)) = (response.metadata, deserialized.metadata) {
            assert_eq!(orig.duration, deser.duration);
            assert_eq!(orig.width, deser.width);
            assert_eq!(orig.height, deser.height);
            assert_eq!(orig.fps, deser.fps);
            assert_eq!(orig.codec, deser.codec);
            assert_eq!(orig.bitrate, deser.bitrate);
            assert_eq!(orig.file_size, deser.file_size);
            assert_eq!(orig.format, deser.format);
            assert_eq!(orig.has_audio, deser.has_audio);
            assert_eq!(orig.audio_codec, deser.audio_codec);
            assert_eq!(orig.audio_bitrate, deser.audio_bitrate);
        }
    }

    #[test]
    fn test_video_metadata_serialization() {
        let metadata = VideoMetadata {
            duration: 120.5,
            width: 1920,
            height: 1080,
            fps: 30.0,
            codec: "h264".to_string(),
            bitrate: 5000000,
            file_size: 1000000,
            format: "mp4".to_string(),
            has_audio: true,
            audio_codec: Some("aac".to_string()),
            audio_bitrate: Some(128000),
        };
        
        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: VideoMetadata = serde_json::from_str(&json).unwrap();
        
        assert_eq!(metadata.duration, deserialized.duration);
        assert_eq!(metadata.width, deserialized.width);
        assert_eq!(metadata.height, deserialized.height);
        assert_eq!(metadata.fps, deserialized.fps);
        assert_eq!(metadata.codec, deserialized.codec);
        assert_eq!(metadata.bitrate, deserialized.bitrate);
        assert_eq!(metadata.file_size, deserialized.file_size);
        assert_eq!(metadata.format, deserialized.format);
        assert_eq!(metadata.has_audio, deserialized.has_audio);
        assert_eq!(metadata.audio_codec, deserialized.audio_codec);
        assert_eq!(metadata.audio_bitrate, deserialized.audio_bitrate);
    }

    #[test]
    fn test_probe_data_parsing() {
        let json_data = r#"{
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "width": 1920,
                    "height": 1080,
                    "r_frame_rate": "30/1",
                    "bit_rate": "5000000"
                },
                {
                    "codec_type": "audio",
                    "codec_name": "aac",
                    "bit_rate": "128000"
                }
            ],
            "format": {
                "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
                "duration": "120.5",
                "bit_rate": "5128000"
            }
        }"#;
        
        let probe_data: ProbeData = serde_json::from_str(json_data).unwrap();
        
        assert_eq!(probe_data.streams.len(), 2);
        assert_eq!(probe_data.streams[0].codec_type, Some("video".to_string()));
        assert_eq!(probe_data.streams[0].codec_name, Some("h264".to_string()));
        assert_eq!(probe_data.streams[0].width, Some(1920));
        assert_eq!(probe_data.streams[0].height, Some(1080));
        assert_eq!(probe_data.streams[0].r_frame_rate, Some("30/1".to_string()));
        
        assert_eq!(probe_data.streams[1].codec_type, Some("audio".to_string()));
        assert_eq!(probe_data.streams[1].codec_name, Some("aac".to_string()));
        
        assert_eq!(probe_data.format.format_name, Some("mov,mp4,m4a,3gp,3g2,mj2".to_string()));
        assert_eq!(probe_data.format.duration, Some("120.5".to_string()));
        assert_eq!(probe_data.format.bit_rate, Some("5128000".to_string()));
    }

    #[test]
    fn test_fps_parsing() {
        // Test various FPS formats
        assert_eq!(parse_fps("30/1"), 30.0);
        assert!((parse_fps("30000/1001") - 29.97).abs() < 0.01); // Allow small floating point differences
        assert_eq!(parse_fps("25/1"), 25.0);
        assert!((parse_fps("24000/1001") - 23.976).abs() < 0.01); // Allow small floating point differences
        assert_eq!(parse_fps("invalid"), 0.0);
        assert_eq!(parse_fps(""), 0.0);
    }

    fn parse_fps(fps_str: &str) -> f64 {
        if let Some((num, den)) = fps_str.split_once('/') {
            if let (Ok(n), Ok(d)) = (num.parse::<f64>(), den.parse::<f64>()) {
                if d != 0.0 { n / d } else { 0.0 }
            } else { 0.0 }
        } else { 0.0 }
    }
}
