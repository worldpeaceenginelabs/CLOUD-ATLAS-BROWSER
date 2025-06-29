import { BrowserView } from 'electron';

class BrowserManager {
  constructor() {
    this.browserViews = new Map();
    this.currentViewId = null;
    this.mainWindow = null;
    this.tabBarHeight = 36;
    this.addressBarHeight = 48;
    this.browserViewYOffset = this.tabBarHeight + this.addressBarHeight;
    this.sidebarWidth = 0; // Track sidebar width
    this.sidebarOpen = false; // Track sidebar state
  }

  // Set reference to main window
  setMainWindow(window) {
    this.mainWindow = window;
  }

  // Update sidebar state
  updateSidebarState(open, width = 600) {
    this.sidebarOpen = open;
    this.sidebarWidth = open ? width : 0;
    this.updateBrowserViewBounds();
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Update browser view bounds
  updateBrowserViewBounds() {
    if (this.currentViewId && this.browserViews.has(this.currentViewId)) {
      const view = this.browserViews.get(this.currentViewId);
      const [width, height] = this.mainWindow.getContentSize();
      
      // Calculate available width (subtract sidebar width if open)
      const availableWidth = width - this.sidebarWidth;
      
      console.log('Updating browser view bounds:', {
        width: availableWidth,
        height,
        yOffset: this.browserViewYOffset,
        viewHeight: height - this.browserViewYOffset,
        sidebarWidth: this.sidebarWidth
      });
      
      view.setBounds({ 
        x: 0, 
        y: this.browserViewYOffset,
        width: availableWidth, 
        height: height - this.browserViewYOffset
      });
    }
  }

  // Create a new browser view
  async createBrowserView(url) {
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
      this.browserViews.set(viewId, view);

      // Set view bounds using proper content size
      const [width, height] = this.mainWindow.getContentSize();
      const availableWidth = width - this.sidebarWidth;
      view.setBounds({ 
        x: 0, 
        y: this.browserViewYOffset,
        width: availableWidth, 
        height: height - this.browserViewYOffset
      });

      view.setAutoResize({ 
        width: true, 
        height: true 
      });

      // Set up event handlers
      this.setupViewEventHandlers(view, viewId);

      // Load URL
      console.log('Loading URL in process-isolated browser view:', url);
      await view.webContents.loadURL(url);

      // Get initial process info
      try {
        const processId = view.webContents.getOSProcessId();
        console.log(`Browser view created with PID: ${processId} for viewId: ${viewId}`);
        this.sendToRenderer('tab-process-info', { 
          viewId, 
          processId, 
          type: 'created',
          message: `Tab created in process ${processId}`
        });
      } catch (error) {
        console.error('Error getting initial process info:', error);
      }

      // Get memory usage for this specific tab
      try {
        const processId = view.webContents.getOSProcessId();
        console.log(`Tab ${viewId} (PID: ${processId}) created successfully`);
        this.sendToRenderer('tab-process-info', { 
          viewId, 
          processId, 
          type: 'memory-update'
        });
      } catch (error) {
        console.error('Error getting process info for tab:', viewId, error);
      }

      console.log('Process-isolated browser view created successfully:', viewId, url);
      return viewId;

    } catch (error) {
      console.error('Error creating process-isolated browser view:', error);
      return null;
    }
  }

