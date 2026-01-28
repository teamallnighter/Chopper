// State
let selectedFiles = [];
let outputFolder = null;

// DOM Elements
const selectFilesBtn = document.getElementById('select-files-btn');
const fileList = document.getElementById('file-list');
const selectOutputBtn = document.getElementById('select-output-btn');
const outputPath = document.getElementById('output-path');
const processBtn = document.getElementById('process-btn');
const progressSection = document.getElementById('progress-section');
const progressLog = document.getElementById('progress-log');
const resultSection = document.getElementById('result-section');
const resultMessage = document.getElementById('result-message');
const chopAnotherBtn = document.getElementById('chop-another-btn');
const openFolderBtn = document.getElementById('open-folder-btn');

// Settings Elements
const splitModeRadios = document.querySelectorAll('input[name="split-mode"]');
const timeSettings = document.getElementById('time-settings');
const barSettings = document.getElementById('bar-settings');
const randomSettings = document.getElementById('random-settings');
const transientSettings = document.getElementById('transient-settings');
const timeSeconds = document.getElementById('time-seconds');
const bpm = document.getElementById('bpm');
const musicalTime = document.getElementById('musical-time');
const randomCount = document.getElementById('random-count');
const randomMinDuration = document.getElementById('random-min-duration');
const transientSensitivity = document.getElementById('transient-sensitivity');
const transientSensitivityValue = document.getElementById('transient-sensitivity-value');
const transientMinGap = document.getElementById('transient-min-gap');
const silenceThreshold = document.getElementById('silence-threshold');
const namingPattern = document.getElementById('naming-pattern');
const enableKeyDetection = document.getElementById('enable-key-detection');
const enableSimilarityGrouping = document.getElementById('enable-similarity-grouping');
const similaritySettings = document.getElementById('similarity-settings');
const similarityThreshold = document.getElementById('similarity-threshold');
const similarityThresholdValue = document.getElementById('similarity-threshold-value');

// Waveform Elements
const waveformSection = document.getElementById('waveform-section');
const waveformCanvas = document.getElementById('waveform-canvas');
const waveformFilename = document.getElementById('waveform-filename');
const togglePlayBtn = document.getElementById('toggle-play-btn');
const chopCount = document.getElementById('chop-count');

// Waveform State (Web Audio API)
let audioContext = null;
let audioBuffer = null;
let audioSource = null;
let isPlaying = false;
let startTime = 0;
let pauseTime = 0;

// Event Listeners

// File selection with license checking
selectFilesBtn.addEventListener('click', async () => {
  const files = await window.api.selectFiles();

  if (files.length > 0) {
    // Check file size limits for each file
    const validFiles = [];

    for (const filePath of files) {
      const limitCheck = await window.api.checkFileLimits(filePath);

      if (!limitCheck.allowed) {
        // Show upgrade prompt
        bannerMessage.textContent = `File too large (${limitCheck.fileSizeMB}MB). Free version limited to ${limitCheck.limitMB}MB files.`;
        licenseBanner.classList.remove('hidden');
        alert(`File "${filePath.split('/').pop()}" is ${limitCheck.fileSizeMB}MB, which exceeds the ${limitCheck.limitMB}MB limit for the free version. Upgrade to Pro for unlimited file sizes!`);
      } else {
        validFiles.push(filePath);
      }
    }

    if (validFiles.length > 0) {
      selectedFiles = validFiles;
      renderFileList();
      checkCanProcess();

      // Load waveform for the first (typically only) file
      if (validFiles.length > 0) {
        try {
          await loadWaveform(validFiles[0]);
        } catch (error) {
          console.error('Failed to load waveform:', error);
          // Don't crash the app - just hide waveform section
          waveformSection.classList.add('hidden');
        }
      }
    }
  }
});

// Output folder selection
selectOutputBtn.addEventListener('click', async () => {
  const folder = await window.api.selectOutputFolder();
  if (folder) {
    outputFolder = folder;
    outputPath.textContent = folder;
    outputPath.classList.add('selected');
    checkCanProcess();
  }
});

// Split mode toggle
splitModeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    // Hide all
    timeSettings.classList.remove('active');
    barSettings.classList.remove('active');
    randomSettings.classList.remove('active');
    transientSettings.classList.remove('active');

    // Show selected
    if (e.target.value === 'time') {
      timeSettings.classList.add('active');
    } else if (e.target.value === 'bar') {
      barSettings.classList.add('active');
    } else if (e.target.value === 'random') {
      randomSettings.classList.add('active');
    } else if (e.target.value === 'transient') {
      transientSettings.classList.add('active');
    }
  });
});

