import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { dialog } from 'electron';

class TorrentManager {
  constructor() {
    this.client = null;
    this.mainWindow = null;
    this.pausedTorrents = new Map(); // Store paused torrent info
    this.activeTorrentPaths = new Map(); // Store active torrent paths from download events
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

    this.client.on('error', (err) => {
      console.error('WebTorrent error:', err);
      this.sendToRenderer('torrent-error', err.message);
    });

    this.client.on('warning', (err) => {
      console.warn('WebTorrent warning:', err);
      this.sendToRenderer('torrent-warning', err.message);
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
  async addTorrent(magnetUri) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Adding torrent:', magnetUri);
        
        // Check if this is a resume operation
        const isResume = this.pausedTorrents.has(magnetUri);
        if (isResume) {
          console.log('Resuming paused torrent:', magnetUri);
          // Remove from paused tracking since it's becoming active again
          this.pausedTorrents.delete(magnetUri);
        }
        
        const torrent = this.client.add(magnetUri, {
          path: path.join(os.homedir(), 'Downloads')
        });

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
          // CAPTURE PATH INFO during download event (when it's reliable)
          if (torrent.name && torrent.path) {
            this.activeTorrentPaths.set(magnetUri, {
              name: torrent.name,
              path: torrent.path,
              downloadPath: path.join(torrent.path, torrent.name)
            });
          }
          
          const progressData = {
            magnetUri,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            downloaded: torrent.downloaded,
            uploaded: torrent.uploaded,
            // SEND THE RELIABLE PATH to the renderer!
            actualDownloadPath: torrent.name && torrent.path ? 
              path.join(torrent.path, torrent.name) : null
          };
          
          this.sendToRenderer('torrent-progress', progressData);
        });

        torrent.on('done', () => {
          console.log('Torrent download completed:', torrent.name);
          this.sendToRenderer('torrent-completed', { magnetUri, name: torrent.name });
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

  // Download a specific file from a torrent
  async downloadFile(magnetUri, fileName) {
    try {
      const torrent = this.client.get(magnetUri);
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      const savePath = await dialog.showSaveDialog(this.mainWindow, {
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
  }

  // Pause a torrent (FIXED - uses stored path info from download events)
  async pauseTorrent(magnetUri) {
    try {
      const torrent = this.client.get(magnetUri);
      if (torrent) {
        
        // Get reliable path info from stored data (captured during download events)
        const pathInfo = this.activeTorrentPaths.get(magnetUri);
        
        if (pathInfo) {
          // Use the reliable path info we captured during download
          const torrentInfo = {
            name: pathInfo.name,
            path: pathInfo.path,
            downloadPath: pathInfo.downloadPath,
            files: torrent.files ? torrent.files.map(f => ({ 
              name: f.name, 
              path: f.path,
              length: f.length 
            })) : []
          };
          
          this.pausedTorrents.set(magnetUri, torrentInfo);
          
          // Remove from active paths since it's being paused
          this.activeTorrentPaths.delete(magnetUri);
          
          return new Promise((resolve) => {
            this.client.remove(magnetUri, { destroyStore: false }, (err) => {
              if (!err) {
                console.log('Torrent paused (removed from client, files preserved):', magnetUri);
                console.log('Stored torrent info for potential cleanup:', torrentInfo.downloadPath);
                resolve(true);
              } else {
                console.error('Pause error:', err);
                // Clean up on error
                this.pausedTorrents.delete(magnetUri);
                resolve(false);
              }
            });
          });
        } else {
          // Fallback: torrent hasn't started downloading yet, try magnet URI parsing
          const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/);
          const torrentName = dnMatch ? decodeURIComponent(dnMatch[1]).replace(/\+/g, ' ') : 'Unknown';
          const basePath = path.join(os.homedir(), 'Downloads');
          const downloadPath = path.join(basePath, torrentName);
          
          const torrentInfo = {
            name: torrentName,
            path: basePath,
            downloadPath: downloadPath,
            files: []
          };
          
          this.pausedTorrents.set(magnetUri, torrentInfo);
          
          return new Promise((resolve) => {
            this.client.remove(magnetUri, { destroyStore: false }, (err) => {
              if (!err) {
                console.log('Torrent paused (early, before download started):', magnetUri);
                console.log('Using fallback path:', downloadPath);
                resolve(true);
              } else {
                console.error('Pause error:', err);
                this.pausedTorrents.delete(magnetUri);
                resolve(false);
              }
            });
          });
        }
      }
      return false;
    } catch (error) {
      console.error('Pause error:', error);
      return false;
    }
  }

  // Remove a torrent (handles both active and paused torrents with consistent cleanup)
  async removeTorrent(magnetUri) {
    try {
      // Handle paused torrents (not in client but files on disk)
      if (this.pausedTorrents.has(magnetUri)) {
        const torrentInfo = this.pausedTorrents.get(magnetUri);
        
        console.log('Removing paused torrent, deleting files from:', torrentInfo.downloadPath);
        
        // Delete files manually using stored path info
        try {
          if (fs.existsSync(torrentInfo.downloadPath)) {
            fs.rmSync(torrentInfo.downloadPath, { recursive: true, force: true });
            console.log('Paused torrent files deleted successfully:', torrentInfo.downloadPath);
          } else {
            console.log('Paused torrent files not found (may have been moved/deleted):', torrentInfo.downloadPath);
          }
        } catch (fsError) {
          console.error('File deletion error for paused torrent:', fsError);
          // Continue anyway - we'll still remove it from our tracking
        }
        
        // Remove from paused torrents tracking
        this.pausedTorrents.delete(magnetUri);
        console.log('Paused torrent removed from tracking:', magnetUri);
        return true;
      }
      
      // Handle active torrent (currently in client) - using our consistent cleanup approach
      const torrent = this.client.get(magnetUri);
      if (torrent) {
        
        // First, get the path info for manual cleanup
        let downloadPath = null;
        
        // Try to get path from stored active paths (most reliable)
        const pathInfo = this.activeTorrentPaths.get(magnetUri);
        if (pathInfo) {
          downloadPath = pathInfo.downloadPath;
        }
        // Fallback: construct path from current torrent info
        else if (torrent.name && torrent.path) {
          downloadPath = path.join(torrent.path, torrent.name);
        }
        // Last resort: try magnet URI parsing
        else {
          const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/);
          if (dnMatch) {
            const torrentName = decodeURIComponent(dnMatch[1]).replace(/\+/g, ' ');
            downloadPath = path.join(os.homedir(), 'Downloads', torrentName);
          }
        }
        
        console.log('Removing active torrent, deleting files from:', downloadPath);
        
        // Remove from WebTorrent client (without file deletion)
        return new Promise((resolve) => {
          this.client.remove(magnetUri, { destroyStore: false }, (err) => {
            if (!err) {
              console.log('Active torrent removed from client:', magnetUri);
              
              // Now manually delete files using our consistent approach
              if (downloadPath) {
                try {
                  if (fs.existsSync(downloadPath)) {
                    fs.rmSync(downloadPath, { recursive: true, force: true });
                    console.log('Active torrent files deleted successfully:', downloadPath);
                  } else {
                    console.log('Active torrent files not found (may have been moved/deleted):', downloadPath);
                  }
                } catch (fsError) {
                  console.error('File deletion error for active torrent:', fsError);
                  // Don't fail the operation - torrent was removed from client successfully
                }
              } else {
                console.warn('Could not determine download path for file cleanup:', magnetUri);
              }
              
              // Clean up tracking
              this.activeTorrentPaths.delete(magnetUri);
              
              resolve(true);
            } else {
              console.error('Remove error for active torrent:', err);
              resolve(false);
            }
          });
        });
      }
      
      // Torrent not found in either active or paused state
      console.log('Torrent not found in active or paused state:', magnetUri);
      return false;
      
    } catch (error) {
      console.error('Remove error:', error);
      return false;
    }
  }

  // Get torrent statistics (includes paused torrents count)
  async getTorrentStats() {
    return {
      activeTorrents: this.client.torrents.length,
      pausedTorrents: this.pausedTorrents.size,
      totalTorrents: this.client.torrents.length + this.pausedTorrents.size,
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      progress: this.client.progress
    };
  }

  // Check if a torrent is paused
  isTorrentPaused(magnetUri) {
    return this.pausedTorrents.has(magnetUri);
  }

  // Get paused torrent info
  getPausedTorrentInfo(magnetUri) {
    return this.pausedTorrents.get(magnetUri);
  }

  // Get all paused torrents
  getAllPausedTorrents() {
    return Array.from(this.pausedTorrents.entries()).map(([magnetUri, info]) => ({
      magnetUri,
      ...info
    }));
  }

  // Destroy the torrent client (cleanup paused torrents tracking)
  destroy() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      console.log('WebTorrent client destroyed');
    }
    
    // Clear tracking maps
    this.pausedTorrents.clear();
    this.activeTorrentPaths.clear();
    console.log('Torrent tracking cleared');
  }
}

// Export a singleton instance
export default new TorrentManager();