  // Set up event handlers for a browser view
  setupViewEventHandlers(view, viewId) {
    // Loading events
    view.webContents.on('did-start-loading', () => {
      console.log('Browser view started loading:', viewId);
      this.sendToRenderer('web-navigation', { viewId, event: 'loading-start' });
    });

    view.webContents.on('did-stop-loading', () => {
      console.log('Browser view stopped loading:', viewId);
      this.sendToRenderer('web-navigation', { viewId, event: 'loading-stop' });
    });

    view.webContents.on('did-finish-load', async () => {
      console.log('Browser view finished loading:', viewId);
      this.sendToRenderer('web-navigation', { viewId, event: 'loading-finish' });
      
      // Get the page title after a small delay to ensure it's fully loaded
      setTimeout(() => {
        const title = view.webContents.getTitle();
        if (title && title.trim() && title !== 'Loading...' && title !== '') {
          console.log('Page title after load delay:', viewId, title);
          this.sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
        }
      }, 500);
      
      // Get memory usage for this specific tab
      try {
        const processId = view.webContents.getOSProcessId();
        console.log(`Tab ${viewId} (PID: ${processId}) created successfully`);
        this.sendToRenderer('tab-process-info', { 
          viewId, 
          processId, 
          type: 'memory-update'
        });
      } catch (error) {
        console.error('Error getting process info for tab:', viewId, error);
      }
    });

    view.webContents.on('page-title-updated', (event, title) => {
      console.log('Browser view title updated:', viewId, title);
      if (title && title.trim() && title !== 'Loading...') {
        this.sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
      }
    });

    view.webContents.on('dom-ready', () => {
      console.log('DOM ready for view:', viewId);
      setTimeout(() => {
        const title = view.webContents.getTitle();
        if (title && title.trim() && title !== 'Loading...' && title !== '') {
          console.log('Title from DOM ready (delayed):', viewId, title);
          this.sendToRenderer('web-navigation', { viewId, event: 'title-updated', title });
        }
      }, 200);
    });

    view.webContents.on('page-favicon-updated', (event, favicons) => {
      console.log('Browser view favicon updated:', viewId, favicons);
      if (favicons && favicons.length > 0) {
        this.sendToRenderer('web-navigation', { viewId, event: 'favicon-updated', favicon: favicons[0] });
      }
    });

    view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Browser view failed to load:', viewId, errorCode, errorDescription, validatedURL);
      this.sendToRenderer('web-navigation', { viewId, event: 'load-failed', error: errorDescription });
    });

    // Security: limit what the page can do
    view.webContents.setWindowOpenHandler(({ url }) => {
      console.log('New window requested from view:', viewId, 'URL:', url);
      this.sendToRenderer('create-new-tab-with-url', url);
      return { action: 'deny' };
    });

    // Process monitoring
    view.webContents.on('crashed', (event, killed) => {
      console.error(`Tab ${viewId} crashed:`, { killed });
      this.sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'crashed', 
        killed,
        message: 'Tab crashed and needs to be reloaded'
      });
    });

    view.webContents.on('unresponsive', () => {
      console.warn(`Tab ${viewId} became unresponsive`);
      this.sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'unresponsive',
        message: 'Tab is not responding'
      });
    });

    view.webContents.on('responsive', () => {
      console.log(`Tab ${viewId} became responsive again`);
      this.sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'responsive',
        message: 'Tab is responding normally'
      });
    });

    view.webContents.on('render-process-gone', (event, details) => {
      console.error(`Tab ${viewId} renderer process gone:`, details);
      this.sendToRenderer('tab-process-info', { 
        viewId, 
        type: 'process-gone', 
        details,
        message: 'Tab process terminated unexpectedly'
      });
    });
  }

  // Set active browser view
  async setActiveBrowserView(viewId) {
    try {
      console.log('Setting active browser view:', viewId, 'current:', this.currentViewId);
      
      // Hide current view
      if (this.currentViewId && this.browserViews.has(this.currentViewId)) {
        const currentView = this.browserViews.get(this.currentViewId);
        this.mainWindow.removeBrowserView(currentView);
        console.log('Removed current view:', this.currentViewId);
      }

      // Show new view
      if (viewId && this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
        this.mainWindow.addBrowserView(view);
        
        // Update bounds using proper content size
        const [width, height] = this.mainWindow.getContentSize();
        const availableWidth = width - this.sidebarWidth;
        view.setBounds({ 
          x: 0, 
          y: this.browserViewYOffset,
          width: availableWidth, 
          height: height - this.browserViewYOffset
        });
        
        // Focus the view to ensure it's interactive
        view.webContents.focus();
        
        this.currentViewId = viewId;
        console.log('Set active browser view:', viewId);
        return true;
      } else if (viewId && !this.browserViews.has(viewId)) {
        console.warn('Requested view ID not found:', viewId, 'Available views:', Array.from(this.browserViews.keys()));
      }

      this.currentViewId = null;
      return false;
    } catch (error) {
      console.error('Error setting active browser view:', error);
      return false;
    }
  }

  // Close browser view
  async closeBrowserView(viewId) {
    try {
      if (this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
        
        if (this.currentViewId === viewId) {
          this.mainWindow.removeBrowserView(view);
          this.currentViewId = null;
        }
        
        view.webContents.destroy();
        this.browserViews.delete(viewId);
        
        console.log('Browser view closed:', viewId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error closing browser view:', error);
      return false;
    }
  }

  // Navigate browser view
  async navigateBrowserView(viewId, url) {
    try {
      if (this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
        await view.webContents.loadURL(url);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error navigating browser view:', error);
      return false;
    }
  }

  // Reload browser view
  async reloadBrowserView(viewId) {
    try {
      if (this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
        const url = view.webContents.getURL();
        
        // Only reload if there's a valid URL
        if (url && url !== 'about:blank' && !url.startsWith('data:')) {
          view.webContents.reload();
          console.log('Reloaded browser view:', viewId, url);
          return true;
        } else {
          console.log('Cannot reload browser view - no valid URL:', viewId, url);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error reloading browser view:', error);
      return false;
    }
  }

  // Get tab process info
  async getTabProcessInfo(viewId) {
    try {
      if (this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
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
  }

  // Terminate tab process
  async terminateTabProcess(viewId) {
    try {
      if (this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
        view.webContents.forcefullyCrashRenderer();
        console.log('Terminated process for tab:', viewId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error terminating tab process:', error);
      return false;
    }
  }

  // Reload crashed tab
  async reloadCrashedTab(viewId, url) {
    try {
      if (this.browserViews.has(viewId)) {
        const view = this.browserViews.get(viewId);
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
  }

  // Get all processes info
  async getAllProcessesInfo() {
    try {
      const processesInfo = [];
      
      for (const [viewId, view] of this.browserViews) {
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
  }

  // Get current view ID
  getCurrentViewId() {
    return this.currentViewId;
  }

  // Check if view exists
  hasView(viewId) {
    return this.browserViews.has(viewId);
  }

  // Get all view IDs
  getAllViewIds() {
    return Array.from(this.browserViews.keys());
  }

  // Cleanup - destroy all views
  destroy() {
    for (const [viewId, view] of this.browserViews) {
      try {
        view.webContents.destroy();
      } catch (error) {
        console.error('Error destroying view:', viewId, error);
      }
    }
    this.browserViews.clear();
    this.currentViewId = null;
    console.log('Browser manager destroyed');
  }
}

// Export a singleton instance
export default new BrowserManager();