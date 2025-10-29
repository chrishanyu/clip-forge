use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use uuid::Uuid;

use crate::commands::{CommandError, CommandResult, Project, ProjectMetadata, ProjectSettings};

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/// Request to create a new project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: String,
}

/// Request to open a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenProjectRequest {
    pub project_id: String,
}

/// Request to delete a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteProjectRequest {
    pub project_id: String,
}

/// Request to load project settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadProjectSettingsRequest {
    pub project_id: String,
}

/// Request to load project metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadProjectMetadataRequest {
    pub project_id: String,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get the application support directory for ClipForge
fn get_app_support_dir() -> Result<PathBuf, CommandError> {
    let home_dir = dirs::home_dir().ok_or_else(|| {
        CommandError::validation_error("Could not find home directory".to_string())
    })?;

    let app_support = home_dir
        .join("Library")
        .join("Application Support")
        .join("com.clipforge.app");

    Ok(app_support)
}

/// Get the projects directory
fn get_projects_dir() -> Result<PathBuf, CommandError> {
    let app_support = get_app_support_dir()?;
    let projects_dir = app_support.join("projects");

    // Create projects directory if it doesn't exist
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir).map_err(|e| {
            CommandError::file_error(format!("Failed to create projects directory: {}", e))
        })?;
    }

    Ok(projects_dir)
}

/// Get project directory path
fn get_project_dir(project_id: &str) -> Result<PathBuf, CommandError> {
    let projects_dir = get_projects_dir()?;
    Ok(projects_dir.join(project_id))
}

/// Create project directory structure
fn create_project_structure(project_dir: &Path) -> Result<(), CommandError> {
    // Create main project directory
    fs::create_dir_all(project_dir).map_err(|e| {
        CommandError::file_error(format!("Failed to create project directory: {}", e))
    })?;

    // Create assets subdirectory
    let assets_dir = project_dir.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| {
        CommandError::file_error(format!("Failed to create assets directory: {}", e))
    })?;

    // Create thumbnails subdirectory
    let thumbnails_dir = project_dir.join("thumbnails");
    fs::create_dir_all(&thumbnails_dir).map_err(|e| {
        CommandError::file_error(format!("Failed to create thumbnails directory: {}", e))
    })?;

    Ok(())
}

/// Create default project settings
fn create_default_settings(project_id: &str) -> ProjectSettings {
    ProjectSettings {
        project_id: project_id.to_string(),
        default_video_format: "mp4".to_string(),
        default_resolution: "1920x1080".to_string(),
        default_framerate: 30,
        auto_save: true,
        auto_save_interval: 5,
    }
}

