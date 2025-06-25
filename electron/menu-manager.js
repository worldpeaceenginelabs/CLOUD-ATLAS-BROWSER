import { Menu, app } from 'electron';

class MenuManager {
  constructor() {
    this.mainWindow = null;
    this.isDev = false;
  }

  // Set references
  setMainWindow(window) {
    this.mainWindow = window;
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

  // Create development menu template
  createDevelopmentMenuTemplate() {
    return [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Tab',
            accelerator: process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T',
            click: () => {
              this.sendToRenderer('new-tab');
            }
          },
          {
            label: 'Close Tab',
            accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W',
            click: () => {
              this.sendToRenderer('close-current-tab');
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle Developer Tools',
            accelerator: 'F12',
            click: () => {
              if (this.mainWindow.webContents.isDevToolsOpened()) {
                this.mainWindow.webContents.closeDevTools();
              } else {
                this.mainWindow.webContents.openDevTools({ mode: 'detach' });
              }
            }
          },
          {
            label: 'Focus Address Bar',
            accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L',
            click: () => {
              this.sendToRenderer('focus-address-bar');
            }
          },
          { type: 'separator' },
          {
            label: 'Reload Page',
            accelerator: 'F5',
            click: () => {
              this.sendToRenderer('reload-current-page');
            }
          },
          {
            label: 'Force Reload Page',
            accelerator: 'CmdOrCtrl+F5',
            click: () => {
              this.sendToRenderer('force-reload-current-page');
            }
          },
          { type: 'separator' },
          {
            label: 'Reload Electron App',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: () => {
              this.mainWindow.reload();
            }
          }
        ]
      },
      {
        label: 'Navigation',
        submenu: [
          {
            label: 'Back',
            accelerator: process.platform === 'darwin' ? 'Cmd+Left' : 'Alt+Left',
            click: () => {
              this.sendToRenderer('navigate-back');
            }
          },
          {
            label: 'Forward',
            accelerator: process.platform === 'darwin' ? 'Cmd+Right' : 'Alt+Right',
            click: () => {
              this.sendToRenderer('navigate-forward');
            }
          },
          { type: 'separator' },
          {
            label: 'Home',
            accelerator: process.platform === 'darwin' ? 'Cmd+Home' : 'Alt+Home',
            click: () => {
              this.sendToRenderer('navigate-home');
            }
          }
        ]
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Downloads',
            accelerator: process.platform === 'darwin' ? 'Cmd+Shift+J' : 'Ctrl+Shift+J',
            click: () => {
              this.sendToRenderer('show-downloads');
            }
          },
          {
            label: 'Torrent Manager',
            accelerator: process.platform === 'darwin' ? 'Cmd+Shift+T' : 'Ctrl+Shift+T',
            click: () => {
              this.sendToRenderer('show-torrent-manager');
            }
          },
          { type: 'separator' },
          {
            label: 'Process Monitor',
            accelerator: 'F11',
            click: () => {
              this.sendToRenderer('show-process-monitor');
            }
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          {
            label: 'Minimize',
            accelerator: process.platform === 'darwin' ? 'Cmd+M' : 'Ctrl+M',
            click: () => {
              this.mainWindow.minimize();
            }
          },
          {
            label: 'Toggle Fullscreen',
            accelerator: process.platform === 'darwin' ? 'Cmd+F' : 'F11',
            click: () => {
              if (this.mainWindow.isFullScreen()) {
                this.mainWindow.setFullScreen(false);
              } else {
                this.mainWindow.setFullScreen(true);
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Zoom In',
            accelerator: process.platform === 'darwin' ? 'Cmd+Plus' : 'Ctrl+Plus',
            click: () => {
              this.sendToRenderer('zoom-in');
            }
          },
          {
            label: 'Zoom Out',
            accelerator: process.platform === 'darwin' ? 'Cmd+-' : 'Ctrl+-',
            click: () => {
              this.sendToRenderer('zoom-out');
            }
          },
          {
            label: 'Reset Zoom',
            accelerator: process.platform === 'darwin' ? 'Cmd+0' : 'Ctrl+0',
            click: () => {
              this.sendToRenderer('zoom-reset');
            }
          }
        ]
      }
    ];
  }

