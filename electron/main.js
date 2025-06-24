import { app, BrowserWindow, BrowserView, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import WebTorrent from 'webtorrent';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.IS_DEV === 'true';
const port = process.env.PORT || 5173;

let mainWindow;
let torrentClient;
let browserViews = new Map(); // Store browser views for web content
let currentViewId = null;

// Initialize WebTorrent client in main process
function initializeTorrentClient() {
  torrentClient = new WebTorrent({
    maxConns: 50,
    dht: true,
    lsd: true,
    webSeeds: true,
    tracker: {
      announce: [
        'udp://tracker.openbittorrent.com:80',
        'udp://tracker.opentrackr.org:1337/announce',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz'
      ]
    }
  });

  torrentClient.on('error', (err) => {
    console.error('WebTorrent error:', err);
    sendToRenderer('torrent-error', err.message);
  });

  torrentClient.on('warning', (err) => {
    console.warn('WebTorrent warning:', err);
    sendToRenderer('torrent-warning', err.message);
  });

  console.log('WebTorrent client initialized in main process');
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
  }

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${port}`) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('resize', () => {
    // Update browser view bounds when window is resized
    if (currentViewId && browserViews.has(currentViewId)) {
      const view = browserViews.get(currentViewId);
      const bounds = mainWindow.getBounds();
      view.setBounds({ 
        x: 0, 
        y: 84,
        width: bounds.width, 
        height: bounds.height - 84 
      });
    }
  });
}

app.whenReady().then(() => {
  initializeTorrentClient();
  createWindow();
});

app.on('window-all-closed', () => {
  if (torrentClient) {
    torrentClient.destroy();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.setAsDefaultProtocolClient('magnet');

// File operations
ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Videos', extensions: ['mp4', 'avi', 'mkv', 'mov'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
        { name: 'Documents', extensions: ['pdf', 'txt', 'doc', 'docx'] }
      ]
    });
    
    return result.canceled ? null : result.filePaths[0];
  } catch (error) {
    console.error('File selection error:', error);
    return null;
  }
});

ipcMain.handle('show-save-dialog', async (event, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(os.homedir(), 'Downloads', defaultName),
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });
    
    return result.canceled ? null : result.filePath;
  } catch (error) {
    console.error('Save dialog error:', error);
    return null;
  }
});

ipcMain.handle('get-download-path', async () => {
  return path.join(os.homedir(), 'Downloads');
});

// WebTorrent operations in main process
ipcMain.handle('add-torrent', async (event, magnetUri) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Adding torrent:', magnetUri);
      
      const torrent = torrentClient.add(magnetUri, {
        path: path.join(os.homedir(), 'Downloads')
      });

      const torrentId = magnetUri;

      torrent.on('ready', () => {
        console.log('Torrent ready:', torrent.name);
        
        const torrentInfo = {
          magnetUri,
          name: torrent.name,
          files: torrent.files.map(file => ({
            name: file.name,
            length: file.length,
            path: file.path
          })),
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0
        };

        resolve(torrentInfo);
      });

      torrent.on('download', () => {
        const progressData = {
          magnetUri,
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          peers: torrent.numPeers,
          downloaded: torrent.downloaded,
          uploaded: torrent.uploaded
        };
        
        sendToRenderer('torrent-progress', progressData);
      });

      torrent.on('done', () => {
        console.log('Torrent download completed:', torrent.name);
        sendToRenderer('torrent-completed', { magnetUri, name: torrent.name });
      });

      torrent.on('error', (err) => {
        console.error('Torrent error:', err);
        reject(err);
      });

      // Timeout if torrent doesn't become ready
      setTimeout(() => {
        if (!torrent.ready) {
          torrent.destroy();
          reject(new Error('Torrent timeout'));
        }
      }, 30000);

    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('seed-file', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Seeding file:', filePath);
      
      const torrent = torrentClient.seed(filePath, {
        announce: [
          'udp://tracker.openbittorrent.com:80',
          'udp://tracker.opentrackr.org:1337/announce',
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz'
        ]
      });

      torrent.on('ready', () => {
        console.log('File seeded:', torrent.name);
        console.log('Magnet URI:', torrent.magnetURI);
        
        resolve({
          magnetUri: torrent.magnetURI,
          name: torrent.name,
          infoHash: torrent.infoHash
        });
      });

      torrent.on('error', (err) => {
        console.error('Seeding error:', err);
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('download-file', async (event, magnetUri, fileName) => {
  try {
    const torrent = torrentClient.get(magnetUri);
    if (!torrent) {
      throw new Error('Torrent not found');
    }

    const file = torrent.files.find(f => f.name === fileName);
    if (!file) {
      throw new Error('File not found in torrent');
    }

    const savePath = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(os.homedir(), 'Downloads', fileName),
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });

    if (savePath.canceled) {
      return null;
    }

    // Create readable stream and pipe to file
    const fileStream = file.createReadStream();
    const writeStream = fs.createWriteStream(savePath.filePath);
    
    fileStream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log('File downloaded:', savePath.filePath);
        resolve(savePath.filePath);
      });

      writeStream.on('error', reject);
      fileStream.on('error', reject);
    });

  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
});

ipcMain.handle('pause-torrent', async (event, magnetUri) => {
  try {
    const torrent = torrentClient.get(magnetUri);
    if (torrent) {
      torrent.pause();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Pause error:', error);
    return false;
  }
});

ipcMain.handle('resume-torrent', async (event, magnetUri) => {
  try {
    const torrent = torrentClient.get(magnetUri);
    if (torrent) {
      torrent.resume();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Resume error:', error);
    return false;
  }
});

ipcMain.handle('remove-torrent', async (event, magnetUri) => {
  try {
    const torrent = torrentClient.get(magnetUri);
    if (torrent) {
      torrent.destroy();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Remove error:', error);
    return false;
  }
});

ipcMain.handle('get-torrent-stats', async () => {
  return {
    torrents: torrentClient.torrents.length,
    downloadSpeed: torrentClient.downloadSpeed,
    uploadSpeed: torrentClient.uploadSpeed,
    progress: torrentClient.progress
  };
});

// Handle magnet links from OS
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('magnet:')) {
    sendToRenderer('handle-magnet-link', url);
  }
});

// Web content management
ipcMain.handle('create-browser-view', async (event, url) => {
  try {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    const viewId = Date.now().toString();
    browserViews.set(viewId, view);

    // Set view bounds (adjust for tab bar and address bar)
    const bounds = mainWindow.getBounds();
    view.setBounds({ 
      x: 0, 
      y: 84, // Tab bar (36px) + Address bar (48px)
      width: bounds.width, 
      height: bounds.height - 84 
    });

    view.setAutoResize({ 
      width: true, 
      height: true 
    });

    // Load URL
    await view.webContents.loadURL(url);

    // Handle navigation events
    view.webContents.on('did-start-loading', () => {
      sendToRenderer('web-navigation', { viewId, event: 'loading-start' });
    });

    view.webContents.on('did-stop-loading', () => {
      sendToRenderer('web-navigation', { viewId, event: 'loading-stop' });
    });

    view.webContents.on('page-title-updated', (event, title) => {
      sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
    });

    view.webContents.on('did-navigate', (event, url) => {
      sendToRenderer('web-navigation', { viewId, event: 'navigate', url });
    });

    // Security: Prevent new windows
    view.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    console.log('Browser view created:', viewId, url);
    return viewId;

  } catch (error) {
    console.error('Error creating browser view:', error);
    return null;
  }
});

ipcMain.handle('set-active-browser-view', async (event, viewId) => {
  try {
    // Hide current view
    if (currentViewId && browserViews.has(currentViewId)) {
      mainWindow.removeBrowserView(browserViews.get(currentViewId));
    }

    // Show new view
    if (viewId && browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      mainWindow.addBrowserView(view);
      
      // Update bounds
      const bounds = mainWindow.getBounds();
      view.setBounds({ 
        x: 0, 
        y: 84,
        width: bounds.width, 
        height: bounds.height - 84 
      });
      
      currentViewId = viewId;
      console.log('Set active browser view:', viewId);
      return true;
    }

    currentViewId = null;
    return false;
  } catch (error) {
    console.error('Error setting active browser view:', error);
    return false;
  }
});

ipcMain.handle('close-browser-view', async (event, viewId) => {
  try {
    if (browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      
      if (currentViewId === viewId) {
        mainWindow.removeBrowserView(view);
        currentViewId = null;
      }
      
      view.webContents.destroy();
      browserViews.delete(viewId);
      
      console.log('Browser view closed:', viewId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error closing browser view:', error);
    return false;
  }
});

ipcMain.handle('navigate-browser-view', async (event, viewId, url) => {
  try {
    if (browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      await view.webContents.loadURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error navigating browser view:', error);
    return false;
  }
});

// Security
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev && url.startsWith('http://localhost:')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('permission-request', (event, permission, callback) => {
    const allowedPermissions = ['media'];
    
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      console.log(`Denied permission: ${permission}`);
      callback(false);
    }
  });
});