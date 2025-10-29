// ============================================================================
// FFMPEG MODULE
// ============================================================================
// This module contains FFmpeg integration functionality for video processing.

pub mod export;
pub mod probe;
pub mod thumbnail;

// Re-export commonly used types and functions
pub use export::*;
pub use probe::*;
pub use thumbnail::*;
