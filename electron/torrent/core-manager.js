import WebTorrent from 'webtorrent';
import path from 'path';
import os from 'os';

class CoreTorrentManager {
  constructor() {
    this.client = null;
    this.mainWindow = null;
  }

  // Initialize WebTorrent client
  initialize() {
    this.client = new WebTorrent({
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

    // Enhanced error handling for WebRTC/ICE connection issues
    this.client.on('error', (err) => {
      console.error('WebTorrent error:', err);
      
      // Handle specific WebRTC/ICE connection errors
      if (err.code === 'ERR_ICE_CONNECTION_CLOSED' || 
          err.message.includes('ICE connection') ||
          err.message.includes('WebRTC') ||
          err.message.includes('peer connection')) {
        console.warn('WebRTC/ICE connection error detected - this is likely due to network changes (VPN, etc.)');
        this.sendToRenderer('torrent-warning', 'Network connection changed. Torrent connections may be temporarily affected.');
        return; // Don't treat this as a fatal error
      }
      
      // Handle other non-fatal errors
      if (err.code === 'ENOTFOUND' || 
          err.code === 'ECONNREFUSED' ||
          err.code === 'ETIMEDOUT' ||
          err.message.includes('tracker') ||
          err.message.includes('announce')) {
        console.warn('Network/tracker error (non-fatal):', err.message);
        this.sendToRenderer('torrent-warning', `Network issue: ${err.message}`);
        return; // Don't treat tracker/network errors as fatal
      }
      
      // Send error to renderer for other cases
      this.sendToRenderer('torrent-error', err.message);
    });

    this.client.on('warning', (err) => {
      console.warn('WebTorrent warning:', err);
      
      // Filter out common warnings that shouldn't be shown to user
      if (err.message.includes('ICE connection') ||
          err.message.includes('WebRTC') ||
          err.message.includes('peer connection') ||
          err.message.includes('tracker') ||
          err.message.includes('announce')) {
        console.log('Suppressed warning (network-related):', err.message);
        return;
      }
      
      this.sendToRenderer('torrent-warning', err.message);
    });

    // Add connection state monitoring
    this.client.on('listening', () => {
      console.log('WebTorrent client listening on port:', this.client.torrentPort);
    });

    console.log('WebTorrent client initialized in main process');
  }

  // Set reference to main window for communication
  setMainWindow(window) {
    this.mainWindow = window;
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Add torrent from magnet URI
  async addTorrent(magnetUri, callbacks) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Adding torrent:', magnetUri);
        
        const torrent = this.client.add(magnetUri, {
          path: path.join(os.homedir(), 'Downloads')
        });

        torrent.on('ready', () => {
          console.log('Torrent ready:', torrent.name);
          
          // Website detection logic
          let torrentType = null;
          let websiteType = null;
          const files = torrent.files.map(file => ({
            name: file.name,
            length: file.length,
            path: file.path
          }));
          
          // Find all index.html files
          const indexFiles = files.filter(f => f.name.endsWith('index.html'));
          if (indexFiles.length > 0) {
            torrentType = 'website';
            // Check for package.json in the same directory as each index.html
            websiteType = 'static';
            for (const idxFile of indexFiles) {
              const dir = idxFile.path.replace(/\/index\.html$/, '').replace(/\\/g, '/');
              const hasPackage = files.some(f => f.name === 'package.json' && f.path.replace(/\/package\.json$/, '').replace(/\\/g, '/') === dir);
              if (hasPackage) {
                websiteType = 'repository';
                break;
              }
            }
          } else {
            torrentType = 'downloading';
            websiteType = null;
          }
          
          const torrentInfo = {
            magnetUri,
            name: torrent.name,
            files,
            progress: 0,
            downloadSpeed: 0,
            uploadSpeed: 0,
            peers: 0,
            torrentType,
            websiteType
          };
          
          if (callbacks.onReady) {
            callbacks.onReady(torrent, torrentInfo);
          }
          
          resolve(torrentInfo);
        });

        torrent.on('download', () => {
          if (callbacks.onDownload) {
            callbacks.onDownload(torrent, magnetUri);
          }
        });

        torrent.on('done', () => {
          console.log('Torrent download completed:', torrent.name);
          this.sendToRenderer('torrent-completed', { magnetUri, name: torrent.name });
          
          if (callbacks.onDone) {
            callbacks.onDone(torrent, magnetUri);
          }
        });

        torrent.on('error', (err) => {
          console.error('Torrent error:', err);
          
          // Handle WebRTC/ICE connection errors gracefully
          if (err.code === 'ERR_ICE_CONNECTION_CLOSED' || 
              err.message.includes('ICE connection') ||
              err.message.includes('WebRTC') ||
              err.message.includes('peer connection')) {
            console.warn(`WebRTC error for torrent ${torrent.name} - network change detected`);
            this.sendToRenderer('torrent-warning', `Network change detected for ${torrent.name}. Connections may be temporarily affected.`);
            return;
          }
          
          // Handle other non-fatal torrent errors
          if (err.code === 'ENOTFOUND' || 
              err.code === 'ECONNREFUSED' ||
              err.code === 'ETIMEDOUT' ||
              err.message.includes('tracker') ||
              err.message.includes('announce')) {
            console.warn(`Non-fatal error for torrent ${torrent.name}:`, err.message);
            this.sendToRenderer('torrent-warning', `Network issue with ${torrent.name}: ${err.message}`);
            return;
          }
          
          // Only reject for truly fatal errors
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
  }

  // Seed a file
  async seedFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Seeding file:', filePath);
        
        const torrent = this.client.seed(filePath, {
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
  }

  // Get torrent by magnet URI
  getTorrent(magnetUri) {
    return this.client.get(magnetUri);
  }

  // Remove torrent from client
  async removeTorrent(magnetUri, options = {}) {
    return new Promise((resolve) => {
      this.client.remove(magnetUri, options, (err) => {
        if (!err) {
          console.log('Torrent removed from client:', magnetUri);
          resolve(true);
        } else {
          console.error('Remove error:', err);
          resolve(false);
        }
      });
    });
  }

  // Get torrent statistics
  getStats() {
    return {
      activeTorrents: this.client.torrents.length,
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      progress: this.client.progress
    };
  }

  // Destroy the torrent client
  destroy() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      console.log('WebTorrent client destroyed');
    }
  }
}

export default CoreTorrentManager; 