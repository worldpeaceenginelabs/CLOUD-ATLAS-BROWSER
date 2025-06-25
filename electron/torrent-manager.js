import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { dialog } from 'electron';

class TorrentManager {
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
          const progressData = {
            magnetUri,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            downloaded: torrent.downloaded,
            uploaded: torrent.uploaded
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

  // Pause a torrent
  async pauseTorrent(magnetUri) {
    try {
      const torrent = this.client.get(magnetUri);
      if (torrent) {
        torrent.pause();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Pause error:', error);
      return false;
    }
  }

  // Resume a torrent
  async resumeTorrent(magnetUri) {
    try {
      const torrent = this.client.get(magnetUri);
      if (torrent) {
        torrent.resume();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Resume error:', error);
      return false;
    }
  }

  // Remove a torrent
  async removeTorrent(magnetUri) {
    try {
      const torrent = this.client.get(magnetUri);
      if (torrent) {
        torrent.destroy();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Remove error:', error);
      return false;
    }
  }

  // Get torrent statistics
  async getTorrentStats() {
    return {
      torrents: this.client.torrents.length,
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

// Export a singleton instance
export default new TorrentManager();