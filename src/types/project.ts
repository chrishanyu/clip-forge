import { v4 as uuidv4 } from 'uuid';

/**
 * Project - Represents a video editing project
 * Each project has its own directory with assets and metadata
 */
export interface Project {
  id: string;                    // UUID - unique identifier
  name: string;                  // Project name (user-friendly)
  description?: string;          // Optional project description
  projectPath: string;           // Full path to project directory
  assetsPath: string;            // Path to assets subdirectory
  thumbnailsPath: string;        // Path to thumbnails subdirectory
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  isActive: boolean;             // Currently active project
}

/**
 * ProjectSettings - Configuration for a project
 */
export interface ProjectSettings {
  projectId: string;
  defaultVideoFormat: string;    // 'mp4', 'mov', etc.
  defaultResolution: string;     // '1920x1080', '1280x720', etc.
  defaultFramerate: number;      // 24, 25, 30, 60, etc.
  autoSave: boolean;             // Auto-save project changes
  autoSaveInterval: number;      // Minutes between auto-saves
}

/**
 * ProjectMetadata - Additional project information
 */
export interface ProjectMetadata {
  projectId: string;
  totalClips: number;            // Number of imported clips
  totalDuration: number;         // Total duration of all clips (seconds)
  lastExported?: string;         // Last export timestamp
  exportCount: number;           // Number of exports
  fileSize: number;              // Total project size in bytes
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new project with default values
 */
export function createProject(
  name: string,
  projectPath: string,
  description?: string
): Project {
  const now = new Date().toISOString();
  const projectId = uuidv4();
  
  return {
    id: projectId,
    name,
    description,
    projectPath,
    assetsPath: `${projectPath}/assets`,
    thumbnailsPath: `${projectPath}/thumbnails`,
    createdAt: now,
    updatedAt: now,
    isActive: false,
  };
}

/**
 * Create default project settings
 */
export function createProjectSettings(projectId: string): ProjectSettings {
  return {
    projectId,
    defaultVideoFormat: 'mp4',
    defaultResolution: '1920x1080',
    defaultFramerate: 30,
    autoSave: true,
    autoSaveInterval: 5,
  };
}

/**
 * Create empty project metadata
 */
export function createProjectMetadata(projectId: string): ProjectMetadata {
  return {
    projectId,
    totalClips: 0,
    totalDuration: 0,
    exportCount: 0,
    fileSize: 0,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get project directory path for a given project ID
 */
export function getProjectDirectory(projectId: string): string {
  // This will be implemented in Rust to get the actual app support directory
  return `~/Library/Application Support/com.clipforge.app/projects/${projectId}`;
}

/**
 * Get assets directory path for a given project
 */
export function getAssetsDirectory(project: Project): string {
  return project.assetsPath;
}

/**
 * Get thumbnails directory path for a given project
 */
export function getThumbnailsDirectory(project: Project): string {
  return project.thumbnailsPath;
}

/**
 * Generate a unique filename for an asset
 */
export function generateAssetFilename(originalFilename: string, projectId: string): string {
  const timestamp = Date.now();
  const extension = originalFilename.split('.').pop() || 'mp4';
  const baseName = originalFilename.replace(/\.[^/.]+$/, '');
  return `${baseName}_${projectId}_${timestamp}.${extension}`;
}