// Transient sensitivity display update
transientSensitivity.addEventListener('input', (e) => {
  transientSensitivityValue.textContent = e.target.value;
  if (audioBuffer) updateChopMarkers();
});

// Similarity grouping toggle
enableSimilarityGrouping.addEventListener('change', (e) => {
  if (e.target.checked) {
    similaritySettings.style.display = 'block';
  } else {
    similaritySettings.style.display = 'none';
  }
});

// Similarity threshold display update
similarityThreshold.addEventListener('input', (e) => {
  similarityThresholdValue.textContent = e.target.value;
});

// Process button
processBtn.addEventListener('click', async () => {
  if (!canProcess()) return;

  // Get selected split mode
  const splitMode = document.querySelector('input[name="split-mode"]:checked').value;

  // Prepare options
  const options = {
    inputFiles: selectedFiles,
    outputFolder: outputFolder,
    splitMode: splitMode,
    namingPattern: namingPattern.value || '{filename}_bar_{number:03d}',
    silenceThreshold: parseFloat(silenceThreshold.value),
    enableKeyDetection: enableKeyDetection.checked,
    enableSimilarityGrouping: enableSimilarityGrouping.checked,
    similarityThreshold: parseFloat(similarityThreshold.value)
  };

  // Add mode-specific settings
  if (splitMode === 'time') {
    options.timeSeconds = parseFloat(timeSeconds.value);
  } else if (splitMode === 'bar') {
    options.bpm = parseInt(bpm.value);
    options.musicalTime = musicalTime.value;
  } else if (splitMode === 'random') {
    options.randomCount = parseInt(randomCount.value);
    options.randomMinDuration = parseFloat(randomMinDuration.value);
  } else if (splitMode === 'transient') {
    options.transientSensitivity = parseFloat(transientSensitivity.value);
    options.transientMinGap = parseFloat(transientMinGap.value);
  }

  // Show progress UI
  progressSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  progressLog.innerHTML = '';
  processBtn.disabled = true;

  try {
    const result = await window.api.processAudio(options);

    // Reload license status to update sample count
    await loadLicenseStatus();

    // Show result
    progressSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    resultMessage.textContent = result.output || 'Processing complete!';

  } catch (error) {
    progressSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    resultMessage.textContent = `Error: ${error.error || error.message || 'Unknown error'}`;
    resultMessage.classList.add('error');
  } finally {
    processBtn.disabled = false;
  }
});

// Listen for progress updates from main process
window.api.onProcessProgress((message) => {
  const logEntry = document.createElement('div');
  logEntry.textContent = message;
  logEntry.className = 'log-entry';
  progressLog.appendChild(logEntry);
  // Auto-scroll to bottom
  progressLog.scrollTop = progressLog.scrollHeight;
});

// Open Folder button - opens the output folder in file explorer
openFolderBtn.addEventListener('click', async () => {
  if (outputFolder) {
    await window.api.openFolder(outputFolder);
  }
});

// Chop Another button - resets the UI to start over
chopAnotherBtn.addEventListener('click', () => {
  // Reset state
  selectedFiles = [];
  outputFolder = null;

  // Reset UI
  resultSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  progressLog.innerHTML = '';
  resultMessage.textContent = '';
  resultMessage.classList.remove('error');
  outputPath.textContent = 'No folder selected';
  outputPath.classList.remove('selected');

  // Reset file list
  renderFileList();
  checkCanProcess();

  // Clean up waveform
  stopAudio();
  audioBuffer = null;
  const ctx = waveformCanvas.getContext('2d');
  ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  waveformSection.classList.add('hidden');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Helper Functions

function renderFileList() {
  if (selectedFiles.length === 0) {
    fileList.innerHTML = '<p class="empty-state">No files selected</p>';
    return;
  }

  fileList.innerHTML = '';
  selectedFiles.forEach((filePath, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    const fileName = filePath.split('/').pop();

    fileItem.innerHTML = `
      <span class="file-name">${fileName}</span>
      <button class="remove-btn" data-index="${index}">Remove</button>
    `;

    fileList.appendChild(fileItem);
  });

  // Add remove handlers
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      selectedFiles.splice(index, 1);
      renderFileList();
      checkCanProcess();
    });
  });
}

function canProcess() {
  return selectedFiles.length > 0 && outputFolder !== null;
}

function checkCanProcess() {
  processBtn.disabled = !canProcess();
}

// License Management
let licenseStatus = null;

