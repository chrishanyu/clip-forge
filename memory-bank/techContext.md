# Technical Context

## Technology Stack

### Frontend Technologies

#### React 18
- **Version**: Latest stable (18.x)
- **Purpose**: UI framework
- **Why chosen**: 
  - Mature ecosystem
  - Good performance with proper optimization
  - Excellent TypeScript support
  - Virtual DOM handles updates efficiently

#### TypeScript
- **Version**: Latest stable (5.x)
- **Purpose**: Type-safe JavaScript
- **Why chosen**:
  - Catch errors at compile time
  - Better IDE support and autocomplete
  - Self-documenting code via types
  - Required for reliable Rust-TypeScript bridge

#### Zustand
- **Version**: Latest stable (4.x)
- **Purpose**: State management
- **Why chosen over Redux**:
  - Simpler API (less boilerplate)
  - Excellent TypeScript support
  - Small bundle size
  - No context provider boilerplate
  - Easy to test

#### Vite
- **Version**: Latest stable (5.x)
- **Purpose**: Build tool and dev server
- **Why chosen**:
  - Fast HMR (Hot Module Replacement)
  - Optimized production builds
  - Native ESM support
  - Comes with Tauri template

### Backend Technologies

#### Rust
- **Version**: Stable channel (1.70+)
- **Purpose**: System-level programming for Tauri backend
- **Why chosen**:
  - Memory safe without garbage collection
  - Excellent performance
  - Strong type system
  - Required by Tauri

#### Tauri 2.0
- **Version**: 2.0.x (latest stable)
- **Purpose**: Desktop application framework
- **Why chosen over Electron**:
  - Smaller bundle size (Rust vs Chromium)
  - Better performance
  - Native system integration
  - Active development and v2 improvements
  - Security-first design

**Key Tauri Plugins**:
- `tauri-plugin-shell`: Execute FFmpeg sidecar
- `tauri-plugin-dialog`: Native file dialogs
- `tauri-plugin-fs`: File system operations (built-in v2)

### Media Processing

#### FFmpeg
- **Version**: Latest static build (6.x or 7.x)
- **Purpose**: Video processing engine
- **Integration approach**: Bundled as Tauri sidecar
- **Why chosen**:
  - Industry standard for video processing
  - Supports all codecs and formats
  - Battle-tested and reliable
  - Zero compilation complexity as sidecar

**FFmpeg Binaries Required**:
- `ffmpeg-x86_64-apple-darwin` (Intel Macs)
- `ffmpeg-aarch64-apple-darwin` (Apple Silicon)

**Download from**: 
- https://evermeet.cx/ffmpeg/ (macOS static builds)
- Or official FFmpeg builds

### HTML5 Video API
- **Purpose**: Video playback in preview
- **Why chosen**:
  - Native browser support
  - No additional dependencies
  - Good codec support (H.264, H.265)
  - Simple API for control

## Development Environment

### Required Software

**System Requirements**:
- macOS 11.0 (Big Sur) or later
- Xcode Command Line Tools
- At least 4GB free disk space

**Development Tools**:
```bash
# Node.js and npm
node >= 18.x
npm >= 9.x

# Rust toolchain
rustc >= 1.70
cargo >= 1.70

# Tauri CLI
npm install -g @tauri-apps/cli
# or
cargo install tauri-cli
```

### Setup Commands

```bash
# Clone repository
git clone <repo-url>
cd clip-forge

# Install frontend dependencies
npm install

# Install Rust dependencies (automatic on first build)
cd src-tauri
cargo fetch

# Run development build
npm run tauri dev

# Build production .dmg
npm run tauri build
```

### Project Configuration Files

#### package.json
- Frontend dependencies
- npm scripts
- Build configuration

#### tauri.conf.json
- App metadata (name, version, identifier)
- Window configuration
- Bundle settings (icons, external binaries)
- Build targets

#### src-tauri/Cargo.toml
- Rust dependencies
- Package metadata
- Feature flags

#### src-tauri/capabilities/default.json
- Tauri v2 permissions system
- Defines what frontend can access in backend
- Shell execution permissions for FFmpeg

#### vite.config.ts
- Vite build configuration
- Plugin setup
- Alias configuration

#### tsconfig.json
- TypeScript compiler options
- Path mappings
- Strict mode enabled

## Key Dependencies

