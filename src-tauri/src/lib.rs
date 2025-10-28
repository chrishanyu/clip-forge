// ============================================================================
// CLIPFORGE TAURI APPLICATION
// ============================================================================
// Main entry point for the ClipForge desktop application.
// This module sets up the Tauri application with all command handlers.

mod commands;
mod ffmpeg;

// Re-export command modules
use commands::file_ops::{
    import_video_file, validate_file, get_file_info, cleanup_files,
    get_app_data_directory, get_thumbnails_directory,
};

use commands::metadata::{
    import_video_with_metadata, get_video_metadata, generate_video_thumbnail,
    generate_video_thumbnails, check_thumbnail_exists, delete_video_thumbnail,
    batch_import_videos, get_ffmpeg_version, check_ffmpeg_availability,
};

use commands::export::{
    export_timeline, export_timeline_with_progress, estimate_export_info,
    validate_export_settings_command, get_export_file_path, validate_export_path,
    cleanup_export_files,
};

// Legacy command for testing
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Legacy test command
            greet,
            
            // File operations
            import_video_file,
            validate_file,
            get_file_info,
            cleanup_files,
            get_app_data_directory,
            get_thumbnails_directory,
            
            // Metadata operations
            import_video_with_metadata,
            get_video_metadata,
            generate_video_thumbnail,
            generate_video_thumbnails,
            check_thumbnail_exists,
            delete_video_thumbnail,
            batch_import_videos,
            get_ffmpeg_version,
            check_ffmpeg_availability,
            
            // Export operations
            export_timeline,
            export_timeline_with_progress,
            estimate_export_info,
            validate_export_settings_command,
            get_export_file_path,
            validate_export_path,
            cleanup_export_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
