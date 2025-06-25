import { app, shell } from 'electron';

class SecurityManager {
  constructor() {
    this.mainWindow = null;
    this.browserManager = null;
    this.isDev = false;
    this.allowedPermissions = ['media', 'notifications', 'geolocation'];
    this.blockedHosts = new Set();
    this.trustedHosts = new Set();
    this.securityPolicies = {
      allowRunningInsecureContent: false,
      allowExternalNavigation: true,
      allowNewWindows: false,
      enableWebSecurity: true,
      enableContextIsolation: true,
      enableNodeIntegration: false
    };
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
    
    // Relax some restrictions in development
    if (isDev) {
      this.trustedHosts.add('localhost');
      this.trustedHosts.add('127.0.0.1');
    }
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Initialize security policies
  initialize() {
    this.setupAppEventHandlers();
    this.setupContentSecurityHandlers();
    console.log('Security manager initialized');
  }

  // Setup app-level security event handlers
  setupAppEventHandlers() {
    // Handle certificate errors
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      console.log('Certificate error for URL:', url, 'Error:', error);
      
      // Allow localhost in development
      if (this.isDev && (url.includes('localhost') || url.includes('127.0.0.1'))) {
        event.preventDefault();
        callback(true);
        console.log('Certificate error ignored for development:', url);
        return;
      }

      // Check if host is trusted
      const urlObj = new URL(url);
      if (this.trustedHosts.has(urlObj.hostname)) {
        event.preventDefault();
        callback(true);
        console.log('Certificate error ignored for trusted host:', urlObj.hostname);
        return;
      }

      // Reject by default
      callback(false);
      console.log('Certificate rejected for:', url);
    });

