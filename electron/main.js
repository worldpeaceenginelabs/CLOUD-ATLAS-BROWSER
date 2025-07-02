import { app, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';

// Import all managers
import torrentManager from './torrent-manager.js';
import browserManager from './browser-manager.js';
import navigationManager from './navigation-manager.js';
import menuManager from './menu-manager.js';
import shortcutsManager from './shortcuts-manager.js';
import fileManager from './file-manager.js';
import securityManager from './security-manager.js';
import windowManager from './window-manager.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Application configuration
const isDev = process.env.IS_DEV === 'true';
const port = process.env.PORT || 5173;

// Application initialization
async function initializeApp() {
  console.log('🚀 Initializing application...');

  // Configure managers for environment
  windowManager.setDevelopmentMode(isDev);
  windowManager.setPort(port);
  menuManager.setDevelopmentMode(isDev);
  shortcutsManager.setDevelopmentMode(isDev);
  securityManager.setDevelopmentMode(isDev);

  // Create main window
  const mainWindow = windowManager.createWindow();

  // Set window references for all managers
  torrentManager.setMainWindow(mainWindow);
  browserManager.setMainWindow(mainWindow);
  navigationManager.setMainWindow(mainWindow);
  menuManager.setMainWindow(mainWindow);
  shortcutsManager.setMainWindow(mainWindow);
  fileManager.setMainWindow(mainWindow);
  securityManager.setMainWindow(mainWindow);

  // Set cross-references between managers
  windowManager.setBrowserManager(browserManager);
  shortcutsManager.setBrowserManager(browserManager);
  navigationManager.setBrowserManager(browserManager);
  securityManager.setBrowserManager(browserManager);

  // Initialize managers that need initialization
  torrentManager.initialize();
  securityManager.initialize();
  shortcutsManager.initialize();

  // Setup menu
  if (isDev) {
    menuManager.setupMenu();
  } else {
    menuManager.setupMenu();
    menuManager.hideMenuBar();
  }

  // Hook up navigation tracking for new browser views
  const originalCreateBrowserView = browserManager.createBrowserView.bind(browserManager);
  browserManager.createBrowserView = async function(url) {
    const viewId = await originalCreateBrowserView(url);
    if (viewId && browserManager.browserViews.has(viewId)) {
      const view = browserManager.browserViews.get(viewId);
      view.webContents.on('did-navigate', (event, navigatedUrl) => {
        navigationManager.handleNavigation(viewId, navigatedUrl);
      });
    }
    return viewId;
  };

  console.log('✅ Application initialized successfully');
}

// Application lifecycle
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  console.log('🧹 Cleaning up managers...');
  
  // Cleanup all managers
  torrentManager.destroy();
  browserManager.destroy();
  navigationManager.destroy();
  menuManager.destroy();
  shortcutsManager.destroy();
  fileManager.destroy();
  securityManager.destroy();
  windowManager.destroy();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!windowManager.hasWindow()) {
    initializeApp();
  }
});

// Set as default protocol client for magnet links
app.setAsDefaultProtocolClient('magnet');

// Handle magnet links from OS
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('magnet:') && windowManager.hasWindow()) {
    windowManager.getWindow().webContents.send('handle-magnet-link', url);
  }
});

// IPC Handlers - File Operations
ipcMain.handle('select-file', () => fileManager.selectFile());
ipcMain.handle('show-save-dialog', (event, defaultName) => fileManager.showSaveDialog(defaultName));
ipcMain.handle('get-download-path', () => fileManager.getDefaultDownloadPath());
ipcMain.handle('open-root-folder', (event, folderPath) => fileManager.openRootFolder(folderPath));

