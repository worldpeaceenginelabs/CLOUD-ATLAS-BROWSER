const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  showSaveDialog: (filename) => ipcRenderer.invoke('show-save-dialog', filename),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  pathExists: (filePath) => ipcRenderer.invoke('path-exists', filePath),
  
  // WebTorrent operations (all happen in main process)
  addTorrent: (magnetUri) => ipcRenderer.invoke('add-torrent', magnetUri),
  seedFile: (filePath) => ipcRenderer.invoke('seed-file', filePath),
  downloadFile: (magnetUri, fileName) => ipcRenderer.invoke('download-file', magnetUri, fileName),
  pauseTorrent: (magnetUri) => ipcRenderer.invoke('pause-torrent', magnetUri),
  
  removeTorrent: (magnetUri, keepFiles = false) => ipcRenderer.invoke('remove-torrent', magnetUri, keepFiles),
  getTorrentStats: () => ipcRenderer.invoke('get-torrent-stats'),

  // Web content management
  createBrowserView: (url) => ipcRenderer.invoke('create-browser-view', url),
  setActiveBrowserView: (viewId) => ipcRenderer.invoke('set-active-browser-view', viewId),
  closeBrowserView: (viewId) => ipcRenderer.invoke('close-browser-view', viewId),
  navigateBrowserView: (viewId, url) => ipcRenderer.invoke('navigate-browser-view', viewId, url),
  createNewTabWithUrl: (url) => ipcRenderer.invoke('create-new-tab-with-url', url),
  updateSidebarState: (open, width) => ipcRenderer.invoke('update-sidebar-state', open, width),
  handleFullscreenChange: (isFullscreen) => ipcRenderer.invoke('handle-fullscreen-change', isFullscreen),
  
  // Navigation
  goBack: (viewId) => ipcRenderer.invoke('go-back', viewId),
  goForward: (viewId) => ipcRenderer.invoke('go-forward', viewId),
  getNavigationState: (viewId) => ipcRenderer.invoke('get-navigation-state', viewId),

  // Process management
  getTabProcessInfo: (viewId) => ipcRenderer.invoke('get-tab-process-info', viewId),
  terminateTabProcess: (viewId) => ipcRenderer.invoke('terminate-tab-process', viewId),
  reloadCrashedTab: (viewId, url) => ipcRenderer.invoke('reload-crashed-tab', viewId, url),
  reloadBrowserView: (viewId) => ipcRenderer.invoke('reload-browser-view', viewId),
  getAllProcessesInfo: () => ipcRenderer.invoke('get-all-processes-info'),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

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
  },

  // New: Open root folder
  openRootFolder: (folderPath) => ipcRenderer.invoke('open-root-folder', folderPath),
});

// Basic console for debugging (only if not already exists)
if (!window.electronConsole) {
  contextBridge.exposeInMainWorld('electronConsole', {
    log: (...args) => console.log('[Renderer]', ...args),
    error: (...args) => console.error('[Renderer]', ...args),
    warn: (...args) => console.warn('[Renderer]', ...args)
  });
}