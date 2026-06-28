// Mudpie Chopper 2.0 - Renderer
// Bass Daddy Devices

initializeApp();

function initializeApp() {

    // State
    let selectedFiles = [];
    let outputFolder = null;
    let previewAudioDuration = null;

    // License State
    let licenseStatus = null;

    // DOM Elements - File Selection
    const selectFilesBtn = document.getElementById('select-files-btn');
    const fileList = document.getElementById('file-list');
    const selectOutputBtn = document.getElementById('select-output-btn');
    const outputPath = document.getElementById('output-path');
    const processBtn = document.getElementById('process-btn');

    // DOM Elements - Chunk Estimate
    const chunkEstimate = document.getElementById('chunk-estimate');

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
                loadPreviewDuration(validFiles[0]);
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

            recomputeChunkEstimate();
        });
    });

    // Next-step buttons
    document.querySelectorAll('.next-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.next)?.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Settings Updates
    transientSensitivity.addEventListener('input', (e) => {
        transientSensitivityValue.textContent = e.target.value;
        recomputeChunkEstimate();
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

    // Update chunk estimate when settings change
    [timeSeconds, bpm, musicalTime, randomCount, randomMinDuration, transientMinGap].forEach(input => {
        input.addEventListener('input', () => recomputeChunkEstimate());
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

        previewAudioDuration = null;
        recomputeChunkEstimate();

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
    // CHUNK ESTIMATE
    // =============================================================================

    function loadPreviewDuration(filePath) {
        previewAudioDuration = null;
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            previewAudioDuration = audio.duration;
            recomputeChunkEstimate();
        });
        audio.addEventListener('error', () => {
            previewAudioDuration = null;
            recomputeChunkEstimate();
        });
        audio.src = `file://${filePath}`;
    }

    function recomputeChunkEstimate() {
        const splitMode = document.querySelector('input[name="split-mode"]:checked').value;

        if (splitMode === 'random') {
            const count = parseInt(randomCount.value) || 16;
            chunkEstimate.textContent = `~${count} chunks`;
            return;
        }

        if (previewAudioDuration === null) {
            chunkEstimate.textContent = 'Select a file to estimate chunks';
            return;
        }

        const duration = previewAudioDuration;
        let estimatedCount = 0;

        if (splitMode === 'time') {
            const chunkLength = parseFloat(timeSeconds.value) || 2.0;
            estimatedCount = Math.floor(duration / chunkLength) + 1;
        } else if (splitMode === 'bar') {
            const bpmValue = parseInt(bpm.value) || 120;
            const timeValue = musicalTime.value || '1/4';

            const timeMap = {
                '1/16': 0.25, '1/8': 0.5, '1/4': 1.0, '1/2': 2.0,
                '1': 4.0, '2': 8.0, '4': 16.0, '8': 32.0
            };

            const beats = timeMap[timeValue];
            const chunkLength = (60.0 / bpmValue) * beats;
            estimatedCount = Math.floor(duration / chunkLength) + 1;
        } else if (splitMode === 'transient') {
            const sensitivity = parseFloat(transientSensitivity.value);
            const minGap = parseFloat(transientMinGap.value);
            estimatedCount = Math.max(1, Math.floor((duration / minGap) * sensitivity));
        }

        chunkEstimate.textContent = `~${estimatedCount} chunks`;
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