// IPC Handlers - File System Operations  
ipcMain.handle('path-exists', async (event, filePath) => {
  try {
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// IPC Handlers - WebTorrent Operations
ipcMain.handle('add-torrent', (event, magnetUri) => torrentManager.addTorrent(magnetUri));
ipcMain.handle('seed-file', (event, filePath) => torrentManager.seedFile(filePath));
ipcMain.handle('download-file', (event, magnetUri, fileName) => torrentManager.downloadFile(magnetUri, fileName));
ipcMain.handle('pause-torrent', (event, magnetUri) => torrentManager.pauseTorrent(magnetUri));

// IPC Handlers - Multimedia Streaming Operations
ipcMain.handle('get-file-stream', (event, magnetUri, fileName) => torrentManager.getFileStream(magnetUri, fileName));
ipcMain.handle('get-file-blob-url', (event, magnetUri, fileName) => torrentManager.getFileBlobURL(magnetUri, fileName));
ipcMain.handle('get-file-info', (event, magnetUri, fileName) => torrentManager.getFileInfo(magnetUri, fileName));

ipcMain.handle('remove-torrent', (event, magnetUri, keepFiles) => torrentManager.removeTorrent(magnetUri, keepFiles));
ipcMain.handle('get-torrent-stats', () => torrentManager.getTorrentStats());

// IPC Handlers - Browser Management
ipcMain.handle('create-browser-view', (event, url) => browserManager.createBrowserView(url));
ipcMain.handle('set-active-browser-view', (event, viewId) => browserManager.setActiveBrowserView(viewId));
ipcMain.handle('close-browser-view', (event, viewId) => {
  const success = browserManager.closeBrowserView(viewId);
  return success;
});
ipcMain.handle('navigate-browser-view', (event, viewId, url) => browserManager.navigateBrowserView(viewId, url));
ipcMain.handle('reload-browser-view', (event, viewId) => browserManager.reloadBrowserView(viewId));
ipcMain.handle('update-sidebar-state', (event, open, width) => {
  browserManager.updateSidebarState(open, width);
  return true;
});
ipcMain.handle('handle-fullscreen-change', (event, isFullscreen) => {
  browserManager.handleFullscreenChange(isFullscreen);
  return true;
});
ipcMain.handle('create-new-tab-with-url', async (event, url) => {
  // Send event to renderer to create a new tab with this URL
  // The renderer will handle tab creation and browser view management
  event.sender.send('create-new-tab-with-url', url);
  return true;
});

// IPC Handlers - Navigation
ipcMain.handle('go-back', (event, viewId) => navigationManager.goBack(viewId));
ipcMain.handle('go-forward', (event, viewId) => navigationManager.goForward(viewId));
ipcMain.handle('get-navigation-state', (event, viewId) => navigationManager.getNavigationState(viewId));

// IPC Handlers - Process Management
ipcMain.handle('get-tab-process-info', (event, viewId) => browserManager.getTabProcessInfo(viewId));
ipcMain.handle('terminate-tab-process', (event, viewId) => browserManager.terminateTabProcess(viewId));
ipcMain.handle('reload-crashed-tab', (event, viewId, url) => browserManager.reloadCrashedTab(viewId, url));
ipcMain.handle('get-all-processes-info', () => browserManager.getAllProcessesInfo());

// IPC Handlers - Window Controls
ipcMain.handle('minimize-window', () => windowManager.minimizeWindow());
ipcMain.handle('maximize-window', () => windowManager.maximizeWindow());
ipcMain.handle('close-window', () => windowManager.getWindow().close());

// Development helpers
if (isDev) {
  global.managers = {
    torrent: torrentManager,
    browser: browserManager,
    navigation: navigationManager,
    menu: menuManager,
    shortcuts: shortcutsManager,
    file: fileManager,
    security: securityManager,
    window: windowManager
  };
  console.log('🔧 Dev mode: Managers exposed to global.managers');
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  
  // Handle WebRTC/ICE connection errors gracefully
  if (reason && (reason.code === 'ERR_ICE_CONNECTION_CLOSED' || 
                 reason.message?.includes('ICE connection') ||
                 reason.message?.includes('WebRTC') ||
                 reason.message?.includes('peer connection'))) {
    console.warn('WebRTC/ICE connection error caught - this is likely due to network changes (VPN, etc.)');
    return; // Don't treat as fatal
  }
  
  // Handle other network-related errors
  if (reason && (reason.code === 'ENOTFOUND' || 
                 reason.code === 'ECONNREFUSED' ||
                 reason.code === 'ETIMEDOUT' ||
                 reason.message?.includes('tracker') ||
                 reason.message?.includes('announce'))) {
    console.warn('Network error caught (non-fatal):', reason.message);
    return; // Don't treat as fatal
  }
  
  // Log other unhandled rejections but don't crash
  console.error('Unhandled rejection details:', { reason, promise });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Handle WebRTC/ICE connection errors gracefully
  if (error.code === 'ERR_ICE_CONNECTION_CLOSED' || 
      error.message?.includes('ICE connection') ||
      error.message?.includes('WebRTC') ||
      error.message?.includes('peer connection')) {
    console.warn('WebRTC/ICE connection error caught - this is likely due to network changes (VPN, etc.)');
    return; // Don't crash the app
  }
  
  // Handle other network-related errors
  if (error.code === 'ENOTFOUND' || 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('tracker') ||
      error.message?.includes('announce')) {
    console.warn('Network error caught (non-fatal):', error.message);
    return; // Don't crash the app
  }
  
  // For truly fatal errors, log and exit
  console.error('Fatal error - exiting:', error);
  process.exit(1);
});

console.log('📦 Modular Electron Browser initialized with 8 managers');