    // Handle web contents creation
    app.on('web-contents-created', (event, contents) => {
      console.log('Web contents created, setting up security handlers');
      
      // Handle permission requests
      contents.on('permission-request', (event, permission, callback) => {
        console.log('Permission requested:', permission);
        
        if (this.allowedPermissions.includes(permission)) {
          callback(true);
          console.log('Permission granted:', permission);
        } else {
          console.log('Permission denied:', permission);
          callback(false);
        }
      });

      // Handle new window requests
      contents.on('new-window', (event, navigationUrl, frameName, disposition, options) => {
        console.log('New window requested:', navigationUrl);
        
        // Always prevent new windows and handle them appropriately
        event.preventDefault();
        
        const urlObj = new URL(navigationUrl);
        
        // Check if URL should be blocked
        if (this.isHostBlocked(urlObj.hostname)) {
          console.log('Blocked new window to:', navigationUrl);
          return;
        }
        
        // Check if this is from a browser view
        const isBrowserView = this.browserManager && 
          Array.from(this.browserManager.browserViews.values()).some(view => 
            view.webContents === contents
          );
        
        if (isBrowserView && this.securityPolicies.allowNewWindows) {
          // Send to renderer to create new tab
          this.sendToRenderer('create-new-tab-with-url', navigationUrl);
        } else {
          // Open externally for safety
          shell.openExternal(navigationUrl);
        }
      });

      // Handle navigation attempts
      contents.on('will-navigate', (event, navigationUrl) => {
        console.log('Navigation attempt to:', navigationUrl);
        
        // Allow same-origin navigation
        const currentUrl = contents.getURL();
        if (currentUrl && this.isSameOrigin(currentUrl, navigationUrl)) {
          return; // Allow
        }
        
        // Check for blocked hosts
        try {
          const urlObj = new URL(navigationUrl);
          if (this.isHostBlocked(urlObj.hostname)) {
            event.preventDefault();
            console.log('Blocked navigation to:', navigationUrl);
            return;
          }
        } catch (error) {
          // Invalid URL, block it
          event.preventDefault();
          console.log('Blocked invalid URL:', navigationUrl);
          return;
        }
        
        // Allow navigation to external sites only if policy allows
        if (!this.securityPolicies.allowExternalNavigation) {
          event.preventDefault();
          shell.openExternal(navigationUrl);
          console.log('External navigation blocked, opened externally:', navigationUrl);
        }
      });

      // Handle before input events for security
      contents.on('before-input-event', (event, input) => {
        // Block certain dangerous key combinations
        if (this.isDangerousKeyCombo(input)) {
          event.preventDefault();
          console.log('Blocked dangerous key combination');
        }
      });
    });
  }

  // Setup content security handlers
  setupContentSecurityHandlers() {
    // Additional content security setup can be added here
    console.log('Content security handlers set up');
  }

  // Check if host is blocked
  isHostBlocked(hostname) {
    return this.blockedHosts.has(hostname.toLowerCase());
  }

  // Check if host is trusted
  isHostTrusted(hostname) {
    return this.trustedHosts.has(hostname.toLowerCase());
  }

  // Block a host
  blockHost(hostname) {
    this.blockedHosts.add(hostname.toLowerCase());
    console.log('Host blocked:', hostname);
  }

  // Unblock a host
  unblockHost(hostname) {
    const removed = this.blockedHosts.delete(hostname.toLowerCase());
    if (removed) {
      console.log('Host unblocked:', hostname);
    }
    return removed;
  }

  // Trust a host
  trustHost(hostname) {
    this.trustedHosts.add(hostname.toLowerCase());
    console.log('Host trusted:', hostname);
  }

  // Untrust a host
  untrustHost(hostname) {
    const removed = this.trustedHosts.delete(hostname.toLowerCase());
    if (removed) {
      console.log('Host untrusted:', hostname);
    }
    return removed;
  }

  // Check if two URLs are same origin
  isSameOrigin(url1, url2) {
    try {
      const urlObj1 = new URL(url1);
      const urlObj2 = new URL(url2);
      
      return urlObj1.protocol === urlObj2.protocol &&
             urlObj1.hostname === urlObj2.hostname &&
             urlObj1.port === urlObj2.port;
    } catch {
      return false;
    }
  }

  // Check if URL is safe
  isUrlSafe(url) {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      const safeProtocols = ['https:', 'http:', 'ftp:', 'magnet:'];
      if (!safeProtocols.includes(urlObj.protocol)) {
        return false;
      }
      
      // Check if host is blocked
      if (this.isHostBlocked(urlObj.hostname)) {
        return false;
      }
      
      // Check for suspicious patterns
      if (this.hasSuspiciousPatterns(url)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // Check for suspicious URL patterns
  hasSuspiciousPatterns(url) {
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /file:/i,
      /\.\./,  // Path traversal
      /<script/i,
      /eval\(/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  // Check if key combination is dangerous
  isDangerousKeyCombo(input) {
    // Block certain potentially dangerous combinations
    const dangerousCombos = [
      // Block Ctrl+Shift+J (dev tools) in production
      () => !this.isDev && input.control && input.shift && input.key.toLowerCase() === 'j',
      // Block F12 in production
      () => !this.isDev && input.key === 'F12',
      // Block Ctrl+U (view source) in production
      () => !this.isDev && input.control && input.key.toLowerCase() === 'u'
    ];
    
    return dangerousCombos.some(check => check());
  }

  // Sanitize URL
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    try {
      // Remove dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
      const lowerUrl = url.toLowerCase();
      
      for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
          return null;
        }
      }
      
      // Basic URL validation and normalization
      const urlObj = new URL(url);
      return urlObj.href;
    } catch {
      // If URL parsing fails, try to make it a search query
      if (!url.includes('://') && !url.includes(' ')) {
        return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
      return null;
    }
  }

  // Get security configuration for browser views
  getBrowserViewSecurityConfig() {
    return {
      nodeIntegration: this.securityPolicies.enableNodeIntegration,
      contextIsolation: this.securityPolicies.enableContextIsolation,
      webSecurity: this.securityPolicies.enableWebSecurity,
      allowRunningInsecureContent: this.securityPolicies.allowRunningInsecureContent,
      sandbox: true,
      processIsolation: true,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'Auxclick',
      backgroundThrottling: true
    };
  }

  // Update security policy
  updateSecurityPolicy(policy, value) {
    if (this.securityPolicies.hasOwnProperty(policy)) {
      this.securityPolicies[policy] = value;
      console.log('Security policy updated:', policy, '=', value);
      return true;
    }
    return false;
  }

  // Get security statistics
  getSecurityStats() {
    return {
      blockedHosts: Array.from(this.blockedHosts),
      trustedHosts: Array.from(this.trustedHosts),
      allowedPermissions: [...this.allowedPermissions],
      securityPolicies: { ...this.securityPolicies },
      isDevelopmentMode: this.isDev
    };
  }

  // Export security configuration
  exportSecurityConfig() {
    return {
      blockedHosts: Array.from(this.blockedHosts),
      trustedHosts: Array.from(this.trustedHosts),
      allowedPermissions: [...this.allowedPermissions],
      securityPolicies: { ...this.securityPolicies }
    };
  }

  // Import security configuration
  importSecurityConfig(config) {
    if (config.blockedHosts) {
      this.blockedHosts = new Set(config.blockedHosts);
    }
    if (config.trustedHosts) {
      this.trustedHosts = new Set(config.trustedHosts);
    }
    if (config.allowedPermissions) {
      this.allowedPermissions = [...config.allowedPermissions];
    }
    if (config.securityPolicies) {
      this.securityPolicies = { ...this.securityPolicies, ...config.securityPolicies };
    }
    console.log('Security configuration imported');
  }

  // Reset security settings to defaults
  resetToDefaults() {
    this.blockedHosts.clear();
    this.trustedHosts.clear();
    
    if (this.isDev) {
      this.trustedHosts.add('localhost');
      this.trustedHosts.add('127.0.0.1');
    }
    
    this.allowedPermissions = ['media', 'notifications', 'geolocation'];
    this.securityPolicies = {
      allowRunningInsecureContent: false,
      allowExternalNavigation: true,
      allowNewWindows: false,
      enableWebSecurity: true,
      enableContextIsolation: true,
      enableNodeIntegration: false
    };
    
    console.log('Security settings reset to defaults');
  }

  // Cleanup
  destroy() {
    this.blockedHosts.clear();
    this.trustedHosts.clear();
    console.log('Security manager destroyed');
  }
}

// Export a singleton instance
export default new SecurityManager();