### Frontend Dependencies (package.json)
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "zustand": "^4.x",
    "uuid": "^9.x",
    "@tauri-apps/api": "^2.x",
    "@tauri-apps/plugin-shell": "^2.x",
    "@tauri-apps/plugin-dialog": "^2.x"
  },
  "devDependencies": {
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "@types/uuid": "^9.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.x",
    "vite": "^5.x"
  }
}
```

### Backend Dependencies (Cargo.toml)
```toml
[dependencies]
tauri = { version = "2.0", features = ["macos-private-api"] }
tauri-plugin-shell = "2.0"
tauri-plugin-dialog = "2.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
regex = "1.0"  # For parsing FFmpeg output
```

## File Formats & Codecs

### Supported Input Formats
- MP4 (H.264, H.265)
- MOV (QuickTime, H.264)
- WebM (VP8, VP9)

### Output Format
- MP4 container
- H.264 video codec (most compatible)
- AAC audio codec

### Codec Compatibility
**Browser playback** (HTML5 video):
- ✅ H.264 (best support)
- ✅ H.265 (Safari only)
- ❌ VP9 (no native Safari support)

**Export encoding**:
- MVP: `-c copy` (stream copy, no re-encoding)
- Future: `-c:v libx264` (re-encode for effects/trim)

## Build & Deployment

### Development Build
```bash
npm run tauri dev
```
- Compiles Rust in debug mode
- Starts Vite dev server with HMR
- Opens application window
- Fast iteration (<10 seconds)

### Production Build
```bash
npm run tauri build
```
- Compiles Rust in release mode (optimized)
- Builds frontend for production
- Bundles FFmpeg binaries
- Creates .dmg installer
- Takes 5-10 minutes

### Build Outputs
```
src-tauri/target/release/bundle/
├── dmg/
│   └── ClipForge_0.1.0_x64.dmg       # Intel build
│   └── ClipForge_0.1.0_aarch64.dmg   # Apple Silicon build
└── macos/
    └── ClipForge.app                  # Application bundle
```

### Bundle Size Expectations
- Application binary: ~5-10 MB
- FFmpeg binary: ~100 MB per architecture
- Total .dmg size: ~120-150 MB

## Environment-Specific Considerations

### Development
- Hot reload for frontend changes
- Rust changes require restart
- FFmpeg must be in `src-tauri/bin/` even in dev
- Use debug logging

### Production
- Optimized Rust binary
- Minified frontend assets
- FFmpeg bundled in .app
- Limited logging

## Debugging & Tools

### Frontend Debugging
- Chrome DevTools (built into app in dev mode)
- React DevTools extension
- Console logging
- Network tab for Tauri IPC

### Backend Debugging
- `println!` macros in Rust
- `dbg!` macro for quick inspection
- Xcode Console.app for app logs
- `cargo run` for direct execution

### Performance Profiling
- Chrome DevTools Performance tab
- `cargo instruments` (macOS profiler)
- Activity Monitor for CPU/memory

## Known Technical Constraints

### macOS-Specific
- Screen recording requires permission prompt (first use)
- Camera/mic access requires permission prompts
- Must notarize for distribution (post-MVP)
- Code signing required for Gatekeeper (post-MVP)

### FFmpeg Limitations
- Static binaries are large (~100MB each)
- No hardware acceleration in static builds (may be limited)
- Must handle platform detection correctly

### Browser Limitations
- HTML5 video codec support varies
- Seeking accuracy depends on keyframes
- Can't play some exotic formats
- Performance degrades with very long videos (>1hr)

### Tauri Limitations
- IPC has serialization overhead (keep data transfers small)
- Can't pass binary data easily (use file paths)
- File system access is sandboxed

## Technical Debt & Future Considerations

### Known Shortcuts (MVP)
- DOM-based timeline (may need Canvas later)
- No undo/redo
- Limited error handling
- Simple concat export only
- No unit tests (initially)

### Post-MVP Improvements
- Comprehensive test suite
- Better error boundaries
- Structured logging
- Performance optimizations
- Code documentation
- CI/CD pipeline

## Security Considerations

### Tauri Security Model
- Permissions must be explicit in capabilities file
- No arbitrary code execution
- File access sandboxed
- IPC commands must be registered

### Data Privacy
- All processing happens locally
- No telemetry or analytics
- No network requests
- User data never leaves machine

## Version Control

### Git Strategy
- Main branch: stable code
- Feature branches for new work
- Commit often, push regularly
- Tag releases: `v0.1.0-mvp`, `v0.1.0`

### What to Commit
- Source code (src/, src-tauri/src/)
- Configuration files
- Package manifests
- README and docs
- Icons and assets

### What to Ignore
- node_modules/
- src-tauri/target/
- dist/
- FFmpeg binaries (too large for Git)
- .DS_Store
- IDE-specific files

