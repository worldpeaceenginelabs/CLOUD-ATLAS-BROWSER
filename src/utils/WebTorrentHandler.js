import WebTorrent from 'webtorrent/web';
import parseTorrent from 'parse-torrent-file';
import magnet from 'magnet-uri';

class WebTorrentHandler {
  constructor(addLog) {
    this.addLog = addLog;
    this.client = null;
    this.torrents = new Map();
    this.downloadPath = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize WebTorrent client with production settings
      this.client = new WebTorrent({
        maxConns: 50,        // Maximum connections per torrent
        nodeId: this.generateNodeId(),
        peerId: this.generatePeerId(),
        dht: true,           // Enable DHT
        lsd: true,           // Enable Local Service Discovery
        webSeeds: true,      // Enable web seeds
        utp: false,          // Disable uTP for better compatibility
        tracker: {
          announce: [
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.btorrent.xyz',
            'wss://tracker.webtorrent.io'
          ]
        }
      });

      // Set up event listeners
      this.client.on('error', (err) => {
        this.addLog(`WebTorrent error: ${err.message}`, 'error');
      });

      this.client.on('warning', (err) => {
        this.addLog(`WebTorrent warning: ${err.message}`, 'warn');
      });

      // Get download directory from Electron
      if (window.electronAPI) {
        this.downloadPath = await window.electronAPI.getDownloadPath();
      }

      this.addLog('WebTorrent client initialized successfully', 'success');
    } catch (error) {
      this.addLog(`WebTorrent initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async downloadTorrent(magnetUri, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        this.addLog(`Starting download: ${this.truncateMagnet(magnetUri)}`, 'info');

        // Validate magnet URI
        if (!this.isValidMagnetUri(magnetUri)) {
          throw new Error('Invalid magnet URI');
        }

        const torrent = this.client.add(magnetUri, {
          path: this.downloadPath || options.downloadPath,
          strategy: 'sequential', // Download files sequentially
          maxWebConns: 10,        // Limit web connections
          ...options
        });

        // Set up torrent event listeners
        torrent.on('ready', () => {
          this.addLog(`Torrent ready: ${torrent.name} (${torrent.files.length} files)`, 'success');
          
          const torrentInfo = {
            magnetUri,
            name: torrent.name,
            files: torrent.files.map(file => ({
              name: file.name,
              length: file.length,
              path: file.path,
              progress: 0
            })),
            progress: 0,
            downloadSpeed: 0,
            uploadSpeed: 0,
            peers: 0,
            ratio: 0
          };

          this.torrents.set(magnetUri, torrentInfo);
          resolve(torrent.files);
        });

        torrent.on('download', () => {
          const info = this.torrents.get(magnetUri);
          if (info) {
            info.progress = torrent.progress;
            info.downloadSpeed = torrent.downloadSpeed;
            info.uploadSpeed = torrent.uploadSpeed;
            info.peers = torrent.numPeers;
            info.ratio = torrent.ratio;
          }
        });

        torrent.on('error', (err) => {
          this.addLog(`Torrent error: ${err.message}`, 'error');
          reject(err);
        });

        torrent.on('done', () => {
          this.addLog(`Download completed: ${torrent.name}`, 'success');
        });

        // Timeout after 30 seconds if no response
        setTimeout(() => {
          if (torrent.ready === false) {
            torrent.destroy();
            reject(new Error('Torrent download timeout'));
          }
        }, 30000);

      } catch (error) {
        this.addLog(`Error starting download: ${error.message}`, 'error');
        reject(error);
      }
    });
  }

  async seedFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        if (!window.electronAPI) {
          throw new Error('File seeding requires Electron environment');
        }

        this.addLog(`Preparing to seed: ${filePath}`, 'info');

        // Use Electron API to read file
        window.electronAPI.readFileForSeeding(filePath)
          .then(fileBuffer => {
            const fileName = filePath.split(/[\\/]/).pop();
            
            // Create File object from buffer
            const file = new File([fileBuffer], fileName);
            
            const torrent = this.client.seed(file, {
              name: fileName,
              announce: [
                'wss://tracker.openwebtorrent.com',
                'wss://tracker.btorrent.xyz',
                'wss://tracker.webtorrent.io'
              ]
            });

            torrent.on('ready', () => {
              const magnetUri = torrent.magnetURI;
              
              const torrentInfo = {
                magnetUri,
                name: torrent.name,
                files: torrent.files.map(file => ({
                  name: file.name,
                  length: file.length,
                  path: file.path
                })),
                progress: 1.0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                peers: 0,
                ratio: 0,
                seeding: true
              };

              this.torrents.set(magnetUri, torrentInfo);
              this.addLog(`File seeded successfully: ${fileName}`, 'success');
              this.addLog(`Magnet URI: ${magnetUri}`, 'info');
              
              resolve(magnetUri);
            });

            torrent.on('error', (err) => {
              this.addLog(`Seeding error: ${err.message}`, 'error');
              reject(err);
            });
          })
          .catch(reject);

      } catch (error) {
        this.addLog(`Error seeding file: ${error.message}`, 'error');
        reject(error);
      }
    });
  }

  async downloadFile(file, torrent) {
    try {
      this.addLog(`Downloading file: ${file.name}`, 'info');

      if (window.electronAPI) {
        // Use Electron's native file save dialog
        const savePath = await window.electronAPI.showSaveDialog(file.name);
        if (!savePath) return;

        // Stream file to disk
        const stream = file.createReadStream();
        await window.electronAPI.saveStreamToFile(stream, savePath);
        
        this.addLog(`File saved to: ${savePath}`, 'success');
      } else {
        // Browser fallback - create blob and download
        const chunks = [];
        const stream = file.createReadStream();
        
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          this.addLog(`File download started: ${file.name}`, 'success');
        });
      }
    } catch (error) {
      this.addLog(`Error downloading file: ${error.message}`, 'error');
      throw error;
    }
  }

  async streamFile(file) {
    try {
      this.addLog(`Streaming file: ${file.name}`, 'info');
      
      // Create a readable stream for the file
      const stream = file.createReadStream();
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const blob = new Blob(chunks, { type: this.getMimeType(file.name) });
          const url = URL.createObjectURL(blob);
          resolve(url);
        });
        stream.on('error', reject);
      });
    } catch (error) {
      this.addLog(`Error streaming file: ${error.message}`, 'error');
      throw error;
    }
  }

  getTorrentStatus(magnetUri) {
    return this.torrents.get(magnetUri) || null;
  }

  getAllTorrents() {
    return Array.from(this.torrents.values());
  }

  pauseTorrent(magnetUri) {
    const torrent = this.client.get(magnetUri);
    if (torrent) {
      torrent.pause();
      this.addLog(`Torrent paused: ${this.truncateMagnet(magnetUri)}`, 'info');
    }
  }

  resumeTorrent(magnetUri) {
    const torrent = this.client.get(magnetUri);
    if (torrent) {
      torrent.resume();
      this.addLog(`Torrent resumed: ${this.truncateMagnet(magnetUri)}`, 'info');
    }
  }

  removeTorrent(magnetUri, deleteFiles = false) {
    const torrent = this.client.get(magnetUri);
    if (torrent) {
      torrent.destroy({ destroyStore: deleteFiles });
      this.torrents.delete(magnetUri);
      this.addLog(`Torrent removed: ${this.truncateMagnet(magnetUri)}`, 'info');
      return true;
    }
    return false;
  }

  // Utility methods
  isValidMagnetUri(uri) {
    try {
      const parsed = magnet.decode(uri);
      return !!(parsed && parsed.xt);
    } catch {
      return false;
    }
  }

  getMimeType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'html': 'text/html'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  truncateMagnet(magnetUri) {
    return magnetUri.length > 60 ? magnetUri.substring(0, 60) + '...' : magnetUri;
  }

  generateNodeId() {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 40; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  generatePeerId() {
    return '-WB0001-' + Math.random().toString(36).substring(2, 14);
  }

  getClientStats() {
    return {
      torrents: this.client.torrents.length,
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      progress: this.client.progress,
      ratio: this.client.ratio
    };
  }

  destroy() {
    if (this.client) {
      this.client.destroy(() => {
        this.addLog('WebTorrent client destroyed', 'info');
      });
      this.client = null;
    }
    this.torrents.clear();
  }
}

export default WebTorrentHandler;