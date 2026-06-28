# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mudpie Chopper 2.0** by Bass Daddy Devices — an Electron desktop application for splitting audio recordings into individual sample chunks. Supports four split modes (time, bar, random, transient), musical key detection, similarity grouping, round robin labeling, and random name generation. Designed for music production workflows where you need to chop samples from extended recordings.

## Environment Setup

**Node.js Dependencies:**
```bash
npm install
```

**Python Virtual Environment:**
```bash
source venv/bin/activate
```

**Python Dependencies:**
- Python 3.12
- pydub 0.25.1 (audio I/O and chunking)
- librosa (key detection via chroma_cqt, onset/transient detection)
- numpy (numerical operations, MFCC fingerprinting)
- ffmpeg (required by pydub for audio codec support)

Install Python dependencies:
```bash
pip install pydub librosa numpy
```

Note: ffmpeg must be installed separately on the system for pydub to handle audio encoding/decoding.

**CSS Build (Tailwind):**
```bash
npm run build-css
# or watch mode:
npm run watch-css
```

## Running the Application

**Electron App (GUI):**
```bash
npm start
```

**Development mode with DevTools:**
```bash
npm run dev
```

**Build Python backend (PyInstaller):**
```bash
npm run build-python
```

**Legacy CLI Script (deprecated):**
```bash
python audioSplit.py
```

## Application Architecture

### Electron App Structure

**Main Process ([main.js](main.js)):**
- Creates BrowserWindow and manages app lifecycle
- Handles IPC communication between renderer and Python backend
- Provides file/folder selection dialogs
- Spawns Python subprocess for audio processing
- Streams progress updates back to UI
- Passes all split options (mode, key detection, similarity, RR labeling) as CLI args

**Renderer Process (v2 UI):**
- [index-v2.html](index-v2.html) - UI structure with Tailwind CSS, laid out as a 5-step wizard
- [renderer-v2.js](renderer-v2.js) - Client-side logic, event handling, state management
- [styles.css](styles.css) - Compiled Tailwind output
- [styles-src.css](styles-src.css) - Tailwind source with custom directives
- [preload.js](preload.js) - Secure IPC bridge using contextBridge

**Legacy Renderer (v1):**
- [index.html](index.html) - Original UI
- [renderer.js](renderer.js) - Original client-side logic

**Python Backend ([audioSplitCLI.py](audioSplitCLI.py)):**
- Command-line interface called by Electron main process
- Accepts CLI arguments for batch processing
- Supports four split modes: time, bar, random, transient
- Musical key detection via librosa chroma features
- Similarity grouping via MFCC fingerprints and cosine similarity
- Round robin (RR) labeling for sampler compatibility
- Random name generation from word lists
- Logs progress to stdout (captured by Electron)
- Handles multiple audio formats (WAV, MP3, FLAC, AIFF, M4A)

**Name Generator ([names.py](names.py)):**
- Word lists for random name generation: ADJECTIVES (827), NOUNS (94), SUFFIXES (52)
- Over 4 million unique combinations
- Imported by audioSplitCLI.py

### Data Flow

1. User selects files via Electron dialog -> stored in renderer state
2. User configures split settings (mode, threshold, naming, key detection, similarity)
3. User selects output folder and clicks "CHOP MUDPIE"
4. Renderer sends IPC message to main process with all options
5. Main process spawns Python CLI with arguments
6. Python processes files, logs progress to stdout
7. Main process streams progress to renderer via IPC events, shown in a full-screen processing overlay
8. Renderer displays final results (success message or error) in place of the overlay

### Processing Modes

**Time Mode:**
- Splits audio into fixed-duration chunks (seconds)
- User specifies duration in seconds

**Bar Mode (BPM-based):**
- Splits audio into musical time divisions
- Uses MUSICAL_TIME_MAP: 1/16, 1/8, 1/4, 1/2, 1 bar, 2 bars, 4 bars, 8 bars
- Chunk length calculated from BPM and musical time division

**Random Mode:**
- Splits audio at random positions
- User specifies number of chunks and minimum duration
- Produces varied, unpredictable chops

**Transient Mode:**
- Uses librosa onset detection to find transients
- Splits at detected attack points
- Configurable sensitivity (0.0-1.0) and minimum gap between transients

**Common Processing (all modes):**
1. Audio is chunked at calculated/detected points
2. Silent chunks below dBFS threshold are skipped
3. Non-silent chunks are normalized to peak level
4. Exported as 24-bit PCM WAV files
5. Chunk numbering is sequential (no gaps for skipped chunks)

### Key Detection

