// Mudpie Chopper 2.0 - Renderer
// Bass Daddy Devices

// Load Peaks.js dynamically before anything else
(function () {
    const peaksScript = document.createElement('script');
    peaksScript.src = 'peaks.min.js';
    peaksScript.onload = () => {
        if (typeof peaks !== 'undefined') {
            console.log('✓ Peaks.js loaded successfully');
            initializeApp();
        } else {
            console.error('✗ Peaks.js script loaded but global "peaks" not found');
        }
    };
    peaksScript.onerror = () => {
        console.error('✗ Failed to load Peaks.js from peaks.min.js');
    };
    document.head.appendChild(peaksScript);
})();

function initializeApp() {

    // State
    let selectedFiles = [];
    let outputFolder = null;
    let peaksInstance = null;
    let waveformDataPath = null;

    // License State
    let licenseStatus = null;

    // DOM Elements - File Selection
    const selectFilesBtn = document.getElementById('select-files-btn');
    const fileList = document.getElementById('file-list');
    const selectOutputBtn = document.getElementById('select-output-btn');
    const outputPath = document.getElementById('output-path');
    const processBtn = document.getElementById('process-btn');

    // DOM Elements - Waveform
    const waveformSection = document.getElementById('waveform-section');
    const waveformFilename = document.getElementById('waveform-filename');
    const togglePlayBtn = document.getElementById('toggle-play-btn');
    const chopCount = document.getElementById('chop-count');
    const detectedKey = document.getElementById('detected-key');
    const detectedBpm = document.getElementById('detected-bpm');

    // DOM Elements - Progress
    const progressSection = document.getElementById('progress-section');
    const progressLog = document.getElementById('progress-log');
    const resultSection = document.getElementById('result-section');
    const resultMessage = document.getElementById('result-message');
    const openFolderBtn = document.getElementById('open-folder-btn');
    const chopAnotherBtn = document.getElementById('chop-another-btn');

    // DOM Elements - Settings
    const splitModeRadios = document.querySelectorAll('input[name="split-mode"]');
    const timeSettings = document.getElementById('time-settings');
    const barSettings = document.getElementById('bar-settings');
    const transientSettings = document.getElementById('transient-settings');
    const randomSettings = document.getElementById('random-settings');

    const timeSeconds = document.getElementById('time-seconds');
    const bpm = document.getElementById('bpm');
    const musicalTime = document.getElementById('musical-time');
    const transientSensitivity = document.getElementById('transient-sensitivity');
    const transientSensitivityValue = document.getElementById('transient-sensitivity-value');
    const transientMinGap = document.getElementById('transient-min-gap');
    const randomCount = document.getElementById('random-count');
    const randomMinDuration = document.getElementById('random-min-duration');

    const silenceThreshold = document.getElementById('silence-threshold');
    const namingPattern = document.getElementById('naming-pattern');
    const enableNormalization = document.getElementById('enable-normalization');
    const enableKeyDetection = document.getElementById('enable-key-detection');
    const enableSimilarityGrouping = document.getElementById('enable-similarity-grouping');
    const similaritySettings = document.getElementById('similarity-settings');
    const similarityThreshold = document.getElementById('similarity-threshold');
    const similarityThresholdValue = document.getElementById('similarity-threshold-value');
    const rrLabeling = document.getElementById('rr-labeling');

    // DOM Elements - License
    const licenseBanner = document.getElementById('license-banner');
    const bannerMessage = document.getElementById('banner-message');
    const upgradeBtnBanner = document.getElementById('upgrade-btn-banner');
    const licenseTier = document.getElementById('license-tier');
    const manageLicenseBtn = document.getElementById('manage-license-btn');
    const licenseModal = document.getElementById('license-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const purchaseBtn = document.getElementById('purchase-btn');
    const licenseKeyInput = document.getElementById('license-key-input');
    const activateBtn = document.getElementById('activate-btn');
    const licenseStatusEl = document.getElementById('license-status');

    // =============================================================================
    // EVENT LISTENERS
    // =============================================================================

    // File Selection
    selectFilesBtn.addEventListener('click', async () => {
        const files = await window.api.selectFiles();

        if (files.length > 0) {
            const validFiles = [];

            for (const filePath of files) {
                const limitCheck = await window.api.checkFileLimits(filePath);

                if (!limitCheck.allowed) {
                    bannerMessage.textContent = `File too large (${limitCheck.fileSizeMB}MB). Free version limited to ${limitCheck.limitMB}MB files.`;
                    licenseBanner.classList.remove('hidden');
                    alert(`File "${filePath.split('/').pop()}" is ${limitCheck.fileSizeMB}MB, which exceeds the ${limitCheck.limitMB}MB limit. Upgrade to Pro!`);
                } else {
                    validFiles.push(filePath);
                }
            }

            if (validFiles.length > 0) {
                selectedFiles = validFiles;
                renderFileList();
                checkCanProcess();

                // Load waveform for first file
                if (validFiles.length > 0) {
                    await loadWaveform(validFiles[0]);
                }
            }
        }
    });

    // Output Folder Selection
    selectOutputBtn.addEventListener('click', async () => {
        const folder = await window.api.selectOutputFolder();
        if (folder) {
            outputFolder = folder;
            outputPath.textContent = folder;
            outputPath.classList.add('text-bass-pink', 'font-semibold');
            outputPath.classList.remove('text-white/40');
            checkCanProcess();
        }
    });

    // Split Mode Toggle
    splitModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            // Hide all
            timeSettings.classList.add('hidden');
            barSettings.classList.add('hidden');
            randomSettings.classList.add('hidden');
            transientSettings.classList.add('hidden');

            timeSettings.classList.remove('active');
            barSettings.classList.remove('active');
            randomSettings.classList.remove('active');
            transientSettings.classList.remove('active');

            // Show selected
            const mode = e.target.value;
            const settingsMap = {
                'time': timeSettings,
                'bar': barSettings,
                'random': randomSettings,
                'transient': transientSettings
            };

            if (settingsMap[mode]) {
                settingsMap[mode].classList.remove('hidden');
                settingsMap[mode].classList.add('active');
            }

            // Update waveform markers
            updateChopMarkers();
        });
    });

    // Settings Updates
    transientSensitivity.addEventListener('input', (e) => {
        transientSensitivityValue.textContent = e.target.value;
        updateChopMarkers();
    });

    similarityThreshold.addEventListener('input', (e) => {
        similarityThresholdValue.textContent = e.target.value;
    });

    enableSimilarityGrouping.addEventListener('change', (e) => {
        if (e.target.checked) {
            similaritySettings.classList.remove('hidden');
        } else {
            similaritySettings.classList.add('hidden');
        }
    });

    // Naming preset buttons
    document.querySelectorAll('.naming-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            namingPattern.value = btn.dataset.pattern;
            document.querySelectorAll('.naming-preset').forEach(b => {
                b.classList.remove('border-bass-pink', 'bg-bass-pink/20', 'text-white');
            });
            btn.classList.add('border-bass-pink', 'bg-bass-pink/20', 'text-white');
        });
    });

    // Update markers when settings change
    [timeSeconds, bpm, musicalTime, randomCount, randomMinDuration, transientMinGap].forEach(input => {
        input.addEventListener('input', () => updateChopMarkers());
    });

    // Process Button
    processBtn.addEventListener('click', async () => {
        if (!canProcess()) return;

        const splitMode = document.querySelector('input[name="split-mode"]:checked').value;

        const options = {
            inputFiles: selectedFiles,
            outputFolder: outputFolder,
            splitMode: splitMode,
            namingPattern: namingPattern.value || '{filename}_{number:03d}',
            silenceThreshold: parseFloat(silenceThreshold.value),
            enableNormalization: enableNormalization.checked,
            enableKeyDetection: enableKeyDetection.checked,
            enableSimilarityGrouping: enableSimilarityGrouping.checked,
            similarityThreshold: parseFloat(similarityThreshold.value),
            rrLabeling: rrLabeling.checked
        };

        // Mode-specific settings
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

        // Show progress
        progressSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        progressLog.innerHTML = '';
        processBtn.disabled = true;

        try {
            const result = await window.api.processAudio(options);
            await loadLicenseStatus();

            progressSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
            resultMessage.textContent = result.output || 'Processing complete!';
            resultMessage.classList.remove('text-red-500');

        } catch (error) {
            progressSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
            resultMessage.textContent = `Error: ${error.error || error.message || 'Unknown error'}`;
            resultMessage.classList.add('text-red-500');
        } finally {
            processBtn.disabled = false;
        }
    });

    // Progress Updates
    window.api.onProcessProgress((message) => {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        logEntry.className = 'text-white/80';
        progressLog.appendChild(logEntry);
        progressLog.scrollTop = progressLog.scrollHeight;
    });

    // Open Folder
    openFolderBtn.addEventListener('click', async () => {
        if (outputFolder) {
            await window.api.openFolder(outputFolder);
        }
    });

    // Chop Another
    chopAnotherBtn.addEventListener('click', () => {
        selectedFiles = [];
        outputFolder = null;

        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        progressLog.innerHTML = '';
        resultMessage.textContent = '';
        resultMessage.classList.remove('text-red-500');
        outputPath.textContent = 'No folder selected';
        outputPath.classList.remove('text-bass-pink', 'font-semibold');
        outputPath.classList.add('text-white/40');

        renderFileList();
        checkCanProcess();

        // Clean up waveform
        if (peaksInstance) {
            peaksInstance.destroy();
            peaksInstance = null;
        }
        waveformSection.classList.add('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // License Management
    manageLicenseBtn.addEventListener('click', () => {
        if (!licenseStatus?.isPro) {
            showLicenseModal();
        }
    });

    upgradeBtnBanner.addEventListener('click', showLicenseModal);
    closeModalBtn.addEventListener('click', hideLicenseModal);

    licenseModal.addEventListener('click', (e) => {
        if (e.target === licenseModal) {
            hideLicenseModal();
        }
    });

    purchaseBtn.addEventListener('click', async () => {
        await window.api.openPurchasePage();
    });

    activateBtn.addEventListener('click', async () => {
        const licenseKey = licenseKeyInput.value.trim();

        if (!licenseKey) {
            licenseStatusEl.textContent = 'Please enter a license key';
            licenseStatusEl.className = 'mt-3 text-center text-sm text-red-500';
            return;
        }

        activateBtn.disabled = true;
        activateBtn.textContent = 'Verifying...';

        const result = await window.api.verifyLicense(licenseKey);

        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate License';

        if (result.success) {
            licenseStatusEl.textContent = 'License activated successfully!';
            licenseStatusEl.className = 'mt-3 text-center text-sm text-green-500';
            licenseKeyInput.value = '';

            await loadLicenseStatus();

            setTimeout(() => {
                hideLicenseModal();
            }, 2000);
        } else {
            licenseStatusEl.textContent = result.error || 'Invalid license key';
            licenseStatusEl.className = 'mt-3 text-center text-sm text-red-500';
        }
    });

    // =============================================================================
    // WAVEFORM FUNCTIONS
    // =============================================================================

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

            console.log('Initializing Peaks.js with data from:', waveformDataPath);

            // Set audio source for Peaks.js media element
            const audioElement = document.getElementById('peaks-audio');
            audioElement.src = `file://${filePath}`;

            // Initialize peaks.js
            const options = {
                overview: {
                    container: document.getElementById('peaks-overview'),
                    waveformColor: 'rgba(74, 158, 255, 0.8)',
                    playedWaveformColor: 'rgba(255, 74, 213, 0.8)',
                    highlightColor: '#ff4ad5',
                    highlightStrokeColor: 'transparent',
                    highlightOpacity: 0.3
                },
                zoomview: {
                    container: document.getElementById('peaks-zoomview'),
                    waveformColor: 'rgba(74, 158, 255, 0.8)',
                    playedWaveformColor: 'rgba(255, 74, 213, 0.8)',
                    highlightColor: '#ff4ad5',
                    highlightStrokeColor: 'transparent'
                },
                mediaElement: audioElement,
                dataUri: {
                    arraybuffer: `file://${waveformData.path}`
                },
                keyboard: false,
                pointMarkerColor: '#ff4ad5'
            };

            if (peaksInstance) {
                peaksInstance.destroy();
            }

            // Show waveform section before init so containers have dimensions
            waveformSection.classList.remove('hidden');

            peaksInstance = peaks.init(options, (err, peaksObj) => {
                if (err) {
                    console.error('Peaks.js error:', err);
                    return;
                }

                console.log('Peaks.js initialized successfully');

                // Add initial chop markers
                updateChopMarkers();
            });

            // Update detected info
            detectedKey.textContent = waveformData.key || 'Not detected';
            detectedBpm.textContent = waveformData.bpm ? `${Math.round(waveformData.bpm)} BPM` : 'Not detected';

            console.log('Waveform loaded successfully');

        } catch (error) {
            console.error('Waveform load error:', error);
            waveformSection.classList.add('hidden');
        }
    }

    function updateChopMarkers() {
        if (!peaksInstance) return;

        // Clear existing segments and points
        const segments = peaksInstance.segments.getSegments();
        segments.forEach(segment => peaksInstance.segments.removeById(segment.id));

        const points = peaksInstance.points.getPoints();
        points.forEach(point => peaksInstance.points.removeById(point.id));

        const duration = peaksInstance.player ? peaksInstance.player.getDuration() : 0;
        if (duration === 0) return;

        const splitMode = document.querySelector('input[name="split-mode"]:checked').value;
        let chopPositions = [];

        if (splitMode === 'time') {
            const chunkLength = parseFloat(timeSeconds.value) || 2.0;
            for (let time = chunkLength; time < duration; time += chunkLength) {
                chopPositions.push(time);
            }
        } else if (splitMode === 'bar') {
            const bpmValue = parseInt(bpm.value) || 120;
            const timeValue = musicalTime.value || '1/4';

            const timeMap = {
                '1/16': 0.25, '1/8': 0.5, '1/4': 1.0, '1/2': 2.0,
                '1': 4.0, '2': 8.0, '4': 16.0, '8': 32.0
            };

            const beats = timeMap[timeValue];
            const chunkLength = (60.0 / bpmValue) * beats;

            for (let time = chunkLength; time < duration; time += chunkLength) {
                chopPositions.push(time);
            }
        } else if (splitMode === 'transient') {
            const sensitivity = parseFloat(transientSensitivity.value);
            const minGap = parseFloat(transientMinGap.value);
            const estimatedCount = Math.floor(duration / minGap) * sensitivity;

            for (let i = 0; i < estimatedCount; i++) {
                const pos = (Math.random() * 0.8 + 0.1 * i / estimatedCount) * duration;
                chopPositions.push(pos);
            }
            chopPositions.sort((a, b) => a - b);
        } else if (splitMode === 'random') {
            const count = parseInt(randomCount.value) || 16;
            for (let i = 0; i < count; i++) {
                chopPositions.push(Math.random() * duration);
            }
            chopPositions.sort((a, b) => a - b);
        }

        // Add points at chop positions
        chopPositions.forEach((time, index) => {
            peaksInstance.points.add({
                time: time,
                labelText: `${index + 1}`,
                color: '#ff4ad5',
                editable: false
            });
        });

        // Update count
        chopCount.textContent = `${chopPositions.length + 1} chunks`;
    }

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    function renderFileList() {
        if (selectedFiles.length === 0) {
            fileList.innerHTML = '<p class="text-white/40 text-sm text-center py-4">No files selected</p>';
            return;
        }

        fileList.innerHTML = '';
        selectedFiles.forEach((filePath, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between p-3 bg-black/30 rounded-lg';

            const fileName = filePath.split('/').pop();

            fileItem.innerHTML = `
      <span class="text-white/80 text-sm truncate flex-1">${fileName}</span>
      <button class="text-red-500 hover:text-red-400 ml-2" data-index="${index}">×</button>
    `;

            fileList.appendChild(fileItem);
        });

        // Add remove handlers
        document.querySelectorAll('[data-index]').forEach(btn => {
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

    function showLicenseModal() {
        licenseModal.classList.remove('hidden');
    }

    function hideLicenseModal() {
        licenseModal.classList.add('hidden');
        licenseStatusEl.textContent = '';
        licenseStatusEl.className = 'mt-3 text-center text-sm';
    }

    // =============================================================================
    // LICENSE MANAGEMENT
    // =============================================================================

    async function loadLicenseStatus() {
        licenseStatus = await window.api.getLicenseStatus();
        updateLicenseUI();
    }

    function updateLicenseUI() {
        console.log('License Status:', licenseStatus);

        if (licenseStatus?.isPro) {
            licenseTier.textContent = 'Pro Version';
            licenseTier.className = 'px-4 py-2 rounded-full bg-bass-gradient text-white font-semibold';
            licenseBanner.classList.add('hidden');

            manageLicenseBtn.textContent = 'Licensed ✓';
            manageLicenseBtn.className = 'text-green-400 cursor-default';
        } else {
            const remaining = licenseStatus.limits.maxSamples - licenseStatus.sessionSampleCount;

            licenseTier.textContent = `Free (${remaining}/${licenseStatus.limits.maxSamples} samples)`;
            licenseTier.className = 'px-4 py-2 rounded-full bg-bass-gradient-dark border border-bass-pink/30 text-white/80';

            bannerMessage.textContent = `Free version: ${remaining}/${licenseStatus.limits.maxSamples} samples remaining • ${licenseStatus.limits.maxFileSizeMB}MB file limit`;

            if (licenseStatus.sessionSampleCount > 0 && remaining <= 20) {
                licenseBanner.classList.remove('hidden');
            } else {
                licenseBanner.classList.add('hidden');
            }

            manageLicenseBtn.textContent = 'Manage License →';
            manageLicenseBtn.className = 'text-bass-pink hover:text-bass-purple transition-colors';
        }
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    renderFileList();
    checkCanProcess();
    loadLicenseStatus();

    console.log('🔪 Mudpie Chopper 2.0 - Bass Daddy Devices');

} // End of initializeApp function