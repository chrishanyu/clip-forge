/**
 * Recording Process Manager
 * 
 * Manages FFmpeg recording processes, allowing them to be started and stopped.
 */

use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

/// Recording process manager
pub struct RecordingProcessManager {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl RecordingProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start an FFmpeg recording process
    pub fn start_process(
        &self,
        session_id: String,
        ffmpeg_path: String,
        args: Vec<String>,
    ) -> Result<(), String> {
        // Spawn FFmpeg process
        let mut child = Command::new(&ffmpeg_path)
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                eprintln!("Failed to spawn FFmpeg: {}", e);
                format!("Failed to spawn FFmpeg process: {}", e)
            })?;

        // Read stderr in a separate thread to capture FFmpeg errors
        if let Some(stderr) = child.stderr.take() {
            use std::io::{BufRead, BufReader};
            let session_id_clone = session_id.clone();
            
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        // Only log errors
                        if line.contains("error") || line.contains("Error") || line.contains("ERROR") {
                            eprintln!("[FFmpeg:{}] {}", session_id_clone, line);
                        }
                    }
                }
            });
        }

        // Store the process
        let mut processes = self
            .processes
            .lock()
            .map_err(|e| format!("Failed to lock processes: {}", e))?;
        processes.insert(session_id.clone(), child);

        Ok(())
    }

    /// Stop a recording process
    pub fn stop_process(&self, session_id: &str) -> Result<(), String> {
        let mut processes = self
            .processes
            .lock()
            .map_err(|e| format!("Failed to lock processes: {}", e))?;

        if let Some(mut child) = processes.remove(session_id) {
            // Get the process ID before we consume child
            let pid = child.id();

            // On Unix, send SIGINT (Ctrl+C) to allow FFmpeg to finalize the file
            #[cfg(unix)]
            {
                use std::process::Command as StdCommand;
                
                // Send SIGINT using kill command
                let result = StdCommand::new("kill")
                    .args(&["-INT", &pid.to_string()])
                    .output();
                
                if let Err(e) = result {
                    eprintln!("Failed to send SIGINT to FFmpeg: {}", e);
                }
                
                // Give FFmpeg 5 seconds to finalize the file
                std::thread::sleep(std::time::Duration::from_secs(5));
            }

            // Now wait for the process to exit
            match child.wait() {
                Ok(_) => Ok(()),
                Err(e) => {
                    eprintln!("Failed to wait for FFmpeg process: {}", e);
                    // If waiting fails, try to kill it forcefully
                    let _ = child.kill();
                    Err(format!("Failed to stop recording process: {}", e))
                }
            }
        } else {
            Err("No active recording process found".to_string())
        }
    }

    /// Check if a process is running for a session
    pub fn is_process_running(&self, session_id: &str) -> bool {
        let processes = self.processes.lock().unwrap();
        processes.contains_key(session_id)
    }

    /// Get all active process session IDs
    pub fn get_active_sessions(&self) -> Vec<String> {
        let processes = self.processes.lock().unwrap();
        processes.keys().cloned().collect()
    }
}

impl Default for RecordingProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global recording process manager instance
lazy_static::lazy_static! {
    pub static ref PROCESS_MANAGER: RecordingProcessManager = RecordingProcessManager::new();
}

