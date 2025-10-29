// ============================================================================
// CLIPFORGE TAURI APPLICATION
// ============================================================================
// Main entry point for the ClipForge desktop application.
// This module sets up the Tauri application with all command handlers.

mod commands;
mod ffmpeg;

// Re-export command modules
use commands::file_ops::{
    cleanup_files, get_app_data_directory, get_file_info, get_thumbnails_directory,
    import_video_file, validate_file, select_output_path,
};

use commands::metadata::{
    batch_import_videos, check_ffmpeg_availability, check_thumbnail_exists, delete_video_thumbnail,
    generate_video_thumbnail, generate_video_thumbnails, get_ffmpeg_version, get_video_metadata,
    import_video_with_metadata,
};

use commands::export::{
    cleanup_export_files, estimate_export_info, export_timeline, export_timeline_with_progress,
    get_export_file_path, validate_export_path, validate_export_settings_command,
    cancel_export, get_export_status,
};

use commands::project::{
    create_project, delete_project, list_projects, load_project_metadata, load_project_settings,
    open_project,
};

use commands::project_import::{
    delete_project_asset, get_project_asset_path, import_video_to_project, list_project_assets,
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
            select_output_path,
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
            cancel_export,
            get_export_status,
            // Project operations
            create_project,
            open_project,
            delete_project,
            list_projects,
            load_project_settings,
            load_project_metadata,
            // Project import operations
            import_video_to_project,
            get_project_asset_path,
            list_project_assets,
            delete_project_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
