class ShortcutsManager {
  constructor() {
    this.mainWindow = null;
    this.browserManager = null;
    this.isDev = false;
    this.shortcuts = new Map();
    this.isEnabled = true;
  }

  // Set references
  setMainWindow(window) {
    this.mainWindow = window;
  }

  setBrowserManager(browserManager) {
    this.browserManager = browserManager;
  }

  setDevelopmentMode(isDev) {
    this.isDev = isDev;
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Initialize shortcuts
  initialize() {
    this.registerDefaultShortcuts();
    this.setupEventListeners();
    console.log('Shortcuts manager initialized');
  }

  // Register default shortcuts
  registerDefaultShortcuts() {
    // Navigation shortcuts
    this.registerShortcut('Ctrl+L', 'focus-address-bar', () => {
      this.sendToRenderer('focus-address-bar');
    });

    this.registerShortcut('Cmd+L', 'focus-address-bar', () => {
      this.sendToRenderer('focus-address-bar');
    });

    // Tab management
    this.registerShortcut('Ctrl+T', 'new-tab', () => {
      this.sendToRenderer('new-tab');
    });

    this.registerShortcut('Cmd+T', 'new-tab', () => {
      this.sendToRenderer('new-tab');
    });

    this.registerShortcut('Ctrl+W', 'close-tab', () => {
      this.sendToRenderer('close-current-tab');
    });

    this.registerShortcut('Cmd+W', 'close-tab', () => {
      this.sendToRenderer('close-current-tab');
    });

    // Page reload shortcuts
    this.registerShortcut('F5', 'reload-page', () => {
      this.handlePageReload(false);
    });

    this.registerShortcut('Ctrl+F5', 'force-reload-page', () => {
      this.handlePageReload(true);
    });

    this.registerShortcut('Cmd+F5', 'force-reload-page', () => {
      this.handlePageReload(true);
    });

    this.registerShortcut('Ctrl+R', 'reload-page', () => {
      this.handlePageReload(false);
    });

    this.registerShortcut('Cmd+R', 'reload-page', () => {
      this.handlePageReload(false);
    });

    // Navigation shortcuts
    this.registerShortcut('Alt+Left', 'navigate-back', () => {
      this.sendToRenderer('navigate-back');
    });

    this.registerShortcut('Cmd+Left', 'navigate-back', () => {
      this.sendToRenderer('navigate-back');
    });

    this.registerShortcut('Alt+Right', 'navigate-forward', () => {
      this.sendToRenderer('navigate-forward');
    });

    this.registerShortcut('Cmd+Right', 'navigate-forward', () => {
      this.sendToRenderer('navigate-forward');
    });

    // Development shortcuts (enabled for both dev and production)
    this.registerShortcut('F12', 'toggle-dev-tools', () => {
      this.toggleDevTools();
    });

    this.registerShortcut('Ctrl+Shift+I', 'toggle-dev-tools', () => {
      this.toggleDevTools();
    });

    this.registerShortcut('Cmd+Option+I', 'toggle-dev-tools', () => {
      this.toggleDevTools();
    });

    // App reload shortcuts (development only)
    if (this.isDev) {
      this.registerShortcut('Ctrl+Shift+R', 'reload-electron-app', () => {
        this.mainWindow.reload();
      });

      this.registerShortcut('Cmd+Shift+R', 'reload-electron-app', () => {
        this.mainWindow.reload();
      });
    }

    // Tab switching shortcuts
    this.registerShortcut('Ctrl+Tab', 'next-tab', () => {
      this.sendToRenderer('next-tab');
    });

    this.registerShortcut('Cmd+Tab', 'next-tab', () => {
      this.sendToRenderer('next-tab');
    });

    this.registerShortcut('Ctrl+Shift+Tab', 'previous-tab', () => {
      this.sendToRenderer('previous-tab');
    });

    this.registerShortcut('Cmd+Shift+Tab', 'previous-tab', () => {
      this.sendToRenderer('previous-tab');
    });

    // Zoom shortcuts
    this.registerShortcut('Ctrl+Plus', 'zoom-in', () => {
      this.sendToRenderer('zoom-in');
    });

    this.registerShortcut('Cmd+Plus', 'zoom-in', () => {
      this.sendToRenderer('zoom-in');
    });

    this.registerShortcut('Ctrl+-', 'zoom-out', () => {
      this.sendToRenderer('zoom-out');
    });

    this.registerShortcut('Cmd+-', 'zoom-out', () => {
      this.sendToRenderer('zoom-out');
    });

    this.registerShortcut('Ctrl+0', 'zoom-reset', () => {
      this.sendToRenderer('zoom-reset');
    });

    this.registerShortcut('Cmd+0', 'zoom-reset', () => {
      this.sendToRenderer('zoom-reset');
    });

    // Window management
    this.registerShortcut('F11', 'toggle-fullscreen', () => {
      this.toggleFullscreen();
    });

    this.registerShortcut('Ctrl+M', 'minimize-window', () => {
      this.mainWindow.minimize();
    });

    this.registerShortcut('Cmd+M', 'minimize-window', () => {
      this.mainWindow.minimize();
    });

    console.log(`Registered ${this.shortcuts.size} shortcuts`);
  }

  // Register a shortcut
  registerShortcut(combination, id, callback) {
    this.shortcuts.set(combination.toLowerCase(), {
      id,
      callback,
      enabled: true
    });
  }

  // Unregister a shortcut
  unregisterShortcut(combination) {
    return this.shortcuts.delete(combination.toLowerCase());
  }

  // Setup event listeners
  setupEventListeners() {
    if (!this.mainWindow) return;

    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      if (!this.isEnabled) return;

      // Create shortcut combination string
      const combination = this.createShortcutCombination(input);
      if (!combination) return;

      // Check if this is one of our registered shortcuts
      const shortcut = this.shortcuts.get(combination);
      if (shortcut && shortcut.enabled) {
        event.preventDefault();
        
        try {
          shortcut.callback();
          console.log('Executed shortcut:', combination, '->', shortcut.id);
        } catch (error) {
          console.error('Error executing shortcut:', combination, error);
        }
      }
    });
  }

  // Create shortcut combination string from input event
  createShortcutCombination(input) {
    if (!input.key) return null;

    const parts = [];

    // Add modifiers in consistent order
    if (input.control || input.meta) {
      parts.push(process.platform === 'darwin' && input.meta ? 'Cmd' : 'Ctrl');
    }
    if (input.alt) parts.push('Alt');
    if (input.shift) parts.push('Shift');

    // Handle special keys
    let key = input.key;
    if (key === '+') key = 'Plus';
    if (key === '-') key = '-';
    if (key.length === 1) key = key.toUpperCase();

    // Handle function keys and special keys
    const specialKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
    const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    
    if (specialKeys.includes(key) || navigationKeys.includes(key)) {
      // Keep as is
    } else if (key === 'ArrowLeft') {
      key = 'Left';
    } else if (key === 'ArrowRight') {
      key = 'Right';
    } else if (key === 'Tab') {
      key = 'Tab';
    }

    parts.push(key);

    return parts.join('+').toLowerCase();
  }

  // Handle page reload with validation
  handlePageReload(force = false) {
    if (!this.browserManager) return;

    const currentViewId = this.browserManager.getCurrentViewId();
    if (!currentViewId || !this.browserManager.hasView(currentViewId)) {
      console.log('No active browser view to reload');
      return;
    }

    // Get the current URL to validate
    const view = this.browserManager.browserViews.get(currentViewId);
    if (!view) return;

    const url = view.webContents.getURL();
    
    console.log('Reload shortcut pressed - checking URL:', url);
    
    // Only reload if the view has a real website URL loaded
    if (url && 
        url !== 'about:blank' && 
        url !== '' && 
        !url.startsWith('data:') && 
        !url.startsWith('file://') &&
        (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('magnet:'))) {
      
      if (force) {
        view.webContents.reloadIgnoringCache();
        console.log('Hard reloading website:', url);
      } else {
        view.webContents.reload();
        console.log('Reloading website:', url);
      }
    } else {
      console.log('Reload shortcut pressed on empty/invalid content - ignoring (URL:', url, ')');
    }
  }

  // Toggle developer tools
  toggleDevTools() {
    if (!this.mainWindow) return;

    if (this.mainWindow.webContents.isDevToolsOpened()) {
      this.mainWindow.webContents.closeDevTools();
      console.log('Dev tools closed via shortcut');
    } else {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
      console.log('Dev tools opened via shortcut');
    }
  }

  // Toggle fullscreen
  toggleFullscreen() {
    if (!this.mainWindow) return;

    if (this.mainWindow.isFullScreen()) {
      this.mainWindow.setFullScreen(false);
      console.log('Exited fullscreen via shortcut');
    } else {
      this.mainWindow.setFullScreen(true);
      console.log('Entered fullscreen via shortcut');
    }
  }

  // Enable/disable shortcuts
  enable() {
    this.isEnabled = true;
    console.log('Shortcuts enabled');
  }

  disable() {
    this.isEnabled = false;
    console.log('Shortcuts disabled');
  }

  // Toggle shortcuts
  toggle() {
    this.isEnabled = !this.isEnabled;
    console.log('Shortcuts toggled:', this.isEnabled ? 'enabled' : 'disabled');
  }

  // Enable/disable specific shortcut
  enableShortcut(combination) {
    const shortcut = this.shortcuts.get(combination.toLowerCase());
    if (shortcut) {
      shortcut.enabled = true;
      console.log('Enabled shortcut:', combination);
      return true;
    }
    return false;
  }

  disableShortcut(combination) {
    const shortcut = this.shortcuts.get(combination.toLowerCase());
    if (shortcut) {
      shortcut.enabled = false;
      console.log('Disabled shortcut:', combination);
      return true;
    }
    return false;
  }

  // Get all registered shortcuts
  getAllShortcuts() {
    const shortcuts = {};
    for (const [combination, shortcut] of this.shortcuts) {
      shortcuts[combination] = {
        id: shortcut.id,
        enabled: shortcut.enabled
      };
    }
    return shortcuts;
  }

  // Get shortcuts by category
  getShortcutsByCategory() {
    const categories = {
      navigation: [],
      tabs: [],
      page: [],
      window: [],
      development: [],
      other: []
    };

    for (const [combination, shortcut] of this.shortcuts) {
      const category = this.categorizeShortcut(shortcut.id);
      categories[category].push({
        combination,
        id: shortcut.id,
        enabled: shortcut.enabled
      });
    }

    return categories;
  }

  // Categorize shortcut by ID
  categorizeShortcut(id) {
    if (id.includes('navigate') || id.includes('back') || id.includes('forward')) {
      return 'navigation';
    }
    if (id.includes('tab')) {
      return 'tabs';
    }
    if (id.includes('reload') || id.includes('zoom') || id.includes('page')) {
      return 'page';
    }
    if (id.includes('window') || id.includes('fullscreen') || id.includes('minimize')) {
      return 'window';
    }
    if (id.includes('dev') || id.includes('electron')) {
      return 'development';
    }
    return 'other';
  }

  // Export shortcuts configuration
  exportShortcuts() {
    const config = {};
    for (const [combination, shortcut] of this.shortcuts) {
      config[combination] = {
        id: shortcut.id,
        enabled: shortcut.enabled
      };
    }
    return config;
  }

  // Import shortcuts configuration
  importShortcuts(config) {
    for (const [combination, settings] of Object.entries(config)) {
      const shortcut = this.shortcuts.get(combination);
      if (shortcut) {
        shortcut.enabled = settings.enabled;
      }
    }
    console.log('Imported shortcuts configuration');
  }

  // Get shortcut statistics
  getStatistics() {
    const total = this.shortcuts.size;
    const enabled = Array.from(this.shortcuts.values()).filter(s => s.enabled).length;
    const categories = this.getShortcutsByCategory();
    
    return {
      total,
      enabled,
      disabled: total - enabled,
      categories: Object.keys(categories).reduce((acc, cat) => {
        acc[cat] = categories[cat].length;
        return acc;
      }, {}),
      isGloballyEnabled: this.isEnabled
    };
  }

  // Cleanup
  destroy() {
    this.shortcuts.clear();
    console.log('Shortcuts manager destroyed');
  }
}

// Export a singleton instance
export default new ShortcutsManager();