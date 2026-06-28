const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const licenseManager = require('./license');

let mainWindow;

// Helper function to get resource paths
function getResourcePath(resourceName) {
  if (app.isPackaged) {
    // In production, resources are in the app's resources folder
    return path.join(process.resourcesPath, resourceName);
  } else {
    // In development, resources are in the project root
    return path.join(__dirname, resourceName);
  }
}

// Helper function to get ffmpeg path based on platform
function getFFmpegPath() {
  const platform = process.platform;
  let ffmpegName;

  if (platform === 'darwin') {
    ffmpegName = 'ffmpeg';
  } else if (platform === 'win32') {
    ffmpegName = 'ffmpeg.exe';
  } else {
    ffmpegName = 'ffmpeg';
  }

  const ffmpegPath = getResourcePath(path.join('ffmpeg', platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : 'linux', ffmpegName));

  return ffmpegPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index-v2.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Select audio files
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'aiff', 'm4a'] }
    ]
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

// Select output folder
ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

// Process audio files
ipcMain.handle('process-audio', async (event, options) => {
  const {
    inputFiles,
    outputFolder,
    splitMode, // 'time', 'bar', 'random', or 'transient'
    timeSeconds,
    bpm,
    musicalTime,
    randomCount,
    randomMinDuration,
    transientSensitivity,
    transientMinGap,
    namingPattern,
    silenceThreshold,
    enableKeyDetection,
    enableSimilarityGrouping,
    similarityThreshold,
    rrLabeling
  } = options;

  return new Promise((resolve, reject) => {
    // Get bundled Python executable path
    // Get ffmpeg path and set environment variable
    const ffmpegPath = getFFmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);

    // Get license status for limits
    const licenseStatus = licenseManager.getStatus();
    const isPro = licenseStatus.isPro;
    const maxSamples = isPro ? 999999 : licenseStatus.limits.maxSamples - licenseStatus.sessionSampleCount;
    const processingDelay = licenseManager.getProcessingDelay();

    // Determine which Python executable to use
    let pythonCmd, args;
    if (app.isPackaged) {
      // In production, use the compiled executable
      pythonCmd = getResourcePath(process.platform === 'win32' ? 'audioSplitCLI.exe' : 'audioSplitCLI');
      args = [
        '--input', JSON.stringify(inputFiles),
        '--output', outputFolder,
        '--mode', splitMode,
        '--naming', namingPattern,
        '--threshold', silenceThreshold.toString(),
        '--max-samples', maxSamples.toString(),
        '--delay', processingDelay.toString()
      ];
    } else {
      // In development, run the Python script directly using venv
      pythonCmd = path.join(__dirname, 'venv', 'bin', 'python');
      args = [
        path.join(__dirname, 'audioSplitCLI.py'),
        '--input', JSON.stringify(inputFiles),
        '--output', outputFolder,
        '--mode', splitMode,
        '--naming', namingPattern,
        '--threshold', silenceThreshold.toString(),
        '--max-samples', maxSamples.toString(),
        '--delay', processingDelay.toString()
      ];
    }

    if (splitMode === 'time') {
      args.push('--time', timeSeconds.toString());
    } else if (splitMode === 'bar') {
      args.push('--bpm', bpm.toString());
      args.push('--musical-time', musicalTime);
    } else if (splitMode === 'random') {
      args.push('--random-count', randomCount.toString());
      args.push('--random-min-duration', randomMinDuration.toString());
    } else if (splitMode === 'transient') {
      args.push('--transient-sensitivity', transientSensitivity.toString());
      args.push('--transient-min-gap', transientMinGap.toString());
    }

    if (enableKeyDetection) {
      args.push('--enable-key-detection');
    }

    if (enableSimilarityGrouping) {
      args.push('--enable-similarity-grouping');
      args.push('--similarity-threshold', similarityThreshold.toString());
      if (rrLabeling) {
        args.push('--rr-labeling');
      }
    }

    // Set up environment with ffmpeg path
    const env = { ...process.env };
    env.PATH = `${ffmpegDir}${path.delimiter}${env.PATH}`;

    const pythonProcess = spawn(pythonCmd, args, { env });

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      outputData += message;
      // Send progress updates to renderer
      event.sender.send('process-progress', message.trim());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        // Extract sample count from output and update license manager
        const exportedMatch = outputData.match(/Total exported: (\d+)/);
        if (exportedMatch) {
          const exportedCount = parseInt(exportedMatch[1]);
          licenseManager.incrementSampleCount(exportedCount);
        }
        resolve({ success: true, output: outputData });
      } else {
        const errorMsg = errorData || outputData || 'Processing failed';
        console.error('Python process failed:', errorMsg);
        reject(new Error(errorMsg));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Python process error:', error);
      reject(new Error(error.message || 'Failed to start Python process'));
    });
  });
});

// Get file info
ipcMain.handle('get-file-info', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      size: stats.size,
      path: filePath
    };
  } catch (error) {
    return { error: error.message };
  }
});

// License Management IPC Handlers

// Get license status
ipcMain.handle('get-license-status', async () => {
  return licenseManager.getStatus();
});

// Verify license key
ipcMain.handle('verify-license', async (event, licenseKey) => {
  return await licenseManager.verifyLicense(licenseKey);
});

// Remove license (for testing)
ipcMain.handle('remove-license', async () => {
  return licenseManager.removeLicense();
});

// Check if file can be processed (size limits)
ipcMain.handle('check-file-limits', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const sizeCheck = licenseManager.canProcessFile(stats.size);

    if (!sizeCheck.allowed) {
      return {
        allowed: false,
        reason: sizeCheck.reason,
        fileSizeMB: (stats.size / (1024 * 1024)).toFixed(1),
        limitMB: 25
      };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: error.message };
  }
});

// Open Gumroad purchase page
ipcMain.handle('open-purchase-page', async () => {
  const permalink = licenseManager.getGumroadPermalink();
  if (permalink && permalink !== 'YOUR_PERMALINK') {
    shell.openExternal(permalink);
    return { success: true };
  }
  return { success: false, error: 'Product URL not configured' };
});

// Open folder in system file explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read audio file for waveform visualization
ipcMain.handle('read-audio-file', async (event, filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer;
  } catch (error) {
    console.error('Error reading audio file:', error);
    throw error;
  }
});
