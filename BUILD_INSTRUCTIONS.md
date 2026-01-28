# Build Instructions for Mudpie Chopper

## Prerequisites

1. **Node.js and npm** installed
2. **Python 3.12** with venv
3. **ffmpeg** installed on your system
4. All dependencies installed: `npm install`

## Step 1: Download ffmpeg Binaries

### macOS (automated):
```bash
./download-ffmpeg.sh
```

This automatically downloads macOS ffmpeg.

### Windows:
1. Download from: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
2. Extract `ffmpeg.exe` to `resources/ffmpeg/win/`

### Linux:
1. Download from: https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
2. Extract `ffmpeg` binary to `resources/ffmpeg/linux/`

## Step 2: Build Python Executable

```bash
npm run build-python
```

This creates a standalone Python executable in `dist/audioSplitCLI` using PyInstaller.

## Step 3: Build the Electron App

### For macOS:
```bash
npm run build:mac
```

Output: `dist/Mudpie Chopper.dmg` and `dist/Mudpie Chopper-mac.zip`

### For Windows (requires wine on macOS/Linux):
```bash
npm run build:win
```

Output: `dist/Mudpie Chopper Setup.exe` and portable version

### For Linux:
```bash
npm run build:linux
```

Output: `dist/Mudpie Chopper.AppImage` and `.deb` package

### For All Platforms:
```bash
npm run build:all
```

## What Gets Bundled

The app bundles:
- ✅ Python executable (audioSplitCLI)
- ✅ ffmpeg binary (platform-specific)
- ✅ All Electron app files
- ✅ App icons

Users don't need to install Python, ffmpeg, or any dependencies!

## Testing the Build

After building, test the app:
1. Open the generated `.app` (macOS), `.exe` (Windows), or `.AppImage` (Linux)
2. Select an audio file
3. Configure split settings
4. Choose output folder
5. Click "Split Audio" and verify it works

## Troubleshooting

**Python executable fails:**
- Make sure venv is activated when running `npm run build-python`
- Check that pydub is installed in venv

**ffmpeg not found:**
- Verify ffmpeg binaries are in `resources/ffmpeg/{platform}/`
- Check permissions: `chmod +x resources/ffmpeg/mac/ffmpeg`

**Build fails:**
- Run `npm run build-python` manually first
- Check that dist/audioSplitCLI exists before building Electron app

## Distribution

Upload the built files from `dist/` folder:
- macOS: `.dmg` file (easier) or `.zip` (smaller)
- Windows: Setup `.exe` (installer) or portable version
- Linux: `.AppImage` (universal) or `.deb` (Debian/Ubuntu)
