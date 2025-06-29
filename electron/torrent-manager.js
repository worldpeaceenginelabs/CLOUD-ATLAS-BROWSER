import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { dialog } from 'electron';
import http from 'http';
import url from 'url';

class TorrentManager {
  constructor() {
    this.client = null;
    this.mainWindow = null;
    this.pausedTorrents = new Map(); // Store paused torrent info
    this.activeTorrentPaths = new Map(); // Store active torrent paths from download events
    this.activeTorrents = new Map(); // Store active torrent objects from download events - NOW A STREAMABLE TORRENTS REGISTRY
    this.torrentInfoMap = new Map(); // Store torrent info by infoHash for reliable lookup
    this.httpServer = null;
    this.httpPort = 18080; // You can randomize or increment if needed
    this.networkErrorCount = 0; // Track network errors for recovery
    this.lastNetworkError = 0; // Timestamp of last network error
  }

  // Initialize WebTorrent client and HTTP server
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
        this.handleNetworkChange();
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
        this.handleNetworkChange();
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
    this.startHttpServer();
  }

  // Start local HTTP server for streaming
  startHttpServer() {
    if (this.httpServer) return;
    this.httpServer = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const match = parsedUrl.pathname.match(/^\/stream\/([a-zA-Z0-9]+)\/(.+)$/);
      if (match) {
        const infoHash = match[1].toLowerCase();
        const fileName = decodeURIComponent(match[2]);
        
        console.log(`Stream request: ${infoHash} - ${fileName}`);
        
        // First try to get torrent object from active torrents
        let torrent = this.activeTorrents.get(infoHash);
        
        // If not found in active torrents, or if torrent has no files (paused), try to get from torrent info map
        if (!torrent || !torrent.files || torrent.files.length === 0) {
          const torrentInfo = this.torrentInfoMap.get(infoHash);
          if (torrentInfo) {
            console.log(`Found torrent info for paused torrent: ${torrentInfo.name}`);
            // For paused torrents, we need to check if files exist on disk
            const filePath = path.join(torrentInfo.path, torrentInfo.name, fileName);
            if (fs.existsSync(filePath)) {
              // Create a file-like object for streaming
              const stats = fs.statSync(filePath);
              const file = {
                name: fileName,
                length: stats.size,
                downloaded: stats.size, // Assume fully downloaded if file exists
                createReadStream: (options) => {
                  return fs.createReadStream(filePath, options);
                }
              };
              
              console.log(`Serving paused torrent file: ${fileName} (${file.length} bytes)`);
              
              // Support HTTP Range requests
              const range = req.headers.range;
              const fileLength = file.length;
              let start = 0;
              let end = fileLength - 1;
              if (range) {
                const match = range.match(/bytes=(\d+)-(\d*)/);
                if (match) {
                  start = parseInt(match[1], 10);
                  if (match[2]) end = parseInt(match[2], 10);
                }
              }
              if (start > end || start < 0 || end >= fileLength) {
                res.writeHead(416, { 'Content-Range': `bytes */${fileLength}`, 'Access-Control-Allow-Origin': '*' });
                res.end();
                return;
              }
              
              const headers = {
                'Content-Type': this.getMimeType(fileName),
                'Content-Length': end - start + 1,
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*'
              };
              
              // Only add Content-Range header if this is a range request
              if (range) {
                headers['Content-Range'] = `bytes ${start}-${end}/${fileLength}`;
              }
              
              res.writeHead(range ? 206 : 200, headers);
              const stream = file.createReadStream({ start, end });
              stream.pipe(res);
              stream.on('error', err => {
                console.error(`Stream error for ${fileName}:`, err);
                res.end();
              });
              return;
            } else {
              console.log(`File not found on disk for paused torrent: ${filePath}`);
              res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
              res.end('File not found on disk');
              return;
            }
          } else {
            console.log(`Torrent not found in streamable torrents registry: ${infoHash}`);
            res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            res.end('Torrent not found or not yet downloading');
            return;
          }
        }
        
        console.log(`Found torrent in registry: ${torrent.name} with ${torrent.files?.length || 0} files`);
        
        const file = torrent.files.find(f => f.name === fileName);
        if (!file) {
          console.log(`File not found: ${fileName}`);
          res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          res.end('File not found');
          return;
        }
        
        // Check if file has any downloaded content (works for both active and paused torrents)
        if (file.downloaded === 0) {
          console.log(`File has no downloaded content: ${fileName}`);
          res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          res.end('File not yet downloaded');
          return;
        }
        
        console.log(`Serving file: ${fileName} (${file.length} bytes, ${file.downloaded} downloaded)`);
        
        // Support HTTP Range requests
        const range = req.headers.range;
        const fileLength = file.length;
        let start = 0;
        let end = fileLength - 1;
        if (range) {
          const match = range.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            start = parseInt(match[1], 10);
            if (match[2]) end = parseInt(match[2], 10);
          }
        }
        if (start > end || start < 0 || end >= fileLength) {
          res.writeHead(416, { 'Content-Range': `bytes */${fileLength}`, 'Access-Control-Allow-Origin': '*' });
          res.end();
          return;
        }
        
        const headers = {
          'Content-Type': this.getMimeType(fileName),
          'Content-Length': end - start + 1,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        };
        
        // Only add Content-Range header if this is a range request
        if (range) {
          headers['Content-Range'] = `bytes ${start}-${end}/${fileLength}`;
        }
        
        res.writeHead(range ? 206 : 200, headers);
        const stream = file.createReadStream({ start, end });
        stream.pipe(res);
        stream.on('error', err => {
          console.error(`Stream error for ${fileName}:`, err);
          res.end();
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('Not found');
      }
    });
    this.httpServer.listen(this.httpPort, '127.0.0.1', () => {
      console.log(`Torrent HTTP server running at http://127.0.0.1:${this.httpPort}`);
    });
  }

  // Simple MIME type detection
  getMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv'].includes(ext)) return 'video/mp4';
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio/mpeg';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    if (ext === 'srt') return 'text/plain';
    return 'application/octet-stream';
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
          
          // Store the torrent object itself when it's reliable (during download)
          // KEEP IN STREAMABLE TORRENTS REGISTRY - never remove from here until complete removal
          if (torrent.infoHash) {
            // Only log once when torrent is first added to registry
            const wasAlreadyInRegistry = this.activeTorrents.has(torrent.infoHash);
            
            this.activeTorrents.set(torrent.infoHash, torrent);
            
            // Store torrent info for reliable lookup when paused - ONLY during download event (reliable source)
            this.torrentInfoMap.set(torrent.infoHash, {
              name: torrent.name,
              path: torrent.path,
              magnetUri: magnetUri,
              files: torrent.files ? torrent.files.map(f => ({
                name: f.name,
                length: f.length,
                path: f.path
              })) : []
            });
            
            if (!wasAlreadyInRegistry) {
              console.log(`Added torrent to streamable registry: ${torrent.name} (${torrent.infoHash})`);
            }
          } else {
            console.warn(`Torrent ${torrent.name} has no infoHash available yet`);
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
          
          // Handle WebRTC/ICE connection errors gracefully
          if (err.code === 'ERR_ICE_CONNECTION_CLOSED' || 
              err.message.includes('ICE connection') ||
              err.message.includes('WebRTC') ||
              err.message.includes('peer connection')) {
            console.warn(`WebRTC error for torrent ${torrent.name} - network change detected`);
            // Don't reject the promise, just log the warning
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

      // Create a readable stream from the file
      const fileStream = file.createReadStream();
      const writeStream = fs.createWriteStream(savePath.filePath);

      return new Promise((resolve, reject) => {
        fileStream.pipe(writeStream);
        
        writeStream.on('finish', () => {
          console.log('File downloaded:', savePath.filePath);
          resolve(savePath.filePath);
        });
        
        writeStream.on('error', (err) => {
          console.error('Download error:', err);
          reject(err);
        });
      });

    } catch (error) {
      console.error('Download file error:', error);
      throw error;
    }
  }

  // Get file stream for media playback
  async getFileStream(magnetUri, fileName) {
    try {
      const torrent = this.client.get(magnetUri);
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      // Check if file has enough data to stream
      if (file.downloaded === 0) {
        throw new Error('File not yet downloaded');
      }

      // Create a blob URL from the file
      return new Promise((resolve, reject) => {
        file.getBlobURL((err, url) => {
          if (err) {
            console.error('Error creating blob URL:', err);
            reject(err);
          } else {
            console.log('Created blob URL for streaming:', fileName);
            resolve(url);
          }
        });
      });

    } catch (error) {
      console.error('Get file stream error:', error);
      throw error;
    }
  }

  // Get file blob URL for image preview
  async getFileBlobURL(magnetUri, fileName) {
    try {
      const torrent = this.client.get(magnetUri);
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      // Check if file has enough data to preview
      if (file.downloaded === 0) {
        throw new Error('File not yet downloaded');
      }

      // Create a blob URL from the file
      return new Promise((resolve, reject) => {
        file.getBlobURL((err, url) => {
          if (err) {
            console.error('Error creating blob URL:', err);
            reject(err);
          } else {
            console.log('Created blob URL for preview:', fileName);
            resolve(url);
          }
        });
      });

    } catch (error) {
      console.error('Get file blob URL error:', error);
      throw error;
    }
  }

  // Get file info for streaming readiness
  async getFileInfo(magnetUri, fileName) {
    try {
      const torrent = this.client.get(magnetUri);
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      return {
        name: file.name,
        length: file.length,
        downloaded: file.downloaded,
        progress: file.progress,
        canStream: file.downloaded > 0,
        streamable: file.length > 0 && file.downloaded > 0
      };

    } catch (error) {
      console.error('Get file info error:', error);
      throw error;
    }
  }

  // Pause a torrent (MODIFIED - keeps torrent in activeTorrents for streaming)
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
          
          // IMPORTANT: DO NOT REMOVE FROM activeTorrents - keep it in streamable registry
          // Torrent info is already stored in torrentInfoMap during download event (reliable source)
          console.log(`Torrent paused but kept in streamable registry: ${torrent.name} (${torrent.infoHash})`);
          
          return new Promise((resolve) => {
            this.client.remove(magnetUri, { destroyStore: false }, (err) => {
              if (!err) {
                console.log('Torrent paused (removed from client, files preserved, kept in streamable registry):', magnetUri);
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

  // Remove a torrent (MODIFIED - removes from streamable registry only on complete removal)
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
        
        // IMPORTANT: Remove from streamable torrents registry when completely removed
        // Find the torrent by magnet URI in activeTorrents and torrentInfoMap
        for (const [infoHash, torrent] of this.activeTorrents.entries()) {
          if (torrent.magnetURI === magnetUri) {
            this.activeTorrents.delete(infoHash);
            console.log(`Removed paused torrent from streamable registry: ${infoHash}`);
            break;
          }
        }
        
        // Also remove from torrentInfoMap
        for (const [infoHash, info] of this.torrentInfoMap.entries()) {
          if (info.magnetUri === magnetUri) {
            this.torrentInfoMap.delete(infoHash);
            console.log(`Removed paused torrent from info map: ${infoHash}`);
            break;
          }
        }
        
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
              
              // IMPORTANT: Remove from streamable torrents registry when completely removed
              if (torrent.infoHash) {
                this.activeTorrents.delete(torrent.infoHash);
                this.torrentInfoMap.delete(torrent.infoHash);
                console.log(`Removed active torrent from streamable registry: ${torrent.infoHash}`);
              }
              
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
    this.activeTorrents.clear(); // Clear streamable torrents registry
    this.torrentInfoMap.clear(); // Clear torrent info map
    console.log('Torrent tracking cleared');
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
      if (this.client && this.client.torrents.length > 0) {
        this.client.torrents.forEach(torrent => {
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
      
      this.sendToRenderer('torrent-warning', 'Network recovery attempted. Torrent connections should resume shortly.');
      
    } catch (error) {
      console.error('Network recovery failed:', error);
      this.sendToRenderer('torrent-warning', 'Network recovery failed. You may need to restart the application.');
    }
  }
}

// Export a singleton instance
export default new TorrentManager();