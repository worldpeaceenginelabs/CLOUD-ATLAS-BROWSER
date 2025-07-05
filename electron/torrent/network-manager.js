class NetworkManager {
  constructor(coreManager) {
    this.coreManager = coreManager;
    this.networkErrorCount = 0;
    this.lastNetworkError = 0;
  }

  // Handle network changes (VPN, connection loss, etc.)
  handleNetworkChange() {
    const now = Date.now();
    this.networkErrorCount++;
    this.lastNetworkError = now;
    
    console.log(`Network change detected (error #${this.networkErrorCount})`);
    
    // If we have multiple network errors in a short time, attempt recovery
    if (this.networkErrorCount >= 3) {
      console.log('Multiple network errors detected - attempting recovery...');
      this.attemptNetworkRecovery();
      this.networkErrorCount = 0; // Reset counter
    }
    
    // Reset error count after 30 seconds of no errors
    setTimeout(() => {
      if (now === this.lastNetworkError) {
        this.networkErrorCount = 0;
        console.log('Network error count reset - connection appears stable');
      }
    }, 30000);
  }
  
  // Attempt to recover from network issues
  attemptNetworkRecovery() {
    try {
      console.log('Attempting network recovery...');
      
      // Re-announce to trackers to refresh connections
      if (this.coreManager.client && this.coreManager.client.torrents.length > 0) {
        this.coreManager.client.torrents.forEach(torrent => {
          try {
            if (torrent.announce) {
              torrent.announce();
              console.log(`Re-announced torrent: ${torrent.name}`);
            }
          } catch (err) {
            console.warn(`Failed to re-announce torrent ${torrent.name}:`, err.message);
          }
        });
      }
      
      this.coreManager.sendToRenderer('torrent-warning', 'Network recovery attempted. Torrent connections should resume shortly.');
      
    } catch (error) {
      console.error('Network recovery failed:', error);
      this.coreManager.sendToRenderer('torrent-warning', 'Network recovery failed. You may need to restart the application.');
    }
  }

  // Check if error is network-related
  isNetworkError(error) {
    return error.code === 'ERR_ICE_CONNECTION_CLOSED' || 
           error.message.includes('ICE connection') ||
           error.message.includes('WebRTC') ||
           error.message.includes('peer connection') ||
           error.code === 'ENOTFOUND' || 
           error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' ||
           error.message.includes('tracker') ||
           error.message.includes('announce');
  }

  // Check if error is WebRTC/ICE related
  isWebRTCError(error) {
    return error.code === 'ERR_ICE_CONNECTION_CLOSED' || 
           error.message.includes('ICE connection') ||
           error.message.includes('WebRTC') ||
           error.message.includes('peer connection');
  }

  // Check if error is tracker/announce related
  isTrackerError(error) {
    return error.code === 'ENOTFOUND' || 
           error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' ||
           error.message.includes('tracker') ||
           error.message.includes('announce');
  }

  // Handle torrent-specific network errors
  handleTorrentNetworkError(torrent, error) {
    if (this.isWebRTCError(error)) {
      console.warn(`WebRTC error for torrent ${torrent.name} - network change detected`);
      this.coreManager.sendToRenderer('torrent-warning', `Network change detected for ${torrent.name}. Connections may be temporarily affected.`);
      return true; // Error handled
    }
    
    if (this.isTrackerError(error)) {
      console.warn(`Non-fatal error for torrent ${torrent.name}:`, error.message);
      this.coreManager.sendToRenderer('torrent-warning', `Network issue with ${torrent.name}: ${error.message}`);
      return true; // Error handled
    }
    
    return false; // Error not handled, should be treated as fatal
  }

  // Reset network error tracking
  resetErrorTracking() {
    this.networkErrorCount = 0;
    this.lastNetworkError = 0;
  }
}

export default NetworkManager; 