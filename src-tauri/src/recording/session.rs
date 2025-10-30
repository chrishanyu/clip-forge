/**
 * Recording Session Management
 * 
 * Handles recording session lifecycle, progress tracking, and cleanup.
 * Provides a unified interface for managing different types of recording sessions.
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
// use std::time::{Duration, Instant};

/// Recording session type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingSessionType {
    Screen,
    Camera,
    PiP,
}

/// Recording session status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingSessionStatus {
    Idle,
    Preparing,
    Recording,
    Paused,
    Stopping,
    Error,
}

/// Recording session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSessionInfo {
    pub id: String,
    pub session_type: RecordingSessionType,
    pub status: RecordingSessionStatus,
    pub start_time: Option<String>,
    pub duration: f64,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

/// Recording progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingProgress {
    pub session_id: String,
    pub duration: f64,
    pub file_size: u64,
    pub frame_count: u64,
    pub is_recording: bool,
}

/// Recording session manager
pub struct RecordingSessionManager {
    sessions: Arc<Mutex<HashMap<String, RecordingSessionInfo>>>,
    active_sessions: Arc<Mutex<Vec<String>>>,
}

impl RecordingSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            active_sessions: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Create a new recording session
    pub fn create_session(
        &self,
        session_type: RecordingSessionType,
    ) -> Result<String, String> {
        let session_id = format!("recording_{}", chrono::Utc::now().timestamp_millis());
        
        let session_info = RecordingSessionInfo {
            id: session_id.clone(),
            session_type: session_type.clone(),
            status: RecordingSessionStatus::Idle,
            start_time: None,
            duration: 0.0,
            file_path: None,
            error: None,
        };

        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        sessions.insert(session_id.clone(), session_info.clone());
        
        Ok(session_id)
    }

    /// Start a recording session
    pub fn start_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = RecordingSessionStatus::Recording;
            session.start_time = Some(chrono::Utc::now().to_rfc3339());
            
            let mut active_sessions = self.active_sessions.lock().map_err(|e| format!("Failed to lock active sessions: {}", e))?;
            if !active_sessions.contains(&session_id.to_string()) {
                active_sessions.push(session_id.to_string());
            }
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Stop a recording session
    pub fn stop_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = RecordingSessionStatus::Stopping;
            
            let mut active_sessions = self.active_sessions.lock().map_err(|e| format!("Failed to lock active sessions: {}", e))?;
            active_sessions.retain(|id| id != session_id);
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Pause a recording session
    pub fn pause_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = RecordingSessionStatus::Paused;
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Resume a recording session
    pub fn resume_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = RecordingSessionStatus::Recording;
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Update session progress
    pub fn update_progress(&self, session_id: &str, duration: f64, _file_size: u64, _frame_count: u64) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.duration = duration;
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Update session file path
    pub fn update_file_path(&self, session_id: &str, file_path: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.file_path = Some(file_path.clone());
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Set session error
    pub fn set_session_error(&self, session_id: &str, error: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = RecordingSessionStatus::Error;
            session.error = Some(error);
            
            let mut active_sessions = self.active_sessions.lock().map_err(|e| format!("Failed to lock active sessions: {}", e))?;
            active_sessions.retain(|id| id != session_id);
        } else {
            return Err("Session not found".to_string());
        }
        
        Ok(())
    }

    /// Get session information
    pub fn get_session(&self, session_id: &str) -> Result<RecordingSessionInfo, String> {
        let sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get(session_id) {
            Ok(session.clone())
        } else {
            Err("Session not found".to_string())
        }
    }

    /// Get all active sessions
    pub fn get_active_sessions(&self) -> Result<Vec<RecordingSessionInfo>, String> {
        let sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        let active_sessions = self.active_sessions.lock().map_err(|e| format!("Failed to lock active sessions: {}", e))?;
        
        let mut result = Vec::new();
        for session_id in active_sessions.iter() {
            if let Some(session) = sessions.get(session_id) {
                result.push(session.clone());
            }
        }
        
        Ok(result)
    }

    /// Clean up completed sessions
    pub fn cleanup_completed_sessions(&self) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        let active_sessions = self.active_sessions.lock().map_err(|e| format!("Failed to lock active sessions: {}", e))?;
        
        // Remove sessions that are not active and older than 1 hour
        let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(1);
        
        sessions.retain(|session_id, session| {
            let is_active = active_sessions.contains(session_id);
            let is_recent = session.start_time
                .as_ref()
                .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
                .map(|dt| dt > cutoff_time)
                .unwrap_or(true);
            
            is_active || is_recent
        });
        
        Ok(())
    }

    /// Get recording progress for a session
    pub fn get_session_progress(&self, session_id: &str) -> Result<RecordingProgress, String> {
        let sessions = self.sessions.lock().map_err(|e| format!("Failed to lock sessions: {}", e))?;
        
        if let Some(session) = sessions.get(session_id) {
            Ok(RecordingProgress {
                session_id: session_id.to_string(),
                duration: session.duration,
                file_size: 0, // TODO: Calculate actual file size
                frame_count: 0, // TODO: Calculate actual frame count
                is_recording: matches!(session.status, RecordingSessionStatus::Recording),
            })
        } else {
            Err("Session not found".to_string())
        }
    }
}

impl Default for RecordingSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global recording session manager instance
lazy_static::lazy_static! {
    pub static ref RECORDING_MANAGER: RecordingSessionManager = RecordingSessionManager::new();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session() {
        let manager = RecordingSessionManager::new();
        let session_id = manager.create_session(RecordingSessionType::Screen).unwrap();
        assert!(!session_id.is_empty());
        
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.session_type, RecordingSessionType::Screen);
        assert_eq!(session.status, RecordingSessionStatus::Idle);
    }

    #[test]
    fn test_start_stop_session() {
        let manager = RecordingSessionManager::new();
        let session_id = manager.create_session(RecordingSessionType::Camera).unwrap();
        
        manager.start_session(&session_id).unwrap();
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.status, RecordingSessionStatus::Recording);
        
        manager.stop_session(&session_id).unwrap();
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.status, RecordingSessionStatus::Stopping);
    }

    #[test]
    fn test_pause_resume_session() {
        let manager = RecordingSessionManager::new();
        let session_id = manager.create_session(RecordingSessionType::PiP).unwrap();
        
        manager.start_session(&session_id).unwrap();
        manager.pause_session(&session_id).unwrap();
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.status, RecordingSessionStatus::Paused);
        
        manager.resume_session(&session_id).unwrap();
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.status, RecordingSessionStatus::Recording);
    }

    #[test]
    fn test_update_progress() {
        let manager = RecordingSessionManager::new();
        let session_id = manager.create_session(RecordingSessionType::Screen).unwrap();
        
        manager.update_progress(&session_id, 30.5, 1024000, 900).unwrap();
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.duration, 30.5);
    }

    #[test]
    fn test_set_session_error() {
        let manager = RecordingSessionManager::new();
        let session_id = manager.create_session(RecordingSessionType::Camera).unwrap();
        
        manager.set_session_error(&session_id, "Test error".to_string()).unwrap();
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.status, RecordingSessionStatus::Error);
        assert_eq!(session.error, Some("Test error".to_string()));
    }
}
