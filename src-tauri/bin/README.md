# FFmpeg Binaries

This directory contains the FFmpeg sidecar binaries required for video processing.

## Setup Instructions

1. Download the appropriate FFmpeg binaries for your architecture:
   - **Intel Mac**: Download from [FFmpeg releases](https://github.com/eugeneware/ffmpeg-static/releases) or build from source
   - **Apple Silicon Mac**: Download from [FFmpeg releases](https://github.com/eugeneware/ffmpeg-static/releases) or build from source

2. Place the binaries in this directory with the following names:
   - `ffmpeg-x86_64-apple-darwin` (Intel Mac)
   - `ffmpeg-aarch64-apple-darwin` (Apple Silicon Mac)

3. Make the binaries executable:
   ```bash
   chmod +x ffmpeg-x86_64-apple-darwin
   chmod +x ffmpeg-aarch64-apple-darwin
   ```

4. Test the binaries work:
   ```bash
   ./ffmpeg-x86_64-apple-darwin -version
   ./ffmpeg-aarch64-apple-darwin -version
   ```

## Notes

- These binaries are not committed to git due to their large size (~50-80MB each)
- The app will automatically select the correct binary based on the system architecture
- Ensure the binaries have the exact names specified above for Tauri sidecar integration
