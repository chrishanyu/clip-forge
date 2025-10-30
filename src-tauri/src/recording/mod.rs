/**
 * Recording Module
 * 
 * This module handles all recording functionality including screen recording,
 * webcam recording, and Picture-in-Picture recording using AVFoundation.
 */

pub mod screen;
pub mod camera;
pub mod pip;
pub mod session;
pub mod permissions;
pub mod process_manager;

// Re-export the main functionality
pub use screen::*;
pub use camera::*;
pub use pip::*;
pub use session::*;
pub use process_manager::*;
