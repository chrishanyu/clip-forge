import React, { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { Project } from '@/types';
import './ProjectSelector.css';

// ============================================================================
// PROJECT SELECTOR COMPONENT
// ============================================================================

interface ProjectSelectorProps {
  className?: string;
  onProjectSelect?: (project: Project) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ 
  className = '', 
  onProjectSelect 
}) => {
  const { 
    projects, 
    currentProject, 
    loading, 
    error,
    createProject, 
    openProject, 
    listProjects 
  } = useProjectStore();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  // Load projects on mount
  useEffect(() => {
    listProjects().catch(console.error);
  }, [listProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const project = await createProject(newProjectName.trim(), newProjectDescription.trim());
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateForm(false);
      onProjectSelect?.(project);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleOpenProject = async (project: Project) => {
    try {
      await openProject(project.id);
      onProjectSelect?.(project);
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  if (loading) {
    return (
      <div className={`project-selector ${className}`}>
        <div className="loading-state">
          <div className="loading-spinner" />
          <div className="loading-text">Loading projects...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`project-selector ${className}`}>
        <div className="error-state">
          <div className="error-icon">⚠</div>
          <div className="error-message">{error.message}</div>
          <button 
            className="retry-button"
            onClick={() => listProjects()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`project-selector ${className}`}>
      <div className="project-header">
        <h2>Projects</h2>
        <button 
          className="create-project-button"
          onClick={() => setShowCreateForm(true)}
        >
          + New Project
        </button>
      </div>

      {showCreateForm && (
        <div className="create-project-form">
          <h3>Create New Project</h3>
          <form onSubmit={handleCreateProject}>
            <div className="form-group">
              <label htmlFor="project-name">Project Name</label>
              <input
                id="project-name"
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="project-description">Description (Optional)</label>
              <textarea
                id="project-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" disabled={!newProjectName.trim()}>
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="projects-list">
        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <div className="empty-text">No projects yet</div>
            <div className="empty-subtext">Create your first project to get started</div>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`project-item ${currentProject?.id === project.id ? 'active' : ''}`}
              onClick={() => handleOpenProject(project)}
            >
              <div className="project-info">
                <div className="project-name">{project.name}</div>
                {project.description && (
                  <div className="project-description">{project.description}</div>
                )}
                <div className="project-meta">
                  <span className="project-date">
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                  {project.isActive && (
                    <span className="active-indicator">Active</span>
                  )}
                </div>
              </div>
              <div className="project-actions">
                <button
                  className="open-project-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenProject(project);
                  }}
                >
                  {currentProject?.id === project.id ? 'Open' : 'Select'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
