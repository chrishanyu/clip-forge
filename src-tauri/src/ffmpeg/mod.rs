// ============================================================================
// FFMPEG MODULE
// ============================================================================
// This module contains FFmpeg integration functionality for video processing.

pub mod probe;
pub mod thumbnail;
pub mod export;

// Re-export commonly used types and functions
pub use probe::*;
pub use thumbnail::*;
pub use export::*;