// License DOM Elements
const licenseBanner = document.getElementById('license-banner');
const bannerMessage = document.getElementById('banner-message');
const upgradeBtnBanner = document.getElementById('upgrade-btn');
const licenseTier = document.getElementById('license-tier');
const manageLicenseBtn = document.getElementById('manage-license-btn');
const licenseModal = document.getElementById('license-modal');
const closeModalBtn = document.getElementById('close-modal');
const purchaseBtn = document.getElementById('purchase-btn');
const licenseKeyInput = document.getElementById('license-key-input');
const activateBtn = document.getElementById('activate-btn');
const licenseStatusEl = document.getElementById('license-status');

// Load license status on startup
async function loadLicenseStatus() {
  licenseStatus = await window.api.getLicenseStatus();
  updateLicenseUI();
}

// Update UI based on license status
function updateLicenseUI() {
  console.log('License Status:', licenseStatus); // Debug

  if (licenseStatus.isPro) {
    licenseTier.textContent = 'Pro Version';
    licenseTier.style.background = 'linear-gradient(135deg, #ff4ad5 0%, #ff6b9d 100%)';
    licenseTier.style.color = 'white';
    licenseBanner.classList.add('hidden');

    // Update manage button for Pro users
    manageLicenseBtn.textContent = 'Licensed ✓';
    manageLicenseBtn.style.color = '#0f0';
    manageLicenseBtn.style.textDecoration = 'none';
    manageLicenseBtn.style.cursor = 'default';
  } else {
    // Reset manage button for free users
    manageLicenseBtn.textContent = 'Manage License';
    manageLicenseBtn.style.color = '';
    manageLicenseBtn.style.textDecoration = '';
    manageLicenseBtn.style.cursor = '';
    // Calculate remaining samples
    const remaining = licenseStatus.limits.maxSamples - licenseStatus.sessionSampleCount;

    // Update tier badge to show remaining samples
    licenseTier.textContent = `Free Version (${remaining}/${licenseStatus.limits.maxSamples} samples)`;
    licenseTier.style.background = 'rgba(255, 74, 213, 0.2)';
    licenseTier.style.color = 'var(--color-main)';

    // Show banner with sample count
    bannerMessage.textContent = `Free version: ${remaining}/${licenseStatus.limits.maxSamples} samples remaining this session • ${licenseStatus.limits.maxFileSizeMB}MB file limit`;

    console.log('Session samples:', licenseStatus.sessionSampleCount, 'Remaining:', remaining); // Debug

    // Only show banner if user has used samples AND is running low
    if (licenseStatus.sessionSampleCount > 0 && remaining <= 20) {
      console.log('Showing banner - samples used and running low'); // Debug
      licenseBanner.classList.remove('hidden');
    } else {
      console.log('Hiding banner - fresh session or plenty remaining'); // Debug
      licenseBanner.classList.add('hidden');
    }
  }
}

// Show license modal
function showLicenseModal() {
  licenseModal.classList.remove('hidden');
}

// Hide license modal
function hideLicenseModal() {
  licenseModal.classList.add('hidden');
  licenseStatusEl.textContent = '';
  licenseStatusEl.className = 'license-status';
}

// License event listeners
manageLicenseBtn.addEventListener('click', () => {
  // Don't open modal for Pro users
  if (!licenseStatus.isPro) {
    showLicenseModal();
  }
});
upgradeBtnBanner.addEventListener('click', showLicenseModal);
closeModalBtn.addEventListener('click', hideLicenseModal);

// Close modal on background click
licenseModal.addEventListener('click', (e) => {
  if (e.target === licenseModal) {
    hideLicenseModal();
  }
});

// Purchase button - opens Gumroad
purchaseBtn.addEventListener('click', async () => {
  await window.api.openPurchasePage();
});

// Activate license
activateBtn.addEventListener('click', async () => {
  const licenseKey = licenseKeyInput.value.trim();

  if (!licenseKey) {
    licenseStatusEl.textContent = 'Please enter a license key';
    licenseStatusEl.className = 'license-status error';
    return;
  }

  activateBtn.disabled = true;
  activateBtn.textContent = 'Verifying...';

  const result = await window.api.verifyLicense(licenseKey);

  activateBtn.disabled = false;
  activateBtn.textContent = 'Activate';

  if (result.success) {
    licenseStatusEl.textContent = 'License activated successfully!';
    licenseStatusEl.className = 'license-status success';
    licenseKeyInput.value = '';

    // Reload license status
    await loadLicenseStatus();

    // Close modal after 2 seconds
    setTimeout(() => {
      hideLicenseModal();
    }, 2000);
  } else {
    licenseStatusEl.textContent = result.error || 'Invalid license key';
    licenseStatusEl.className = 'license-status error';
  }
});

