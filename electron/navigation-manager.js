class NavigationManager {
  constructor() {
    this.navigationHistory = new Map(); // Store navigation history for each view
    this.mainWindow = null;
    this.browserManager = null;
  }

  // Set reference to main window and browser manager
  setMainWindow(window) {
    this.mainWindow = window;
  }

  setBrowserManager(browserManager) {
    this.browserManager = browserManager;
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Handle navigation event and update history
  handleNavigation(viewId, url) {
    console.log('Navigation manager handling navigation:', viewId, url);
    
    // Update navigation history
    if (!this.navigationHistory.has(viewId)) {
      this.navigationHistory.set(viewId, { history: [], currentIndex: -1 });
    }
    
    const navHistory = this.navigationHistory.get(viewId);
    
    // Only add to history if this is a user-initiated navigation, not back/forward
    const isBackForwardNavigation = navHistory.history[navHistory.currentIndex] === url;
    
    if (!isBackForwardNavigation) {
      // If we're not at the end of history, remove forward entries
      if (navHistory.currentIndex < navHistory.history.length - 1) {
        navHistory.history = navHistory.history.slice(0, navHistory.currentIndex + 1);
      }
      
      // Add new entry
      navHistory.history.push(url);
      navHistory.currentIndex = navHistory.history.length - 1;
    }
    
    const canGoBack = navHistory.currentIndex > 0;
    const canGoForward = navHistory.currentIndex < navHistory.history.length - 1;
    
    console.log('Navigation state:', {
      viewId,
      currentIndex: navHistory.currentIndex,
      historyLength: navHistory.history.length,
      canGoBack,
      canGoForward,
      url
    });
    
    this.sendToRenderer('web-navigation', { 
      viewId, 
      event: 'navigate', 
      url,
      canGoBack,
      canGoForward
    });

    return { canGoBack, canGoForward };
  }

  // Go back in navigation history
  async goBack(viewId) {
    try {
      if (this.browserManager && this.browserManager.hasView(viewId) && this.navigationHistory.has(viewId)) {
        const navHistory = this.navigationHistory.get(viewId);
        if (navHistory.currentIndex > 0) {
          navHistory.currentIndex--;
          const url = navHistory.history[navHistory.currentIndex];
          
          await this.browserManager.navigateBrowserView(viewId, url);
          
          // Send updated navigation state
          this.sendToRenderer('web-navigation', { 
            viewId, 
            event: 'navigate', 
            url,
            canGoBack: navHistory.currentIndex > 0,
            canGoForward: navHistory.currentIndex < navHistory.history.length - 1
          });
          
          console.log('Navigated back to:', url, 'canGoForward:', navHistory.currentIndex < navHistory.history.length - 1);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error going back:', error);
      return false;
    }
  }

  // Go forward in navigation history
  async goForward(viewId) {
    try {
      if (this.browserManager && this.browserManager.hasView(viewId) && this.navigationHistory.has(viewId)) {
        const navHistory = this.navigationHistory.get(viewId);
        if (navHistory.currentIndex < navHistory.history.length - 1) {
          navHistory.currentIndex++;
          const url = navHistory.history[navHistory.currentIndex];
          
          await this.browserManager.navigateBrowserView(viewId, url);
          
          // Send updated navigation state
          this.sendToRenderer('web-navigation', { 
            viewId, 
            event: 'navigate', 
            url,
            canGoBack: navHistory.currentIndex > 0,
            canGoForward: navHistory.currentIndex < navHistory.history.length - 1
          });
          
          console.log('Navigated forward to:', url, 'canGoBack:', navHistory.currentIndex > 0);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error going forward:', error);
      return false;
    }
  }

  // Get navigation state for a view
  getNavigationState(viewId) {
    try {
      if (this.navigationHistory.has(viewId)) {
        const navHistory = this.navigationHistory.get(viewId);
        return {
          canGoBack: navHistory.currentIndex > 0,
          canGoForward: navHistory.currentIndex < navHistory.history.length - 1,
          currentUrl: navHistory.history[navHistory.currentIndex] || null,
          historyLength: navHistory.history.length,
          currentIndex: navHistory.currentIndex
        };
      }
      return { 
        canGoBack: false, 
        canGoForward: false, 
        currentUrl: null,
        historyLength: 0,
        currentIndex: -1
      };
    } catch (error) {
      console.error('Error getting navigation state:', error);
      return { canGoBack: false, canGoForward: false };
    }
  }

  // Get full navigation history for a view
  getNavigationHistory(viewId) {
    if (this.navigationHistory.has(viewId)) {
      return { ...this.navigationHistory.get(viewId) };
    }
    return { history: [], currentIndex: -1 };
  }

  // Clear navigation history for a view
  clearNavigationHistory(viewId) {
    if (this.navigationHistory.has(viewId)) {
      this.navigationHistory.delete(viewId);
      console.log('Cleared navigation history for view:', viewId);
    }
  }

  // Check if view can go back
  canGoBack(viewId) {
    const state = this.getNavigationState(viewId);
    return state.canGoBack;
  }

  // Check if view can go forward
  canGoForward(viewId) {
    const state = this.getNavigationState(viewId);
    return state.canGoForward;
  }

  // Get current URL for a view
  getCurrentUrl(viewId) {
    const state = this.getNavigationState(viewId);
    return state.currentUrl;
  }

  // Validate URL format
  isValidUrl(url) {
    try {
      // Basic URL validation
      if (!url || typeof url !== 'string') return false;
      
      // Allow common protocols
      const validProtocols = ['http:', 'https:', 'ftp:', 'file:', 'magnet:'];
      
      // Check for magnet links
      if (url.startsWith('magnet:')) return true;
      
      // Try to parse as URL
      const parsedUrl = new URL(url);
      return validProtocols.includes(parsedUrl.protocol);
    } catch (error) {
      // If URL parsing fails, try some basic checks
      return url.includes('.') && (
        url.startsWith('http://') || 
        url.startsWith('https://') || 
        url.startsWith('ftp://') ||
        url.startsWith('file://') ||
        url.startsWith('magnet:')
      );
    }
  }

  // Format URL for navigation (add protocol if missing)
  formatUrl(input) {
    if (!input || typeof input !== 'string') return null;
    
    input = input.trim();
    
    // Already has protocol
    if (input.includes('://') || input.startsWith('magnet:')) {
      return input;
    }
    
    // Looks like a domain/IP
    if (input.includes('.') && !input.includes(' ')) {
      return `https://${input}`;
    }
    
    // Search query
    return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  }

  // Handle navigation with URL formatting
  async navigateWithFormatting(viewId, input) {
    const formattedUrl = this.formatUrl(input);
    if (!formattedUrl) return false;
    
    if (this.browserManager && this.browserManager.hasView(viewId)) {
      return await this.browserManager.navigateBrowserView(viewId, formattedUrl);
    }
    return false;
  }

  // Cleanup navigation history for a closed view
  cleanupView(viewId) {
    this.clearNavigationHistory(viewId);
  }

  // Get statistics about navigation
  getNavigationStats() {
    const stats = {
      totalViews: this.navigationHistory.size,
      totalHistoryEntries: 0,
      averageHistoryLength: 0
    };

    let totalEntries = 0;
    for (const [viewId, navHistory] of this.navigationHistory) {
      totalEntries += navHistory.history.length;
    }

    stats.totalHistoryEntries = totalEntries;
    stats.averageHistoryLength = stats.totalViews > 0 ? 
      Math.round(totalEntries / stats.totalViews * 100) / 100 : 0;

    return stats;
  }

  // Export navigation history (for debugging or backup)
  exportNavigationData() {
    const exportData = {};
    for (const [viewId, navHistory] of this.navigationHistory) {
      exportData[viewId] = {
        history: [...navHistory.history],
        currentIndex: navHistory.currentIndex,
        timestamp: Date.now()
      };
    }
    return exportData;
  }

  // Cleanup - clear all navigation history
  destroy() {
    this.navigationHistory.clear();
    console.log('Navigation manager destroyed');
  }
}

// Export a singleton instance
export default new NavigationManager();