  // Create production menu template (minimal)
  createProductionMenuTemplate() {
    return [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Tab',
            accelerator: process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T',
            click: () => {
              this.sendToRenderer('new-tab');
            }
          },
          {
            label: 'Close Tab',
            accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W',
            click: () => {
              this.sendToRenderer('close-current-tab');
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Focus Address Bar',
            accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L',
            click: () => {
              this.sendToRenderer('focus-address-bar');
            }
          },
          {
            label: 'Reload Page',
            accelerator: 'F5',
            click: () => {
              this.sendToRenderer('reload-current-page');
            }
          },
          { type: 'separator' },
          {
            label: 'Toggle Fullscreen',
            accelerator: 'F11',
            click: () => {
              if (this.mainWindow.isFullScreen()) {
                this.mainWindow.setFullScreen(false);
              } else {
                this.mainWindow.setFullScreen(true);
              }
            }
          }
        ]
      },
      {
        label: 'Navigation',
        submenu: [
          {
            label: 'Back',
            accelerator: process.platform === 'darwin' ? 'Cmd+Left' : 'Alt+Left',
            click: () => {
              this.sendToRenderer('navigate-back');
            }
          },
          {
            label: 'Forward',
            accelerator: process.platform === 'darwin' ? 'Cmd+Right' : 'Alt+Right',
            click: () => {
              this.sendToRenderer('navigate-forward');
            }
          }
        ]
      }
    ];
  }

  // Create macOS specific menu template
  createMacOSMenuTemplate(baseTemplate) {
    if (process.platform !== 'darwin') return baseTemplate;

    // Add app menu for macOS
    const appMenu = {
      label: app.getName(),
      submenu: [
        {
          label: 'About ' + app.getName(),
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide ' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    };

    // Modify Window menu for macOS
    const windowMenuIndex = baseTemplate.findIndex(menu => menu.label === 'Window');
    if (windowMenuIndex !== -1) {
      baseTemplate[windowMenuIndex].submenu.push(
        { type: 'separator' },
        {
          label: 'Bring All to Front',
          role: 'front'
        }
      );
    }

    return [appMenu, ...baseTemplate];
  }

  // Setup application menu
  setupMenu() {
    let template;

    if (this.isDev) {
      template = this.createDevelopmentMenuTemplate();
      console.log('Setting up development menu');
    } else {
      template = this.createProductionMenuTemplate();
      console.log('Setting up production menu');
    }

    // Apply macOS specific modifications
    template = this.createMacOSMenuTemplate(template);

    // Build and set the menu
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    console.log('Application menu set up successfully');
  }

  // Hide menu bar (for production builds)
  hideMenuBar() {
    if (this.mainWindow) {
      this.mainWindow.setMenuBarVisibility(false);
      console.log('Menu bar hidden');
    }
  }

  // Show menu bar
  showMenuBar() {
    if (this.mainWindow) {
      this.mainWindow.setMenuBarVisibility(true);
      console.log('Menu bar shown');
    }
  }

  // Toggle menu bar visibility
  toggleMenuBar() {
    if (this.mainWindow) {
      const isVisible = this.mainWindow.isMenuBarVisible();
      this.mainWindow.setMenuBarVisibility(!isVisible);
      console.log('Menu bar toggled:', !isVisible ? 'shown' : 'hidden');
    }
  }

  // Create context menu for browser views
  createContextMenu() {
    return Menu.buildFromTemplate([
      {
        label: 'Back',
        click: () => {
          this.sendToRenderer('navigate-back');
        }
      },
      {
        label: 'Forward',
        click: () => {
          this.sendToRenderer('navigate-forward');
        }
      },
      {
        label: 'Reload',
        click: () => {
          this.sendToRenderer('reload-current-page');
        }
      },
      { type: 'separator' },
      {
        label: 'New Tab',
        click: () => {
          this.sendToRenderer('new-tab');
        }
      },
      {
        label: 'Close Tab',
        click: () => {
          this.sendToRenderer('close-current-tab');
        }
      },
      { type: 'separator' },
      {
        label: 'Copy URL',
        click: () => {
          this.sendToRenderer('copy-current-url');
        }
      }
    ]);
  }

  // Handle menu item updates based on app state
  updateMenuState(state) {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    // Update navigation menu items based on current tab state
    this.updateNavigationMenuItems(menu, state);
    
    // Update view menu items
    this.updateViewMenuItems(menu, state);
  }

  // Update navigation menu items
  updateNavigationMenuItems(menu, state) {
    const navigationMenu = this.findMenuItem(menu, 'Navigation');
    if (!navigationMenu) return;

    const backItem = this.findMenuItem(navigationMenu, 'Back');
    const forwardItem = this.findMenuItem(navigationMenu, 'Forward');

    if (backItem) {
      backItem.enabled = state.canGoBack || false;
    }

    if (forwardItem) {
      forwardItem.enabled = state.canGoForward || false;
    }
  }

  // Update view menu items
  updateViewMenuItems(menu, state) {
    const viewMenu = this.findMenuItem(menu, 'View');
    if (!viewMenu) return;

    const reloadItem = this.findMenuItem(viewMenu, 'Reload Page');
    if (reloadItem) {
      reloadItem.enabled = state.hasActiveTab || false;
    }
  }

  // Helper to find menu item by label
  findMenuItem(menu, label) {
    if (!menu || !menu.submenu) return null;

    for (const item of menu.submenu.items) {
      if (item.label === label) {
        return item;
      }
      
      // Search in submenus
      if (item.submenu) {
        const found = this.findMenuItem(item, label);
        if (found) return found;
      }
    }

    return null;
  }

  // Get current menu template for debugging
  getCurrentMenuTemplate() {
    return this.isDev ? 
      this.createDevelopmentMenuTemplate() : 
      this.createProductionMenuTemplate();
  }

  // Cleanup
  destroy() {
    // Menu cleanup is handled automatically by Electron
    console.log('Menu manager destroyed');
  }
}

// Export a singleton instance
export default new MenuManager();