// Waveform Functions (Web Audio API)
async function loadWaveform(filePath) {
  try {
    console.log('Loading waveform for:', filePath);

    const fileName = filePath.split('/').pop();
    waveformFilename.textContent = fileName;

    // Request waveform data generation from main process
    const waveformData = await window.api.generateWaveform(filePath);

    if (!waveformData || !waveformData.path) {
      throw new Error('Failed to generate waveform data');
    }

    waveformDataPath = waveformData.path;

    console.log('Initializing peaks.js with data from:', waveformDataPath);

    // Create a hidden audio element
    let audioElement = document.getElementById('waveform-audio');
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'waveform-audio';
      audioElement.style.display = 'none';
      audioElement.src = `file://${filePath}`;
      document.body.appendChild(audioElement);
    } else {
      audioElement.src = `file://${filePath}`;
    }

    // Initialize peaks.js
    const options = {
      containers: {
        overview: document.getElementById('peaks-overview'),
        zoomview: document.getElementById('peaks-zoomview')
      },
      mediaElement: audioElement,  // Add the audio element
      dataUri: {
        arraybuffer: `file://${waveformData.path}`
      },
      keyboard: false,
      waveformColor: '#4a9eff',
      playedWaveformColor: '#ff4ad5',
      zoomWaveformColor: '#4a9eff',
      overview: {
        waveformColor: 'rgba(74, 158, 255, 0.8)',
        playedWaveformColor: 'rgba(255, 74, 213, 0.8)',
        highlightColor: '#ff4ad5',
        highlightStrokeColor: 'transparent',
        highlightOpacity: 0.3
      },
      zoomview: {
        waveformColor: 'rgba(74, 158, 255, 0.8)',
        playedWaveformColor: 'rgba(255, 74, 213, 0.8)',
        highlightColor: '#ff4ad5',
        highlightStrokeColor: 'transparent'
      },
      pointMarkerColor: '#ff4ad5'
    };

    if (peaksInstance) {
      peaksInstance.destroy();
    }

    peaksInstance = peaks.init(options, (err, peaksObj) => {
      if (err) {
        console.error('peaks.js error:', err);
        return;
      }

      console.log('peaks.js initialized successfully');

      // Add initial chop markers
      updateChopMarkers();
    });

    // Show waveform section
    waveformSection.classList.remove('hidden');

    // Update detected info
    detectedKey.textContent = waveformData.key || 'Not detected';
    detectedBpm.textContent = waveformData.bpm ? `${Math.round(waveformData.bpm)} BPM` : 'Not detected';

    console.log('Waveform loaded successfully');

  } catch (error) {
    console.error('Waveform load error:', error);
    waveformSection.classList.add('hidden');
  }
}

function estimateDuration(fileSizeBytes, filePath) {
  // Rough estimation based on file format
  // WAV: ~10MB per minute for 16-bit stereo 44.1kHz
  // MP3: ~1MB per minute for 128kbps
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  if (filePath.endsWith('.mp3')) {
    return (fileSizeMB / 1) * 60; // ~1MB per minute
  } else if (filePath.endsWith('.wav')) {
    return (fileSizeMB / 10) * 60; // ~10MB per minute
  } else if (filePath.endsWith('.flac')) {
    return (fileSizeMB / 5) * 60; // ~5MB per minute
  }

  // Default to WAV estimation
  return (fileSizeMB / 10) * 60;
}

function drawSimplifiedWaveform() {
  const canvas = waveformCanvas;
  const ctx = canvas.getContext('2d');

  // Set canvas size to match display size
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  // Clear canvas
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Draw a generic waveform pattern
  const samples = Math.floor(rect.width / 2);
  const barWidth = rect.width / samples;
  const halfHeight = rect.height / 2;

  ctx.fillStyle = '#4a9eff';
  for (let i = 0; i < samples; i++) {
    // Create a pseudo-random waveform pattern
    const noise = Math.sin(i * 0.1) * 0.3 + Math.sin(i * 0.05) * 0.7;
    const amplitude = Math.abs(noise);
    const barHeight = amplitude * halfHeight * 0.8;
    const x = i * barWidth;
    const y = halfHeight - barHeight / 2;
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}

function drawWaveform() {
  const canvas = waveformCanvas;
  const ctx = canvas.getContext('2d');

  // Set canvas size to match display size (for crisp rendering)
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  // Clear canvas
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, rect.width, rect.height);

  if (!audioBuffer) return;

  // Get audio data
  const rawData = audioBuffer.getChannelData(0); // Use first channel
  const samples = Math.floor(rect.width);
  const blockSize = Math.floor(rawData.length / samples);
  const filteredData = [];

  // Downsample audio data for visualization
  for (let i = 0; i < samples; i++) {
    const blockStart = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(rawData[blockStart + j]);
    }
    filteredData.push(sum / blockSize);
  }

  // Normalize filtered data
  const multiplier = Math.pow(Math.max(...filteredData), -1);
  const normalizedData = filteredData.map(n => n * multiplier);

  // Draw waveform bars
  const barWidth = rect.width / samples;
  const halfHeight = rect.height / 2;

  ctx.fillStyle = '#4a9eff';
  for (let i = 0; i < normalizedData.length; i++) {
    const barHeight = normalizedData[i] * halfHeight;
    const x = i * barWidth;
    const y = halfHeight - barHeight / 2;
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}

