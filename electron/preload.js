const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  showSaveDialog: (filename) => ipcRenderer.invoke('show-save-dialog', filename),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),

  // WebTorrent operations (all happen in main process)
  addTorrent: (magnetUri) => ipcRenderer.invoke('add-torrent', magnetUri),
  seedFile: (filePath) => ipcRenderer.invoke('seed-file', filePath),
  downloadFile: (magnetUri, fileName) => ipcRenderer.invoke('download-file', magnetUri, fileName),
  pauseTorrent: (magnetUri) => ipcRenderer.invoke('pause-torrent', magnetUri),
  resumeTorrent: (magnetUri) => ipcRenderer.invoke('resume-torrent', magnetUri),
  removeTorrent: (magnetUri) => ipcRenderer.invoke('remove-torrent', magnetUri),
  getTorrentStats: () => ipcRenderer.invoke('get-torrent-stats'),

  // Web content management
  createBrowserView: (url) => ipcRenderer.invoke('create-browser-view', url),
  setActiveBrowserView: (viewId) => ipcRenderer.invoke('set-active-browser-view', viewId),
  closeBrowserView: (viewId) => ipcRenderer.invoke('close-browser-view', viewId),
  navigateBrowserView: (viewId, url) => ipcRenderer.invoke('navigate-browser-view', viewId, url),
  
  // Navigation
  goBack: (viewId) => ipcRenderer.invoke('go-back', viewId),
  goForward: (viewId) => ipcRenderer.invoke('go-forward', viewId),
  getNavigationState: (viewId) => ipcRenderer.invoke('get-navigation-state', viewId),

  // Process management
  getTabProcessInfo: (viewId) => ipcRenderer.invoke('get-tab-process-info', viewId),
  terminateTabProcess: (viewId) => ipcRenderer.invoke('terminate-tab-process', viewId),
  reloadCrashedTab: (viewId, url) => ipcRenderer.invoke('reload-crashed-tab', viewId, url),
  getAllProcessesInfo: () => ipcRenderer.invoke('get-all-processes-info'),

  // Event listeners
  onTorrentProgress: (callback) => {
    ipcRenderer.on('torrent-progress', (event, data) => callback(data));
  },
  
  onTorrentCompleted: (callback) => {
    ipcRenderer.on('torrent-completed', (event, data) => callback(data));
  },
  
  onTorrentError: (callback) => {
    ipcRenderer.on('torrent-error', (event, message) => callback(message));
  },
  
  onTorrentWarning: (callback) => {
    ipcRenderer.on('torrent-warning', (event, message) => callback(message));
  },

  onMagnetLink: (callback) => {
    ipcRenderer.on('handle-magnet-link', (event, magnetUri) => callback(magnetUri));
  },

  onWebNavigation: (callback) => {
    ipcRenderer.on('web-navigation', (event, data) => callback(data));
  },

  onCreateNewTabWithUrl: (callback) => {
    ipcRenderer.on('create-new-tab-with-url', (event, url) => callback(url));
  },

  onFocusAddressBar: (callback) => {
    ipcRenderer.on('focus-address-bar', (event) => callback());
  },

  onNewTab: (callback) => {
    ipcRenderer.on('new-tab', (event) => callback());
  },

  onCloseCurrentTab: (callback) => {
    ipcRenderer.on('close-current-tab', (event) => callback());
  },

  onTabProcessInfo: (callback) => {
    ipcRenderer.on('tab-process-info', (event, data) => callback(data));
  },

  // Cleanup
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Basic console for debugging (only if not already exists)
if (!window.electronConsole) {
  contextBridge.exposeInMainWorld('electronConsole', {
    log: (...args) => console.log('[Renderer]', ...args),
    error: (...args) => console.error('[Renderer]', ...args),
    warn: (...args) => console.warn('[Renderer]', ...args)
  });
}