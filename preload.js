const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  processAudio: (options) => ipcRenderer.invoke('process-audio', options),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  generateWaveform: (filePath) => ipcRenderer.invoke('generate-waveform', filePath),
  // Listen for progress updates
  onProcessProgress: (callback) => {
    ipcRenderer.on('process-progress', (event, message) => callback(message));
  },

  // License management
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  verifyLicense: (licenseKey) => ipcRenderer.invoke('verify-license', licenseKey),
  removeLicense: () => ipcRenderer.invoke('remove-license'),
  checkFileLimits: (filePath) => ipcRenderer.invoke('check-file-limits', filePath),
  openPurchasePage: () => ipcRenderer.invoke('open-purchase-page'),

  // Utilities
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  readAudioFile: (filePath) => ipcRenderer.invoke('read-audio-file', filePath)
});