- Uses librosa's chroma_cqt features with Krumhansl-Schmuckler algorithm
- Detects key (C, C#, D, etc.) and mode (major/minor)
- Returns confidence score
- Available as `{key}` template variable in naming patterns
- Optional — enabled via checkbox in UI

### Similarity Grouping

- Extracts MFCC fingerprints from exported chunks
- Computes cosine similarity between all chunk pairs
- Groups similar chunks using locality-aware clustering
- Renames files with group suffixes (a, b, c or RR1, RR2, RR3)
- Configurable similarity threshold (0.0-1.0, default 0.85)

### Naming Patterns

Supports template variables in output filenames:
- `{filename}` - Original filename without extension
- `{number}` - Sequential chunk number
- `{number:03d}` - Zero-padded chunk number (e.g., 001, 002)
- `{key}` - Detected musical key (requires key detection enabled)
- `{random}` - Random name from adjective_noun_suffix word lists

**Preset buttons in UI:**
- Original: `{filename}_{number:03d}`
- \+ Key: `{filename}_{key}_{number:03d}`
- Random: `{random}_{number:03d}`
- Random + Key: `{random}_{key}`

Default pattern: `{filename}_{number:03d}`

### UI Layout (v2)

- Single-column wizard: 5 steps, each `<section>` is `min-h-screen` and vertically centers its card (Select Mudpie, Split Mode, Advanced Options, Output Folder, Chop Mudpie)
- Each step (except the last) has a "Next ↓" button that smooth-scrolls to the next section; normal page scrolling still works everywhere — Next is a convenience, not a gate (no validation blocks moving forward)
- No responsive multi-column grid — the layout is intentionally always the narrow single-column style regardless of window width
- "2. Split Mode" shows a live chunk-count estimate that recomputes on every relevant input change. Random mode echoes its count input directly; Time/Bar/Transient modes estimate from the first selected file's duration, read via a plain `<audio>` element's `loadedmetadata` event (no waveform rendering or Python involved) — see `loadPreviewDuration()`/`recomputeChunkEstimate()` in [renderer-v2.js](renderer-v2.js)
- The processing indicator (`#progress-section`) and the license upsell (`#license-modal`) are both full-screen overlays (`fixed inset-0` + backdrop blur), not inline page content — follow that pattern for any other modal-style UI

## Build & Packaging

**PyInstaller (Python backend):**
```bash
./build-python.sh
```
- Bundles audioSplitCLI.py + names.py + all Python dependencies
- Output: `dist/audioSplitCLI` (standalone executable)
- Spec file: [audioSplitCLI.spec](audioSplitCLI.spec)

**Electron Builder (desktop app):**
```bash
npm run build:mac   # macOS (DMG + ZIP)
npm run build:win   # Windows (NSIS + Portable)
npm run build:linux # Linux (AppImage + DEB)
```

**Tailwind CSS:**
```bash
npm run build-css   # One-time build
npm run watch-css   # Watch mode for development
```

## Directory Structure

```
.
├── main.js              - Electron main process
├── preload.js           - IPC security bridge
├── index-v2.html        - App UI (v2, current)
├── renderer-v2.js       - Client-side JavaScript (v2, current)
├── index.html           - App UI (v1, legacy)
├── renderer.js          - Client-side JavaScript (v1, legacy)
├── styles.css           - Compiled Tailwind CSS
├── styles-src.css       - Tailwind source CSS
├── tailwind.config.js   - Tailwind configuration
├── audioSplitCLI.py     - Python CLI for audio processing
├── audioSplitCLI.spec   - PyInstaller spec file
├── names.py             - Word lists for random name generation
├── audioSplit.py        - Legacy standalone script (deprecated)
├── build-python.sh      - PyInstaller build script
├── download-ffmpeg.sh   - ffmpeg download helper
├── license.js           - License management
├── package.json         - Node dependencies and scripts
├── assets/              - App icons and images
├── resources/           - Bundled binaries (ffmpeg, audiowaveform)
├── venv/                - Python virtual environment
├── mudpies/             - Example input audio files
├── samples/             - Default output location
└── .claude/             - Project documentation
    ├── docs/            - Tech stack documentation
    ├── reports/         - Analysis reports
    ├── todos/           - Task tracking
    └── agents/          - Agent configurations
```

## Key Implementation Details

**Security:**
- Uses contextIsolation and contextBridge for secure IPC
- No nodeIntegration in renderer process
- All file system operations handled in main process

**Error Handling:**
- Python errors streamed to stderr, caught by main process
- Errors displayed in UI with user-friendly messages
- Failed processing doesn't crash the app

**Audio Format Support:**
- pydub auto-detects most formats via ffmpeg
- Explicit handlers for WAV, MP3, FLAC, AIFF, M4A
- All exports are 24-bit WAV regardless of input format

**UI State Management:**
- Vanilla JS with DOM manipulation (no framework)
- Tailwind CSS for styling with custom theme colors (bass-pink, bass-dark)
- State stored in module-level variables
- Real-time progress updates via IPC events
- Process button disabled until files and output folder selected
