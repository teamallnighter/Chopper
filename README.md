# Mudpie Chopper 2.0

**Bass Daddy Devices** — An Electron desktop application for splitting audio recordings into individual sample chunks. Built for music producers who need to chop long recordings into bars, hits, or one-shots.

## Features

- **Four Split Modes:**
  - **Time** — Split by fixed duration (seconds)
  - **Bar** — Split by musical bars using BPM (1/16 note to 8 bars)
  - **Transient** — Split at detected attack points using onset detection
  - **Random** — Split at random positions with configurable count and minimum duration

- **Musical Key Detection:**
  - Automatic key and mode detection (C major, F# minor, etc.)
  - Uses chroma feature analysis with Krumhansl-Schmuckler algorithm
  - Embed detected key in output filenames with `{key}` template variable

- **Similarity Grouping:**
  - Groups similar-sounding chunks using MFCC fingerprint analysis
  - Configurable similarity threshold
  - Adds group suffixes (a, b, c) to filenames automatically

- **Round Robin Labeling:**
  - Optional RR1, RR2, RR3 suffixes for sampler round-robin compatibility
  - Works with similarity grouping to tag similar sounds

- **Random Name Generator:**
  - Generate unique sample names from 4M+ adjective/noun/suffix combinations
  - Use `{random}` in naming patterns for creative, unique filenames

- **Waveform Preview:**
  - Interactive waveform visualization powered by Peaks.js
  - Overview and zoomable waveform views

- **Smart Processing:**
  - Automatic silence detection and filtering (configurable dBFS threshold)
  - Audio normalization for consistent output levels
  - 24-bit WAV export quality

- **Flexible Output:**
  - Naming presets: Original, +Key, Random, Random+Key
  - Custom naming patterns with template variables
  - Choose any output folder
  - Batch process multiple files

## Installation

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Set up Python environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install pydub librosa numpy
   ```

3. **Install ffmpeg:**
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`
   - Windows: Download from [ffmpeg.org](https://ffmpeg.org)

## Usage

1. **Start the application:**
   ```bash
   npm start
   ```

2. **Select your audio files** (mudpies) using the file picker

3. **Choose a split mode:**
   - Time: Enter duration in seconds
   - Bar: Enter BPM and select musical time division
   - Transient: Adjust sensitivity and minimum gap
   - Random: Set number of chunks and minimum duration

4. **Configure settings:**
   - Silence threshold (default -50 dBFS)
   - Enable key detection to tag files with musical key
   - Enable similarity grouping to organize similar sounds
   - Choose a naming preset or enter a custom pattern

5. **Select output folder and click "Split Audio"**

## File Naming

### Preset Buttons

| Preset | Pattern | Example Output |
|--------|---------|----------------|
| Original | `{filename}_{number:03d}` | `mysample_001.wav` |
| + Key | `{filename}_{key}_{number:03d}` | `mysample_Cmin_001.wav` |
| Random | `{random}_{number:03d}` | `Crispy_Snare_Punch_001.wav` |
| Random + Key | `{random}_{key}` | `Crispy_Snare_Punch_Cmin.wav` |

### Template Variables

| Variable | Description |
|----------|-------------|
| `{filename}` | Original filename without extension |
| `{number}` | Sequential chunk number |
| `{number:03d}` | Zero-padded chunk number (001, 002, ...) |
| `{key}` | Detected musical key (requires key detection) |
| `{random}` | Random name (adjective_noun_suffix) |

## Development

Run in development mode with DevTools:
```bash
npm run dev
```

Build Tailwind CSS:
```bash
npm run build-css    # One-time build
npm run watch-css    # Watch mode
```

Build Python backend with PyInstaller:
```bash
npm run build-python
```

Build desktop app:
```bash
npm run build:mac    # macOS (DMG + ZIP)
npm run build:win    # Windows (NSIS + Portable)
npm run build:linux  # Linux (AppImage + DEB)
```

## Supported Audio Formats

**Input:** WAV, MP3, FLAC, AIFF, M4A

**Output:** 24-bit PCM WAV

## Tech Stack

- **Frontend:** Electron 28, vanilla JS, Tailwind CSS, Peaks.js (waveform)
- **Backend:** Python 3.12, pydub, librosa, numpy
- **Build:** PyInstaller, electron-builder, Tailwind CLI
- **Audio:** ffmpeg (codec support via pydub)

## License

MIT
