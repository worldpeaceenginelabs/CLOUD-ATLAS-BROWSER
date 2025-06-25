import { app, BrowserWindow, BrowserView, ipcMain, dialog, shell, Menu } from 'electron';
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
let navigationHistory = new Map(); // Store navigation history for each view

// Calculate the correct Y offset for browser views (tab bar + address bar)
const TAB_BAR_HEIGHT = 36;
const ADDRESS_BAR_HEIGHT = 48;
const BROWSER_VIEW_Y_OFFSET = TAB_BAR_HEIGHT + ADDRESS_BAR_HEIGHT;

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

function updateBrowserViewBounds() {
  if (currentViewId && browserViews.has(currentViewId)) {
    const view = browserViews.get(currentViewId);
    const [width, height] = mainWindow.getContentSize();
    
    console.log('Updating browser view bounds:', {
      width,
      height,
      yOffset: BROWSER_VIEW_Y_OFFSET,
      viewHeight: height - BROWSER_VIEW_Y_OFFSET
    });
    
    view.setBounds({ 
      x: 0, 
      y: BROWSER_VIEW_Y_OFFSET,
      width: width, 
      height: height - BROWSER_VIEW_Y_OFFSET
    });
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

  // Set up menu for development
  if (isDev) {
    const template = [
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle Developer Tools',
            accelerator: 'F12',
            click: () => {
              if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow.webContents.openDevTools({ mode: 'detach' });
              }
            }
          },
          {
            label: 'Focus Address Bar',
            accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L',
            click: () => {
              sendToRenderer('focus-address-bar');
            }
          },
          { type: 'separator' },
          {
            label: 'Reload Page',
            accelerator: 'F5',
            click: () => {
              // Reload the current website, not the electron app
              if (currentViewId && browserViews.has(currentViewId)) {
                const view = browserViews.get(currentViewId);
                view.webContents.reload();
                console.log('Reloading current website in view:', currentViewId);
              } else {
                // No active browser view, reload the electron app
                mainWindow.reload();
                console.log('No active website, reloading Electron app');
              }
            }
          },
          {
            label: 'Force Reload Page',
            accelerator: 'CmdOrCtrl+F5',
            click: () => {
              // Force reload the current website
              if (currentViewId && browserViews.has(currentViewId)) {
                const view = browserViews.get(currentViewId);
                view.webContents.reloadIgnoringCache();
                console.log('Force reloading current website in view:', currentViewId);
              } else {
                // No active browser view, force reload the electron app
                mainWindow.webContents.reloadIgnoringCache();
                console.log('No active website, force reloading Electron app');
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Reload Electron App',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: () => {
              mainWindow.reload();
            }
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    mainWindow.setMenuBarVisibility(false);
  }

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`);
    // Don't auto-open dev tools - let user open them manually with F12
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
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

  // Handle dev tools and page reload properly
  if (isDev) {
    // Allow F12 to toggle dev tools and F5 to reload current page
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          // Open dev tools in detached mode to avoid layout issues
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      } else if (input.key === 'F5') {
        // Reload the current website, not the electron app
        if (currentViewId && browserViews.has(currentViewId)) {
          const view = browserViews.get(currentViewId);
          if (input.control || input.meta) {
            // Ctrl+F5 or Cmd+F5 for hard reload
            view.webContents.reloadIgnoringCache();
          } else {
            // F5 for normal reload
            view.webContents.reload();
          }
          console.log('Reloading current website in view:', currentViewId);
        } else {
          // No active browser view, reload the electron app (for development)
          if (input.control || input.meta) {
            mainWindow.webContents.reloadIgnoringCache();
          } else {
            mainWindow.reload();
          }
          console.log('No active website, reloading Electron app');
        }
      } else if ((input.control || input.meta) && input.key.toLowerCase() === 'l') {
        // Ctrl+L or Cmd+L to focus address bar
        sendToRenderer('focus-address-bar');
      }
    });

    // Handle dev tools resize to not interfere with browser views
    mainWindow.webContents.on('devtools-opened', () => {
      console.log('Dev tools opened');
      // Update browser view bounds when dev tools open
      setTimeout(updateBrowserViewBounds, 100);
    });

    mainWindow.webContents.on('devtools-closed', () => {
      console.log('Dev tools closed');
      // Update browser view bounds when dev tools close
      setTimeout(updateBrowserViewBounds, 100);
    });
  }

  // Handle all resize events
  mainWindow.on('resize', () => {
    console.log('Window resize event');
    updateBrowserViewBounds();
  });

  // Handle maximize event
  mainWindow.on('maximize', () => {
    console.log('Window maximize event');
    // Small delay to ensure window state is updated
    setTimeout(updateBrowserViewBounds, 10);
  });

  // Handle unmaximize/restore event
  mainWindow.on('unmaximize', () => {
    console.log('Window unmaximize event');
    // Small delay to ensure window state is updated
    setTimeout(updateBrowserViewBounds, 10);
  });

  // Handle window state changes (for Windows)
  mainWindow.on('restore', () => {
    console.log('Window restore event');
    setTimeout(updateBrowserViewBounds, 10);
  });

  // Handle when window is moved (can affect bounds on some systems)
  mainWindow.on('move', () => {
    updateBrowserViewBounds();
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

// Web content management with process isolation
ipcMain.handle('create-browser-view', async (event, url) => {
  try {
    console.log('Creating process-isolated browser view for URL:', url);
    
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        sandbox: false,
        // Enable process isolation
        processIsolation: true,
        // Each BrowserView gets its own process
        partition: `persist:tab-${Date.now()}`, // Unique partition per tab
        // Additional security
        experimentalFeatures: false,
        enableBlinkFeatures: '',
        disableBlinkFeatures: 'Auxclick',
        // Memory management
        backgroundThrottling: true,
        offscreen: false
      }
    });

    const viewId = Date.now().toString();
    browserViews.set(viewId, view);

    // Set view bounds using proper content size
    const [width, height] = mainWindow.getContentSize();
    view.setBounds({ 
      x: 0, 
      y: BROWSER_VIEW_Y_OFFSET,
      width: width, 
      height: height - BROWSER_VIEW_Y_OFFSET
    });

    view.setAutoResize({ 
      width: true, 
      height: true 
    });

    // Enhanced navigation events
    view.webContents.on('did-start-loading', () => {
      console.log('Browser view started loading:', viewId);
      sendToRenderer('web-navigation', { viewId, event: 'loading-start' });
    });

    view.webContents.on('did-stop-loading', () => {
      console.log('Browser view stopped loading:', viewId);
      sendToRenderer('web-navigation', { viewId, event: 'loading-stop' });
    });

    view.webContents.on('did-finish-load', async () => {
      console.log('Browser view finished loading:', viewId);
      sendToRenderer('web-navigation', { viewId, event: 'loading-finish' });
      
      // Get the page title after a small delay to ensure it's fully loaded
      setTimeout(() => {
        const title = view.webContents.getTitle();
        if (title && title.trim() && title !== 'Loading...' && title !== '') {
          console.log('Page title after load delay:', viewId, title);
          sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
        }
      }, 500); // Small delay to let the page title fully load
      
      // Get memory usage for this specific tab
      try {
        const memInfo = await view.webContents.getProcessMemoryInfo();
        const processId = view.webContents.getOSProcessId();
        console.log(`Tab ${viewId} (PID: ${processId}) memory usage:`, memInfo);
        sendToRenderer('tab-process-info', { 
          viewId, 
          processId, 
          memoryInfo: memInfo,
          type: 'memory-update'
        });
      } catch (error) {
        console.error('Error getting memory info for tab:', viewId, error);
      }
    });

    view.webContents.on('page-title-updated', (event, title) => {
      console.log('Browser view title updated:', viewId, title);
      // Send title immediately when it's updated
      if (title && title.trim() && title !== 'Loading...') {
        sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
      }
    });

    view.webContents.on('dom-ready', () => {
      console.log('DOM ready for view:', viewId);
      // Check for title when DOM is ready but don't override if we already have a good title
      setTimeout(() => {
        const title = view.webContents.getTitle();
        if (title && title.trim() && title !== 'Loading...' && title !== '') {
          console.log('Title from DOM ready (delayed):', viewId, title);
          sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
        }
      }, 200); // Short delay for DOM to fully process
    });

    view.webContents.on('page-favicon-updated', (event, favicons) => {
      console.log('Browser view favicon updated:', viewId, favicons);
      if (favicons && favicons.length > 0) {
        sendToRenderer('web-navigation', { viewId, event: 'favicon-updated', favicon: favicons[0] });
      }
    });

    view.webContents.on('did-navigate', (event, url) => {
      console.log('Browser view navigated:', viewId, url);
      
      // Update navigation history
      if (!navigationHistory.has(viewId)) {
        navigationHistory.set(viewId, { history: [], currentIndex: -1 });
      }
      
      const navHistory = navigationHistory.get(viewId);
      
      // If we're not at the end of history, remove forward entries
      if (navHistory.currentIndex < navHistory.history.length - 1) {
        navHistory.history = navHistory.history.slice(0, navHistory.currentIndex + 1);
      }
      
      // Add new entry
      navHistory.history.push(url);
      navHistory.currentIndex = navHistory.history.length - 1;
      
      sendToRenderer('web-navigation', { 
        viewId, 
        event: 'navigate', 
        url,
        canGoBack: navHistory.currentIndex > 0,
        canGoForward: navHistory.currentIndex < navHistory.history.length - 1
      });
    });

    view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Browser view failed to load:', viewId, errorCode, errorDescription, validatedURL);
      sendToRenderer('web-navigation', { viewId, event: 'load-failed', error: errorDescription });
    });

    // Enhanced security: limit what the page can do
    view.webContents.setWindowOpenHandler(({ url }) => {
      console.log('New window requested from view:', viewId, 'URL:', url);
      // Send to renderer to create new tab
      sendToRenderer('create-new-tab-with-url', url);
      return { action: 'deny' };
    });

    // Handle crashes in individual tabs
    view.webContents.on('crashed', (event, killed) => {
      console.error(`Tab ${viewId} crashed:`, { killed });
      sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'crashed', 
        killed,
        message: 'Tab crashed and needs to be reloaded'
      });
    });

    // Handle unresponsive tabs
    view.webContents.on('unresponsive', () => {
      console.warn(`Tab ${viewId} became unresponsive`);
      sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'unresponsive',
        message: 'Tab is not responding'
      });
    });

    view.webContents.on('responsive', () => {
      console.log(`Tab ${viewId} became responsive again`);
      sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'responsive',
        message: 'Tab is responding normally'
      });
    });

    // Monitor when renderer process changes (rare but possible)
    view.webContents.on('render-process-gone', (event, details) => {
      console.error(`Tab ${viewId} renderer process gone:`, details);
      sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'process-gone', 
        details,
        message: 'Tab process terminated unexpectedly'
      });
    });

    // Load URL
    console.log('Loading URL in process-isolated browser view:', url);
    await view.webContents.loadURL(url);

    // Get initial process info
    try {
      const processId = view.webContents.getOSProcessId();
      console.log(`Browser view created with PID: ${processId} for viewId: ${viewId}`);
      sendToRenderer('tab-process-info', { 
        viewId, 
        processId, 
        type: 'created',
        message: `Tab created in process ${processId}`
      });
    } catch (error) {
      console.error('Error getting initial process info:', error);
    }

    console.log('Process-isolated browser view created successfully:', viewId, url);
    return viewId;

  } catch (error) {
    console.error('Error creating process-isolated browser view:', error);
    return null;
  }
});

ipcMain.handle('set-active-browser-view', async (event, viewId) => {
  try {
    console.log('Setting active browser view:', viewId, 'current:', currentViewId);
    
    // Hide current view
    if (currentViewId && browserViews.has(currentViewId)) {
      const currentView = browserViews.get(currentViewId);
      mainWindow.removeBrowserView(currentView);
      console.log('Removed current view:', currentViewId);
    }

    // Show new view
    if (viewId && browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      mainWindow.addBrowserView(view);
      
      // Update bounds using proper content size
      const [width, height] = mainWindow.getContentSize();
      view.setBounds({ 
        x: 0, 
        y: BROWSER_VIEW_Y_OFFSET,
        width: width, 
        height: height - BROWSER_VIEW_Y_OFFSET
      });
      
      // Focus the view to ensure it's interactive
      view.webContents.focus();
      
      currentViewId = viewId;
      console.log('Set active browser view:', viewId, 'with bounds:', {
        x: 0, 
        y: BROWSER_VIEW_Y_OFFSET,
        width: width, 
        height: height - BROWSER_VIEW_Y_OFFSET
      });
      return true;
    } else if (viewId && !browserViews.has(viewId)) {
      console.warn('Requested view ID not found:', viewId, 'Available views:', Array.from(browserViews.keys()));
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
      
      // Clean up navigation history
      if (navigationHistory.has(viewId)) {
        navigationHistory.delete(viewId);
      }
      
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

// Navigation history handlers
ipcMain.handle('go-back', async (event, viewId) => {
  try {
    if (browserViews.has(viewId) && navigationHistory.has(viewId)) {
      const navHistory = navigationHistory.get(viewId);
      if (navHistory.currentIndex > 0) {
        navHistory.currentIndex--;
        const url = navHistory.history[navHistory.currentIndex];
        
        const view = browserViews.get(viewId);
        await view.webContents.loadURL(url);
        
        sendToRenderer('web-navigation', { 
          viewId, 
          event: 'navigate', 
          url,
          canGoBack: navHistory.currentIndex > 0,
          canGoForward: navHistory.currentIndex < navHistory.history.length - 1
        });
        
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error going back:', error);
    return false;
  }
});

ipcMain.handle('go-forward', async (event, viewId) => {
  try {
    if (browserViews.has(viewId) && navigationHistory.has(viewId)) {
      const navHistory = navigationHistory.get(viewId);
      if (navHistory.currentIndex < navHistory.history.length - 1) {
        navHistory.currentIndex++;
        const url = navHistory.history[navHistory.currentIndex];
        
        const view = browserViews.get(viewId);
        await view.webContents.loadURL(url);
        
        sendToRenderer('web-navigation', { 
          viewId, 
          event: 'navigate', 
          url,
          canGoBack: navHistory.currentIndex > 0,
          canGoForward: navHistory.currentIndex < navHistory.history.length - 1
        });
        
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error going forward:', error);
    return false;
  }
});

ipcMain.handle('get-navigation-state', async (event, viewId) => {
  try {
    if (navigationHistory.has(viewId)) {
      const navHistory = navigationHistory.get(viewId);
      return {
        canGoBack: navHistory.currentIndex > 0,
        canGoForward: navHistory.currentIndex < navHistory.history.length - 1
      };
    }
    return { canGoBack: false, canGoForward: false };
  } catch (error) {
    console.error('Error getting navigation state:', error);
    return { canGoBack: false, canGoForward: false };
  }
});

// Process management functions
ipcMain.handle('get-tab-process-info', async (event, viewId) => {
  try {
    if (browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      const processId = view.webContents.getOSProcessId();
      const memoryInfo = await view.webContents.getProcessMemoryInfo();
      
      return {
        processId,
        memoryInfo,
        crashed: view.webContents.isCrashed(),
        loading: view.webContents.isLoading(),
        url: view.webContents.getURL(),
        title: view.webContents.getTitle()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting tab process info:', error);
    return null;
  }
});

ipcMain.handle('terminate-tab-process', async (event, viewId) => {
  try {
    if (browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      view.webContents.forcefullyCrashRenderer();
      console.log('Terminated process for tab:', viewId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error terminating tab process:', error);
    return false;
  }
});

ipcMain.handle('reload-crashed-tab', async (event, viewId, url) => {
  try {
    if (browserViews.has(viewId)) {
      const view = browserViews.get(viewId);
      if (view.webContents.isCrashed()) {
        await view.webContents.loadURL(url);
        console.log('Reloaded crashed tab:', viewId, url);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error reloading crashed tab:', error);
    return false;
  }
});

ipcMain.handle('get-all-processes-info', async () => {
  try {
    const processesInfo = [];
    
    for (const [viewId, view] of browserViews) {
      try {
        const processId = view.webContents.getOSProcessId();
        const memoryInfo = await view.webContents.getProcessMemoryInfo();
        
        processesInfo.push({
          viewId,
          processId,
          memoryInfo,
          crashed: view.webContents.isCrashed(),
          loading: view.webContents.isLoading(),
          url: view.webContents.getURL(),
          title: view.webContents.getTitle()
        });
      } catch (error) {
        console.error('Error getting process info for view:', viewId, error);
      }
    }
    
    return processesInfo;
  } catch (error) {
    console.error('Error getting all processes info:', error);
    return [];
  }
});

// Security - handle new windows appropriately
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    // Check if this is from a browser view
    const isBrowserView = Array.from(browserViews.values()).some(view => 
      view.webContents === contents
    );
    
    if (isBrowserView) {
      // Send to renderer to create new tab
      event.preventDefault();
      sendToRenderer('create-new-tab-with-url', navigationUrl);
    } else {
      // For main window or other contexts, open externally
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
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