/// Create empty project metadata
fn create_empty_metadata(project_id: &str) -> ProjectMetadata {
    ProjectMetadata {
        project_id: project_id.to_string(),
        total_clips: 0,
        total_duration: 0.0,
        export_count: 0,
        file_size: 0,
    }
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Create a new project with directory structure
#[tauri::command]
pub async fn create_project(
    app_handle: tauri::AppHandle,
    request: CreateProjectRequest,
) -> CommandResult<Project> {
    let project_id = Uuid::new_v4().to_string();
    let project_dir = get_project_dir(&project_id)?;

    // Create project directory structure
    create_project_structure(&project_dir)?;

    // Create project object
    let project = Project {
        id: project_id.clone(),
        name: request.name,
        description: Some(request.description),
        project_path: project_dir.to_string_lossy().to_string(),
        assets_path: project_dir.join("assets").to_string_lossy().to_string(),
        thumbnails_path: project_dir.join("thumbnails").to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        is_active: false,
    };

    // Save project metadata
    let project_file = project_dir.join("project.json");
    let project_json = serde_json::to_string_pretty(&project).map_err(|e| {
        CommandError::serialization_error(format!("Failed to serialize project: {}", e))
    })?;

    fs::write(&project_file, project_json)
        .map_err(|e| CommandError::file_error(format!("Failed to write project file: {}", e)))?;

    // Create default settings
    let settings = create_default_settings(&project_id);
    let settings_file = project_dir.join("settings.json");
    let settings_json = serde_json::to_string_pretty(&settings).map_err(|e| {
        CommandError::serialization_error(format!("Failed to serialize settings: {}", e))
    })?;

    fs::write(&settings_file, settings_json)
        .map_err(|e| CommandError::file_error(format!("Failed to write settings file: {}", e)))?;

    // Create empty metadata
    let metadata = create_empty_metadata(&project_id);
    let metadata_file = project_dir.join("metadata.json");
    let metadata_json = serde_json::to_string_pretty(&metadata).map_err(|e| {
        CommandError::serialization_error(format!("Failed to serialize metadata: {}", e))
    })?;

    fs::write(&metadata_file, metadata_json)
        .map_err(|e| CommandError::file_error(format!("Failed to write metadata file: {}", e)))?;

    Ok(project)
}

/// Open an existing project
#[tauri::command]
pub async fn open_project(
    app_handle: tauri::AppHandle,
    request: OpenProjectRequest,
) -> CommandResult<Project> {
    let project_dir = get_project_dir(&request.project_id)?;

    // Check if project directory exists
    if !project_dir.exists() {
        return Err(CommandError::validation_error(format!(
            "Project not found: {}",
            request.project_id
        )));
    }

    // Load project from file
    let project_file = project_dir.join("project.json");
    let project_json = fs::read_to_string(&project_file)
        .map_err(|e| CommandError::file_error(format!("Failed to read project file: {}", e)))?;

    let mut project: Project = serde_json::from_str(&project_json).map_err(|e| {
        CommandError::serialization_error(format!("Failed to parse project file: {}", e))
    })?;

    // Update last accessed time
    project.updated_at = chrono::Utc::now().to_rfc3339();
    project.is_active = true;

    // Save updated project
    let updated_project_json = serde_json::to_string_pretty(&project).map_err(|e| {
        CommandError::serialization_error(format!("Failed to serialize project: {}", e))
    })?;

    fs::write(&project_file, updated_project_json)
        .map_err(|e| CommandError::file_error(format!("Failed to write project file: {}", e)))?;

    Ok(project)
}

/// Delete a project and its directory
#[tauri::command]
pub async fn delete_project(
    app_handle: tauri::AppHandle,
    request: DeleteProjectRequest,
) -> CommandResult<()> {
    let project_dir = get_project_dir(&request.project_id)?;

    // Check if project directory exists
    if !project_dir.exists() {
        return Err(CommandError::validation_error(format!(
            "Project not found: {}",
            request.project_id
        )));
    }

    // Remove project directory and all contents
    fs::remove_dir_all(&project_dir).map_err(|e| {
        CommandError::file_error(format!("Failed to delete project directory: {}", e))
    })?;

    Ok(())
}

/// List all available projects
#[tauri::command]
pub async fn list_projects(app_handle: tauri::AppHandle) -> CommandResult<Vec<Project>> {
    let projects_dir = get_projects_dir()?;
    let mut projects = Vec::new();

    // Read all project directories
    if projects_dir.exists() {
        let entries = fs::read_dir(&projects_dir).map_err(|e| {
            CommandError::file_error(format!("Failed to read projects directory: {}", e))
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| {
                CommandError::file_error(format!("Failed to read directory entry: {}", e))
            })?;

            let path = entry.path();
            if path.is_dir() {
                let project_file = path.join("project.json");
                if project_file.exists() {
                    let project_json = fs::read_to_string(&project_file).map_err(|e| {
                        CommandError::file_error(format!("Failed to read project file: {}", e))
                    })?;

                    let project: Project = serde_json::from_str(&project_json).map_err(|e| {
                        CommandError::serialization_error(format!(
                            "Failed to parse project file: {}",
                            e
                        ))
                    })?;

                    projects.push(project);
                }
            }
        }
    }

    // Sort by updated_at (most recent first)
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(projects)
}

/// Load project settings
#[tauri::command]
pub async fn load_project_settings(
    app_handle: tauri::AppHandle,
    request: LoadProjectSettingsRequest,
) -> CommandResult<ProjectSettings> {
    let project_dir = get_project_dir(&request.project_id)?;
    let settings_file = project_dir.join("settings.json");

    if !settings_file.exists() {
        // Return default settings if file doesn't exist
        return Ok(create_default_settings(&request.project_id));
    }

    let settings_json = fs::read_to_string(&settings_file)
        .map_err(|e| CommandError::file_error(format!("Failed to read settings file: {}", e)))?;

    let settings: ProjectSettings = serde_json::from_str(&settings_json).map_err(|e| {
        CommandError::serialization_error(format!("Failed to parse settings file: {}", e))
    })?;

    Ok(settings)
}

/// Load project metadata
#[tauri::command]
pub async fn load_project_metadata(
    app_handle: tauri::AppHandle,
    request: LoadProjectMetadataRequest,
) -> CommandResult<ProjectMetadata> {
    let project_dir = get_project_dir(&request.project_id)?;
    let metadata_file = project_dir.join("metadata.json");

    if !metadata_file.exists() {
        // Return empty metadata if file doesn't exist
        return Ok(create_empty_metadata(&request.project_id));
    }

    let metadata_json = fs::read_to_string(&metadata_file)
        .map_err(|e| CommandError::file_error(format!("Failed to read metadata file: {}", e)))?;

    let metadata: ProjectMetadata = serde_json::from_str(&metadata_json).map_err(|e| {
        CommandError::serialization_error(format!("Failed to parse metadata file: {}", e))
    })?;

    Ok(metadata)
}
