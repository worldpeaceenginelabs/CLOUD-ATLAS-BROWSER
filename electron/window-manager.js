import { BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.browserManager = null;
    this.isDev = false;
    this.port = 5173;
    this.windowConfig = {
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      show: false,
      titleBarStyle: 'default'
    };
    this.devToolsDetached = true;
  }

  // Set references
  setBrowserManager(browserManager) {
    this.browserManager = browserManager;
  }

  setDevelopmentMode(isDev) {
    this.isDev = isDev;
  }

  setPort(port) {
    this.port = port;
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Create main window
  createWindow() {
    console.log('Creating main window...');

    this.mainWindow = new BrowserWindow({
      ...this.windowConfig,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      icon: path.join(__dirname, 'assets', 'icon.png')
    });

    // Setup window event handlers
    this.setupWindowEventHandlers();

    // Setup security handlers
    this.setupSecurityHandlers();

    // Setup developer tools if in development
    if (this.isDev) {
      this.setupDevelopmentFeatures();
    }

    // Load the application
    this.loadApplication();

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      console.log('Main window shown');
    });

    // Set browser manager reference
    if (this.browserManager) {
      this.browserManager.setMainWindow(this.mainWindow);
    }

    console.log('Main window created successfully');
    return this.mainWindow;
  }

  // Setup window event handlers
  setupWindowEventHandlers() {
    // Handle window resize
    this.mainWindow.on('resize', () => {
      console.log('Window resize event');
      if (this.browserManager) {
        this.browserManager.updateBrowserViewBounds();
      }
    });

    // Handle window maximize
    this.mainWindow.on('maximize', () => {
      console.log('Window maximize event');
      // Small delay to ensure window state is updated
      setTimeout(() => {
        if (this.browserManager) {
          this.browserManager.updateBrowserViewBounds();
        }
      }, 10);
    });

    // Handle window unmaximize/restore
    this.mainWindow.on('unmaximize', () => {
      console.log('Window unmaximize event');
      // Small delay to ensure window state is updated
      setTimeout(() => {
        if (this.browserManager) {
          this.browserManager.updateBrowserViewBounds();
        }
      }, 10);
    });

    // Handle window restore (for Windows)
    this.mainWindow.on('restore', () => {
      console.log('Window restore event');
      setTimeout(() => {
        if (this.browserManager) {
          this.browserManager.updateBrowserViewBounds();
        }
      }, 10);
    });

    // Handle window move
    this.mainWindow.on('move', () => {
      if (this.browserManager) {
        this.browserManager.updateBrowserViewBounds();
      }
    });

    // Handle window close
    this.mainWindow.on('close', (event) => {
      console.log('Window close event');
      // Could add confirmation dialog here if needed
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      console.log('Window closed event');
      this.mainWindow = null;
    });

    // Handle window focus
    this.mainWindow.on('focus', () => {
      console.log('Window focused');
    });

    // Handle window blur
    this.mainWindow.on('blur', () => {
      console.log('Window blurred');
    });

    // Handle enter full screen
    this.mainWindow.on('enter-full-screen', () => {
      console.log('Entered full screen');
      this.sendToRenderer('window-state-changed', { fullscreen: true });
    });

    // Handle leave full screen
    this.mainWindow.on('leave-full-screen', () => {
      console.log('Left full screen');
      this.sendToRenderer('window-state-changed', { fullscreen: false });
    });

    // Handle window minimize
    this.mainWindow.on('minimize', () => {
      console.log('Window minimized');
      this.sendToRenderer('window-state-changed', { minimized: true });
    });

    // Handle window show
    this.mainWindow.on('show', () => {
      console.log('Window shown');
      this.sendToRenderer('window-state-changed', { minimized: false });
    });
  }

  // Setup security handlers
  setupSecurityHandlers() {
    // Handle window open
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log('Window open handler:', url);
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Handle navigation
    this.mainWindow.webContents.on('will-navigate', (event, url) => {
      console.log('Main window navigation attempt:', url);
      
      // Only allow navigation to localhost in dev or to file:// in production
      const isLocalhost = url.startsWith(`http://localhost:${this.port}`);
      const isFile = url.startsWith('file://');
      
      if (!isLocalhost && !isFile) {
        event.preventDefault();
        shell.openExternal(url);
        console.log('External navigation blocked, opened externally:', url);
      }
    });
  }

  // Setup development features
  setupDevelopmentFeatures() {
    console.log('Setting up development features');

    // Handle dev tools events
    this.mainWindow.webContents.on('devtools-opened', () => {
      console.log('Dev tools opened');
      // Update browser view bounds when dev tools open
      setTimeout(() => {
        if (this.browserManager) {
          this.browserManager.updateBrowserViewBounds();
        }
      }, 100);
    });

    this.mainWindow.webContents.on('devtools-closed', () => {
      console.log('Dev tools closed');
      // Update browser view bounds when dev tools close
      setTimeout(() => {
        if (this.browserManager) {
          this.browserManager.updateBrowserViewBounds();
        }
      }, 100);
    });
  }

  // Load the application
  loadApplication() {
    if (this.isDev) {
      console.log(`Loading development server: http://localhost:${this.port}`);
      this.mainWindow.loadURL(`http://localhost:${this.port}`);
    } else {
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      console.log(`Loading production build: ${indexPath}`);
      this.mainWindow.loadFile(indexPath);
    }
  }

  // Toggle developer tools
  toggleDevTools() {
    if (!this.isDev || !this.mainWindow) return;

    if (this.mainWindow.webContents.isDevToolsOpened()) {
      this.mainWindow.webContents.closeDevTools();
      console.log('Dev tools closed via window manager');
    } else {
      const mode = this.devToolsDetached ? 'detach' : 'bottom';
      this.mainWindow.webContents.openDevTools({ mode });
      console.log('Dev tools opened via window manager');
    }
  }

  // Set dev tools mode
  setDevToolsMode(detached = true) {
    this.devToolsDetached = detached;
    console.log('Dev tools mode set to:', detached ? 'detached' : 'docked');
  }

  // Window state management
  minimizeWindow() {
    if (this.mainWindow) {
      this.mainWindow.minimize();
      console.log('Window minimized via window manager');
    }
  }

  maximizeWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
        console.log('Window unmaximized via window manager');
      } else {
        this.mainWindow.maximize();
        console.log('Window maximized via window manager');
      }
    }
  }

  toggleFullscreen() {
    if (this.mainWindow) {
      const isFullScreen = this.mainWindow.isFullScreen();
      this.mainWindow.setFullScreen(!isFullScreen);
      console.log('Fullscreen toggled:', !isFullScreen);
    }
  }

  centerWindow() {
    if (this.mainWindow) {
      this.mainWindow.center();
      console.log('Window centered');
    }
  }

  // Window configuration
  setWindowSize(width, height) {
    if (this.mainWindow) {
      this.mainWindow.setSize(width, height);
      console.log('Window size set to:', width, 'x', height);
    }
  }

  setMinimumSize(width, height) {
    if (this.mainWindow) {
      this.mainWindow.setMinimumSize(width, height);
      console.log('Minimum window size set to:', width, 'x', height);
    }
  }

  setMaximumSize(width, height) {
    if (this.mainWindow) {
      this.mainWindow.setMaximumSize(width, height);
      console.log('Maximum window size set to:', width, 'x', height);
    }
  }

  // Window position
  setWindowPosition(x, y) {
    if (this.mainWindow) {
      this.mainWindow.setPosition(x, y);
      console.log('Window position set to:', x, ',', y);
    }
  }

  // Window visibility
  showWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      console.log('Window shown');
    }
  }

  hideWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
      console.log('Window hidden');
    }
  }

  focusWindow() {
    if (this.mainWindow) {
      this.mainWindow.focus();
      console.log('Window focused');
    }
  }

  // Window properties
  setTitle(title) {
    if (this.mainWindow) {
      this.mainWindow.setTitle(title);
      console.log('Window title set to:', title);
    }
  }

  setIcon(iconPath) {
    if (this.mainWindow) {
      this.mainWindow.setIcon(iconPath);
      console.log('Window icon set to:', iconPath);
    }
  }

  // Menu bar management
  setMenuBarVisibility(visible) {
    if (this.mainWindow) {
      this.mainWindow.setMenuBarVisibility(visible);
      console.log('Menu bar visibility set to:', visible);
    }
  }

  toggleMenuBar() {
    if (this.mainWindow) {
      const isVisible = this.mainWindow.isMenuBarVisible();
      this.mainWindow.setMenuBarVisibility(!isVisible);
      console.log('Menu bar toggled:', !isVisible ? 'visible' : 'hidden');
    }
  }

  // Window state queries
  isMaximized() {
    return this.mainWindow ? this.mainWindow.isMaximized() : false;
  }

  isMinimized() {
    return this.mainWindow ? this.mainWindow.isMinimized() : false;
  }

  isFullScreen() {
    return this.mainWindow ? this.mainWindow.isFullScreen() : false;
  }

  isVisible() {
    return this.mainWindow ? this.mainWindow.isVisible() : false;
  }

  isFocused() {
    return this.mainWindow ? this.mainWindow.isFocused() : false;
  }

  // Get window information
  getWindowBounds() {
    return this.mainWindow ? this.mainWindow.getBounds() : null;
  }

  getWindowSize() {
    return this.mainWindow ? this.mainWindow.getSize() : null;
  }

  getWindowPosition() {
    return this.mainWindow ? this.mainWindow.getPosition() : null;
  }

  getContentSize() {
    return this.mainWindow ? this.mainWindow.getContentSize() : null;
  }

  // Window state persistence
  saveWindowState() {
    if (!this.mainWindow) return null;

    return {
      bounds: this.mainWindow.getBounds(),
      isMaximized: this.mainWindow.isMaximized(),
      isFullScreen: this.mainWindow.isFullScreen()
    };
  }

  restoreWindowState(state) {
    if (!this.mainWindow || !state) return;

    try {
      if (state.isFullScreen) {
        this.mainWindow.setFullScreen(true);
      } else if (state.isMaximized) {
        this.mainWindow.maximize();
      } else if (state.bounds) {
        this.mainWindow.setBounds(state.bounds);
      }
      console.log('Window state restored');
    } catch (error) {
      console.error('Error restoring window state:', error);
    }
  }

  // Performance monitoring
  getWindowPerformanceInfo() {
    if (!this.mainWindow) return null;

    return {
      processId: this.mainWindow.webContents.getOSProcessId(),
      crashed: this.mainWindow.webContents.isCrashed(),
      loading: this.mainWindow.webContents.isLoading(),
      url: this.mainWindow.webContents.getURL(),
      title: this.mainWindow.webContents.getTitle(),
      zoomLevel: this.mainWindow.webContents.getZoomLevel(),
      zoomFactor: this.mainWindow.webContents.getZoomFactor()
    };
  }

  // Reload application
  reloadApp() {
    if (this.mainWindow) {
      this.mainWindow.reload();
      console.log('Application reloaded');
    }
  }

  forceReloadApp() {
    if (this.mainWindow) {
      this.mainWindow.webContents.reloadIgnoringCache();
      console.log('Application force reloaded');
    }
  }

  // Window configuration updates
  updateWindowConfig(newConfig) {
    this.windowConfig = { ...this.windowConfig, ...newConfig };
    console.log('Window config updated:', newConfig);
  }

  // Get current configuration
  getWindowConfig() {
    return { ...this.windowConfig };
  }

  // Check if window exists
  hasWindow() {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }

  // Get window reference
  getWindow() {
    return this.mainWindow;
  }

  // Get window statistics
  getWindowStats() {
    if (!this.mainWindow) return null;

    return {
      exists: this.hasWindow(),
      visible: this.isVisible(),
      focused: this.isFocused(),
      maximized: this.isMaximized(),
      minimized: this.isMinimized(),
      fullScreen: this.isFullScreen(),
      bounds: this.getWindowBounds(),
      contentSize: this.getContentSize(),
      title: this.mainWindow.getTitle(),
      isDev: this.isDev,
      devToolsOpen: this.mainWindow.webContents.isDevToolsOpened()
    };
  }

  // Cleanup
  destroy() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
    this.mainWindow = null;
    console.log('Window manager destroyed');
  }
}

// Export a singleton instance
export default new WindowManager();