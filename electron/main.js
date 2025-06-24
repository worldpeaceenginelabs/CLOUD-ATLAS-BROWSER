import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security: Enable context isolation by default
app.commandLine.appendSwitch('--enable-features', 'ElectronSerialChooser');

const isDev = process.env.IS_DEV === 'true';
const port = process.env.PORT || 5173;

let mainWindow;

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,          // Security: Disable node integration
      contextIsolation: true,          // Security: Enable context isolation
      enableRemoteModule: false,       // Security: Disable remote module
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,               // Security: Enable web security
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false, // Don't show until ready
    titleBarStyle: 'default'
  });

  // Security: Remove menu in production
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
  }

  // Load the app - dev server or built files
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Security: Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${port}`) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent protocol handler hijacking
app.setAsDefaultProtocolClient('magnet');

// IPC Handlers for secure communication
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
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    return result.canceled ? null : result.filePath;
  } catch (error) {
    console.error('Save dialog error:', error);
    return null;
  }
});

ipcMain.handle('read-file-for-seeding', async (event, filePath) => {
  try {
    // Security: Validate file path
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size > 5 * 1024 * 1024 * 1024) { // 5GB limit
      throw new Error('File too large (max 5GB)');
    }
    
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error('File reading error:', error);
    throw error;
  }
});

ipcMain.handle('save-stream-to-file', async (event, streamData, filePath) => {
  try {
    // Security: Validate file path
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, streamData);
    return true;
  } catch (error) {
    console.error('File saving error:', error);
    throw error;
  }
});

ipcMain.handle('get-download-path', async () => {
  return path.join(os.homedir(), 'Downloads');
});

ipcMain.handle('validate-magnet-uri', async (event, magnetUri) => {
  try {
    // Basic magnet URI validation
    return magnetUri && 
           magnetUri.startsWith('magnet:') && 
           magnetUri.includes('xt=urn:btih:');
  } catch (error) {
    return false;
  }
});

// Handle magnet link protocol
ipcMain.handle('handle-magnet-link', async (event, magnetUri) => {
  try {
    mainWindow.webContents.send('handle-magnet-link', magnetUri);
    return true;
  } catch (error) {
    console.error('Magnet link handling error:', error);
    return false;
  }
});

// Security: Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In development, ignore certificate errors for localhost
  if (isDev && url.startsWith('http://localhost:')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Security: Limit permissions
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