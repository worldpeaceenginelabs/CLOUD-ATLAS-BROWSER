import { app, BrowserWindow, BrowserView, ipcMain, dialog, shell, session } from 'electron';
import { fileURLToPath } from 'node:url';
import { readFile, createWriteStream } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readFileAsync = promisify(readFile);

// Security: Disable node integration and enable context isolation
process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let mainWindow;
const tabViews = new Map();

// Security: Configure Content Security Policy
const setupCSP = () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob: wss: ws:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob: https:; " +
          "media-src 'self' data: blob: https:; " +
          "connect-src 'self' wss: ws: https: http:; " +
          "font-src 'self' data:;"
        ]
      }
    });
  });
};

// Security: Setup secure session defaults
const setupSecureSession = () => {
  // Clear any insecure data
  session.defaultSession.clearStorageData();
  
  // Configure security settings
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Deny dangerous permissions by default
    const deniedPermissions = ['openExternal', 'notifications'];
    if (deniedPermissions.includes(permission)) {
      callback(false);
      return;
    }
    
    // Allow safe permissions
    const allowedPermissions = ['media', 'geolocation'];
    callback(allowedPermissions.includes(permission));
  });

  // Block external navigation attempts
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    
    // Allow local development server and file protocols
    if (url.startsWith('http://localhost:') || 
        url.startsWith('https://localhost:') ||
        url.startsWith('file://') ||
        url.startsWith('devtools://')) {
      callback({});
      return;
    }
    
    // Allow specific domains for WebTorrent trackers
    const allowedDomains = [
      'tracker.openwebtorrent.com',
      'tracker.btorrent.xyz',
      'tracker.webtorrent.io'
    ];
    
    const urlObj = new URL(url);
    if (allowedDomains.includes(urlObj.hostname)) {
      callback({});
      return;
    }
    
    // Block everything else in the main process
    callback({ cancel: true });
  });
};

function createWindow() {
  // Setup security before creating windows
  setupCSP();
  setupSecureSession();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,           // Security: Disable node integration
      contextIsolation: true,           // Security: Enable context isolation
      enableRemoteModule: false,        // Security: Disable remote module
      allowRunningInsecureContent: false, // Security: Block insecure content
      experimentalFeatures: false,      // Security: Disable experimental features
      webgl: false,                     // Security: Disable WebGL
      plugins: false,                   // Security: Disable plugins
      sandbox: false,                   // Keep false for WebTorrent functionality
      webSecurity: true,                // Security: Enable web security
      partition: 'main-window'          // Isolated session
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png') // Add app icon
  });

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow opening in external browser for safe URLs
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Security: Handle navigation attempts
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Only allow navigation to local development server
    if (parsedUrl.origin !== 'http://localhost:5173' && 
        !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Load the application
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Development: Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Security: Validate all file paths
const validateFilePath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }
  
  const normalizedPath = path.normalize(filePath);
  const isAbsolute = path.isAbsolute(normalizedPath);
  
  if (!isAbsolute) {
    throw new Error('File path must be absolute');
  }
  
  return normalizedPath;
};

// IPC Handlers with security validation
ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Media Files', extensions: ['mp4', 'avi', 'mkv', 'mp3', 'wav'] },
        { name: 'Documents', extensions: ['pdf', 'txt', 'doc', 'docx'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return validateFilePath(result.filePaths[0]);
    }
    return null;
  } catch (error) {
    console.error('Error selecting file:', error);
    return null;
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return validateFilePath(result.filePaths[0]);
    }
    return null;
  } catch (error) {
    console.error('Error selecting folder:', error);
    return null;
  }
});

ipcMain.handle('get-download-path', async () => {
  return app.getPath('downloads');
});

ipcMain.handle('show-save-dialog', async (event, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath('downloads'), defaultName),
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    return result.canceled ? null : result.filePath;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    return null;
  }
});

ipcMain.handle('read-file-for-seeding', async (event, filePath) => {
  try {
    const validatedPath = validateFilePath(filePath);
    const buffer = await readFileAsync(validatedPath);
    return buffer;
  } catch (error) {
    console.error('Error reading file for seeding:', error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('save-stream-to-file', async (event, streamData, savePath) => {
  try {
    const validatedPath = validateFilePath(savePath);
    // Implementation would depend on how stream data is passed
    // This is a placeholder for the actual implementation
    return true;
  } catch (error) {
    console.error('Error saving stream to file:', error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
});

// Enhanced tab management with BrowserView for better security
ipcMain.handle('create-tab-view', async (event, url) => {
  try {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,                    // Enable sandbox for tab content
        preload: path.join(__dirname, 'tab-preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: `persist:tab-${Date.now()}`
      }
    });

    // Security: Handle navigation in tabs
    view.webContents.on('will-navigate', (event, navigationUrl) => {
      // Allow navigation to safe URLs only
      const parsedUrl = new URL(navigationUrl);
      const allowedProtocols = ['https:', 'http:', 'magnet:'];
      
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        event.preventDefault();
      }
    });

    // Security: Prevent new window creation from tabs
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const viewId = Date.now();
    tabViews.set(viewId, view);

    // Load URL if provided
    if (url) {
      if (url.startsWith('magnet:')) {
        // Handle magnet links in the main process
        // Load a special torrent handler page
        view.webContents.loadURL(`file://${path.join(RENDERER_DIST, 'torrent.html')}?magnet=${encodeURIComponent(url)}`);
      } else {
        view.webContents.loadURL(url);
      }
    }

    return viewId;
  } catch (error) {
    console.error('Error creating tab view:', error);
    return null;
  }
});

ipcMain.handle('set-active-tab-view', async (event, viewId) => {
  try {
    const view = tabViews.get(viewId);
    if (view && mainWindow) {
      mainWindow.setBrowserView(view);
      
      // Set view bounds (adjust for your UI layout)
      const bounds = mainWindow.getBounds();
      view.setBounds({
        x: 0,
        y: 90, // Adjust based on your tab bar height
        width: bounds.width - 400, // Adjust for sidebar
        height: bounds.height - 90
      });
    }
  } catch (error) {
    console.error('Error setting active tab view:', error);
  }
});

ipcMain.handle('close-tab-view', async (event, viewId) => {
  try {
    const view = tabViews.get(viewId);
    if (view) {
      if (mainWindow && mainWindow.getBrowserView() === view) {
        mainWindow.setBrowserView(null);
      }
      view.webContents.destroy();
      tabViews.delete(viewId);
    }
  } catch (error) {
    console.error('Error closing tab view:', error);
  }
});

// App event handlers
app.on('window-all-closed', () => {
  // Cleanup all tab views
  tabViews.forEach(view => view.webContents.destroy());
  tabViews.clear();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (process.env.NODE_ENV === 'development' && url.startsWith('https://localhost:')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Security: Handle protocol registration securely
app.whenReady().then(() => {
  // Register magnet protocol handler
  app.setAsDefaultProtocolClient('magnet');
  
  createWindow();
});

// Handle magnet link clicks from external applications
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('magnet:')) {
    // Send magnet link to renderer process
    if (mainWindow) {
      mainWindow.webContents.send('handle-magnet-link', url);
    }
  }
});