function updateChopMarkers() {
  if (!audioBuffer) return;

  // Redraw waveform with markers
  drawSimplifiedWaveform();

  const canvas = waveformCanvas;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();

  // Get current settings
  const splitMode = document.querySelector('input[name="split-mode"]:checked').value;
  const duration = audioBuffer.duration;

  let chopCounter = 0;

  if (splitMode === 'random') {
    // Random mode visualization
    const count = parseInt(randomCount.value) || 16;

    // Generate random positions (simulated for preview)
    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push(Math.random());
    }
    positions.sort();

    ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; // Orange for random
    positions.forEach(pos => {
      const x = pos * rect.width;
      ctx.fillRect(x - 2, 0, 4, rect.height);
    });

    chopCount.textContent = `~${count} chunks (random)`;
  } else if (splitMode === 'transient') {
    // Transient mode visualization (estimated)
    const sensitivity = parseFloat(transientSensitivity.value);
    const estimatedCount = Math.floor(duration / 2) * sensitivity * 10; // Rough estimate

    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'; // Red for transients
    ctx.lineWidth = 2;

    for (let i = 0; i < estimatedCount; i++) {
      // Simulate uneven spacing (transients aren't evenly distributed)
      const x = (Math.random() * 0.8 + 0.1 * i / estimatedCount) * rect.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }

    chopCount.textContent = `~${Math.floor(estimatedCount)} chunks (estimated)`;
  } else {
    // Calculate chunk length in seconds for time and bar modes
    let chunkLengthSec;
    if (splitMode === 'time') {
      chunkLengthSec = parseFloat(timeSeconds.value) || 2.0;
    } else {
      const bpmValue = parseInt(bpm.value) || 120;
      const timeValue = musicalTime.value || '1/4';

      const timeMap = {
        '1/16': 0.25, '1/8': 0.5, '1/4': 1.0, '1/2': 2.0,
        '1': 4.0, '2': 8.0, '4': 16.0, '8': 32.0
      };

      const beats = timeMap[timeValue];
      chunkLengthSec = (60.0 / bpmValue) * beats;
    }

    // Draw vertical marker lines at chop points
    ctx.strokeStyle = '#ff4ad5';
    ctx.lineWidth = 2;

    for (let time = chunkLengthSec; time < duration; time += chunkLengthSec) {
      const x = (time / duration) * rect.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
      chopCounter++;
    }

    // Update chop count display
    chopCount.textContent = `${chopCounter + 1} chunks`;
  }
}

function playAudio() {
  if (!audioBuffer || !audioContext) return;

  // Stop any current playback
  stopAudio();

  // Create new source
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(audioContext.destination);
  audioSource.start(0, pauseTime);

  startTime = audioContext.currentTime - pauseTime;
  isPlaying = true;

  // Handle playback end
  audioSource.onended = () => {
    isPlaying = false;
    pauseTime = 0;
  };
}

function stopAudio() {
  if (audioSource) {
    try {
      audioSource.stop();
    } catch (e) {
      // Already stopped
    }
    audioSource = null;
  }
  if (isPlaying && audioContext) {
    pauseTime = audioContext.currentTime - startTime;
  }
  isPlaying = false;
}

function togglePlayPause() {
  // Disabled for simplified waveform (large file optimization)
  alert('Audio playback is disabled for large files to prevent crashes. The waveform shows approximate chop positions.');
}

// Play/pause button
togglePlayBtn.addEventListener('click', togglePlayPause);

// Listen for settings changes and update markers
[timeSeconds, bpm, musicalTime, randomCount, randomMinDuration, transientMinGap].forEach(input => {
  input.addEventListener('input', () => {
    if (audioBuffer) {
      updateChopMarkers();
    }
  });
});

splitModeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (audioBuffer) {
      updateChopMarkers();
    }
  });
});


// Initialize
renderFileList();
checkCanProcess();
loadLicenseStatus();
