import { MediaLibrary } from "@/components/MediaLibrary";
import { VideoPlayer } from "@/components/Preview";
import { Timeline } from "@/components/Timeline";
import { ToastContainer } from "@/components/Toast";
import { DragOverlay } from "@/components/DragOverlay";
import { DragDropProvider } from "@/contexts/DragDropContext";
import { useToastStore } from "@/stores/toastStore";
import { useProjectStore } from "@/stores/projectStore";
import { useMediaStore } from "@/stores/mediaStore";
import { useEffect } from "react";
import "./App.css";

function App() {
  const { toasts, removeToast } = useToastStore();
  const { currentProject, createProject, loading: projectLoading, error: projectError } = useProjectStore();
  const { clearClips } = useMediaStore();

  // Auto-create a default project on app start
  useEffect(() => {
    if (!currentProject && !projectLoading) {
      // Clear any existing clips from old import system
      clearClips();
      
      createProject('Default Project', 'Main video editing workspace').catch((error) => {
        console.error('Failed to create default project:', error);
      });
    }
  }, [currentProject, createProject, clearClips, projectLoading]);

  // Show loading state while project is being created
  if (projectLoading) {
    return (
      <div className="app">
        <div className="app-loading">
          <div className="loading-spinner" />
          <div className="loading-text">Setting up workspace...</div>
        </div>
      </div>
    );
  }

  // Show error state if project creation failed
  if (projectError) {
    return (
      <div className="app">
        <div className="app-error">
          <div className="error-icon">⚠</div>
          <div className="error-message">Failed to create workspace</div>
          <div className="error-details">{projectError.message}</div>
          <button 
            className="retry-button"
            onClick={() => createProject('Default Project', 'Main video editing workspace')}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DragDropProvider>
      <div className="app">
        <div className="app-layout">
          <div className="app-sidebar">
            <MediaLibrary />
          </div>
          <div className="app-main">
            <VideoPlayer />
            <div className="app-timeline">
              <Timeline />
            </div>
          </div>
        </div>
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
        <DragOverlay />
      </div>
    </DragDropProvider>
  );
}

export default App;
