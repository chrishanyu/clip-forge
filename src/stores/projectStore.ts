import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { Project, ProjectSettings, ProjectMetadata, AppError, createAppError } from '@/types';

// ============================================================================
// PROJECT STORE INTERFACE
// ============================================================================

interface ProjectStore {
  // State
  currentProject: Project | null;
  projects: Project[];
  settings: ProjectSettings | null;
  metadata: ProjectMetadata | null;
  loading: boolean;
  error: AppError | null;
  
  // Actions - Project Management
  createProject: (name: string, description?: string) => Promise<Project>;
  openProject: (projectId: string) => Promise<void>;
  closeProject: () => void;
  deleteProject: (projectId: string) => Promise<void>;
  listProjects: () => Promise<void>;
  
  // Actions - Project Settings
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  loadSettings: (projectId: string) => Promise<void>;
  
  // Actions - Project Metadata
  updateMetadata: (metadata: Partial<ProjectMetadata>) => void;
  loadMetadata: (projectId: string) => Promise<void>;
  
  // Actions - Error Handling
  setError: (error: AppError | null) => void;
  clearError: () => void;
  
  // Getters
  getProjectById: (projectId: string) => Project | undefined;
  isProjectActive: (projectId: string) => boolean;
  getProjectPath: (projectId: string) => string | null;
  getAssetsPath: (projectId: string) => string | null;
  getThumbnailsPath: (projectId: string) => string | null;
}

// ============================================================================
// PROJECT STORE IMPLEMENTATION
// ============================================================================

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      projects: [],
      settings: null,
      metadata: null,
      loading: false,
      error: null,
      
      // Actions - Project Management
      createProject: async (name: string, description?: string) => {
        try {
          set({ loading: true, error: null }, false, 'projectStore/createProject/start');
          
          // Call Tauri command to create project directory and return project info
          const project = await invoke<Project>('create_project', {
            request: {
              name,
              description: description || '',
            }
          });
          
          // Add to projects list and automatically open it
          set(
            (state) => ({
              projects: [...state.projects, project],
              currentProject: project,
              loading: false,
            }),
            false,
            'projectStore/createProject/success'
          );
          
          // Load project settings and metadata
          await get().loadSettings(project.id);
          await get().loadMetadata(project.id);
          
          return project;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
          set(
            { 
              loading: false, 
              error: createAppError('project', errorMessage, undefined, { name, description })
            }, 
            false, 
            'projectStore/createProject/error'
          );
          throw error;
        }
      },
      
      openProject: async (projectId: string) => {
        try {
          set({ loading: true, error: null }, false, 'projectStore/openProject/start');
          
          // Call Tauri command to open project
          const project = await invoke<Project>('open_project', { 
            request: { project_id: projectId } 
          });
          
          // Set as current project
          set(
            (state) => ({
              currentProject: project,
              projects: state.projects.map(p => 
                p.id === projectId ? { ...p, isActive: true } : { ...p, isActive: false }
              ),
              loading: false,
            }),
            false,
            'projectStore/openProject/success'
          );
          
          // Load project settings and metadata
          await get().loadSettings(projectId);
          await get().loadMetadata(projectId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to open project';
          set(
            { 
              loading: false, 
              error: createAppError('project', errorMessage, undefined, { projectId })
            }, 
            false, 
            'projectStore/openProject/error'
          );
          throw error;
        }
      },
      
      closeProject: () => {
        set(
          (state) => ({
            currentProject: null,
            projects: state.projects.map(p => ({ ...p, isActive: false })),
            settings: null,
            metadata: null,
          }),
          false,
          'projectStore/closeProject'
        );
      },
      
      deleteProject: async (projectId: string) => {
        try {
          set({ loading: true, error: null }, false, 'projectStore/deleteProject/start');
          
          // Call Tauri command to delete project directory
          await invoke('delete_project', { 
            request: { project_id: projectId } 
          });
          
          // Remove from projects list
          set(
            (state) => ({
              projects: state.projects.filter(p => p.id !== projectId),
              currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
              loading: false,
            }),
            false,
            'projectStore/deleteProject/success'
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete project';
          set(
            { 
              loading: false, 
              error: createAppError('project', errorMessage, undefined, { projectId })
            }, 
            false, 
            'projectStore/deleteProject/error'
          );
          throw error;
        }
      },
      
      listProjects: async () => {
        try {
          set({ loading: true, error: null }, false, 'projectStore/listProjects/start');
          
          // Call Tauri command to list all projects
          const projects = await invoke<Project[]>('list_projects');
          
          set(
            { projects, loading: false },
            false,
            'projectStore/listProjects/success'
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to list projects';
          set(
            { 
              loading: false, 
              error: createAppError('project', errorMessage)
            }, 
            false, 
            'projectStore/listProjects/error'
          );
          throw error;
        }
      },
      
      // Actions - Project Settings
      updateSettings: (settings: Partial<ProjectSettings>) => {
        set(
          (state) => ({
            settings: state.settings ? { ...state.settings, ...settings } : null,
          }),
          false,
          'projectStore/updateSettings'
        );
      },
      
      loadSettings: async (projectId: string) => {
        try {
          const settings = await invoke<ProjectSettings>('load_project_settings', { 
            request: { project_id: projectId } 
          });
          set({ settings }, false, 'projectStore/loadSettings');
        } catch (error) {
          console.warn('Failed to load project settings:', error);
          // Don't throw error for settings - use defaults
        }
      },
      
      // Actions - Project Metadata
      updateMetadata: (metadata: Partial<ProjectMetadata>) => {
        set(
          (state) => ({
            metadata: state.metadata ? { ...state.metadata, ...metadata } : null,
          }),
          false,
          'projectStore/updateMetadata'
        );
      },
      
      loadMetadata: async (projectId: string) => {
        try {
          const metadata = await invoke<ProjectMetadata>('load_project_metadata', { 
            request: { project_id: projectId } 
          });
          set({ metadata }, false, 'projectStore/loadMetadata');
        } catch (error) {
          console.warn('Failed to load project metadata:', error);
          // Don't throw error for metadata - use defaults
        }
      },
      
      // Actions - Error Handling
      setError: (error: AppError | null) => {
        set({ error }, false, 'projectStore/setError');
      },
      
      clearError: () => {
        set({ error: null }, false, 'projectStore/clearError');
      },
      
      // Getters
      getProjectById: (projectId: string) => {
        const state = get();
        return state.projects.find(p => p.id === projectId);
      },
      
      isProjectActive: (projectId: string) => {
        const state = get();
        return state.currentProject?.id === projectId;
      },
      
      getProjectPath: (projectId: string) => {
        const state = get();
        return state.getProjectById(projectId)?.projectPath || null;
      },
      
      getAssetsPath: (projectId: string) => {
        const state = get();
        return state.getProjectById(projectId)?.assetsPath || null;
      },
      
      getThumbnailsPath: (projectId: string) => {
        const state = get();
        return state.getProjectById(projectId)?.thumbnailsPath || null;
      },
    }),
    {
      name: 'project-store',
    }
  )
);
