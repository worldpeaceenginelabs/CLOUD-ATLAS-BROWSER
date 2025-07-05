import CoreTorrentManager from './torrent/core-manager.js';
import StreamingServer from './torrent/streaming-server.js';
import TorrentStateManager from './torrent/state-manager.js';
import FileOperations from './torrent/file-operations.js';
import NetworkManager from './torrent/network-manager.js';
import path from 'path';
import fs from 'fs';

class TorrentManager {
  constructor() {
    this.coreManager = new CoreTorrentManager();
    this.streamingServer = new StreamingServer();
    this.stateManager = new TorrentStateManager();
    this.fileOperations = null; // Will be initialized when mainWindow is set
    this.networkManager = null; // Will be initialized after coreManager
    this.mainWindow = null;
  }

  // Initialize all components
  initialize() {
    this.coreManager.initialize();
    this.streamingServer.start();
    this.networkManager = new NetworkManager(this.coreManager);
    
    // Set up streaming server handler
    this.streamingServer.setStreamHandler((req, res, infoHash, fileName) => {
      this.handleStreamRequest(req, res, infoHash, fileName);
    });
  }

  // Set reference to main window for communication
  setMainWindow(window) {
    this.mainWindow = window;
    this.coreManager.setMainWindow(window);
    this.fileOperations = new FileOperations(window);
  }

  // Send data to renderer process
  sendToRenderer(channel, data) {
    this.coreManager.sendToRenderer(channel, data);
  }

  // Add torrent from magnet URI
  async addTorrent(magnetUri) {
        // Check if this is a resume operation
    const isResume = this.stateManager.isTorrentPaused(magnetUri);
        if (isResume) {
          console.log('Resuming paused torrent:', magnetUri);
      this.stateManager.removeFromPausedTorrents(magnetUri);
    }

    return this.coreManager.addTorrent(magnetUri, {
      onReady: (torrent, torrentInfo) => {
        // Handle torrent ready event
      },
      onDownload: (torrent, magnetUri) => {
        // Store torrent path info during download event
        this.stateManager.storeTorrentPath(magnetUri, torrent);
          
          // Store the torrent object itself when it's reliable (during download)
        this.stateManager.storeActiveTorrent(torrent, magnetUri);
          
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
      },
      onDone: (torrent, magnetUri) => {
        // Handle torrent completion
      }
    });
  }

  // Seed a file
  async seedFile(filePath) {
    return this.coreManager.seedFile(filePath);
  }

  // Download a specific file from a torrent
  async downloadFile(magnetUri, fileName) {
    const torrent = this.coreManager.getTorrent(magnetUri);
    return this.fileOperations.downloadFile(torrent, fileName);
  }

  // Get file stream for media playback
  async getFileStream(magnetUri, fileName) {
    const torrent = this.coreManager.getTorrent(magnetUri);
    return this.fileOperations.getFileStream(torrent, fileName);
  }

  // Get file blob URL for image preview
  async getFileBlobURL(magnetUri, fileName) {
    const torrent = this.coreManager.getTorrent(magnetUri);
    return this.fileOperations.getFileBlobURL(torrent, fileName);
  }

  // Get file info for streaming readiness
  async getFileInfo(magnetUri, fileName) {
    const torrent = this.coreManager.getTorrent(magnetUri);
    return this.fileOperations.getFileInfo(torrent, fileName);
  }

  // Pause a torrent (MODIFIED - keeps torrent in activeTorrents for streaming)
  async pauseTorrent(magnetUri) {
    try {
      const torrent = this.coreManager.getTorrent(magnetUri);
      if (torrent) {
        
        // Get reliable path info from stored data (captured during download events)
        const pathInfo = this.stateManager.getTorrentPath(magnetUri);
        
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
          
          this.stateManager.storePausedTorrent(magnetUri, torrentInfo);
          
          console.log(`Torrent paused but kept in streamable registry: ${torrent.name} (${torrent.infoHash})`);
          
          return this.coreManager.removeTorrent(magnetUri, { destroyStore: false });
        } else {
          // Fallback: torrent hasn't started downloading yet, try magnet URI parsing
          const torrentInfo = this.stateManager.createFallbackTorrentInfo(magnetUri);
          this.stateManager.storePausedTorrent(magnetUri, torrentInfo);
          
          console.log('Torrent paused (early, before download started):', magnetUri);
          console.log('Using fallback path:', torrentInfo.downloadPath);
          
          return this.coreManager.removeTorrent(magnetUri, { destroyStore: false });
        }
      }
      return false;
    } catch (error) {
      console.error('Pause error:', error);
      return false;
    }
  }

  // Remove a torrent (MODIFIED - removes from streamable registry only on complete removal)
  async removeTorrent(magnetUri, keepFiles) {
    // Guard: only proceed if keepFiles is explicitly true or false
    if (typeof keepFiles !== 'boolean') {
      console.error('Refusing to remove torrent: keepFiles flag missing or invalid!');
      return false;
    }
    
    try {
      // Handle paused torrents (not in client but files on disk)
      if (this.stateManager.isTorrentPaused(magnetUri)) {
        const torrentInfo = this.stateManager.getPausedTorrent(magnetUri);
        
        console.log('Removing paused torrent, deleting files from:', torrentInfo.downloadPath);
        
        // Delete files if keepFiles is false
        await this.fileOperations.deleteTorrentFiles(torrentInfo.downloadPath, keepFiles);
        
        // Remove from paused torrents tracking
        this.stateManager.removeFromPausedTorrents(magnetUri);
        
        // IMPORTANT: Remove from streamable torrents registry when completely removed
        const activeTorrent = this.stateManager.findActiveTorrentByMagnet(magnetUri);
        if (activeTorrent) {
          this.stateManager.removeFromActiveTorrents(activeTorrent.infoHash);
          console.log(`Removed paused torrent from streamable registry: ${activeTorrent.infoHash}`);
        }
        
        // Also remove from torrentInfoMap
        const torrentInfoEntry = this.stateManager.findTorrentInfoByMagnet(magnetUri);
        if (torrentInfoEntry) {
          this.stateManager.removeFromTorrentInfoMap(torrentInfoEntry.infoHash);
          console.log(`Removed paused torrent from info map: ${torrentInfoEntry.infoHash}`);
        }
        
        console.log('Paused torrent removed from tracking:', magnetUri);
        return true;
      }
      
      // Handle active torrent (currently in client) - using our consistent cleanup approach
      const torrent = this.coreManager.getTorrent(magnetUri);
      if (torrent) {
        
        // First, get the path info for manual cleanup
        let downloadPath = null;
        
        // Try to get path from stored active paths (most reliable)
        const pathInfo = this.stateManager.getTorrentPath(magnetUri);
        if (pathInfo) {
          downloadPath = pathInfo.downloadPath;
        }
        // Fallback: construct path from current torrent info
        else if (torrent.name && torrent.path) {
          downloadPath = path.join(torrent.path, torrent.name);
        }
        // Last resort: try magnet URI parsing
        else {
          const torrentInfo = this.stateManager.createFallbackTorrentInfo(magnetUri);
          downloadPath = torrentInfo.downloadPath;
        }
        
        console.log('Removing active torrent, deleting files from:', downloadPath);
        
        // Remove from WebTorrent client (without file deletion)
        const removed = await this.coreManager.removeTorrent(magnetUri, { destroyStore: false });
        
        if (removed) {
          // Delete files if keepFiles is false
          await this.fileOperations.deleteTorrentFiles(downloadPath, keepFiles);
              
              // Clean up tracking
          this.stateManager.removeFromActivePaths(magnetUri);
              
              // IMPORTANT: Remove from streamable torrents registry when completely removed
              if (torrent.infoHash) {
            this.stateManager.removeFromActiveTorrents(torrent.infoHash);
            this.stateManager.removeFromTorrentInfoMap(torrent.infoHash);
                console.log(`Removed active torrent from streamable registry: ${torrent.infoHash}`);
              }
              
          return true;
            }
        
        return false;
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
    const coreStats = this.coreManager.getStats();
    return {
      ...coreStats,
      pausedTorrents: this.stateManager.getPausedTorrentsCount(),
      totalTorrents: coreStats.activeTorrents + this.stateManager.getPausedTorrentsCount()
    };
  }

  // Check if a torrent is paused
  isTorrentPaused(magnetUri) {
    return this.stateManager.isTorrentPaused(magnetUri);
  }

  // Get paused torrent info
  getPausedTorrentInfo(magnetUri) {
    return this.stateManager.getPausedTorrent(magnetUri);
  }

  // Get all paused torrents
  getAllPausedTorrents() {
    return this.stateManager.getAllPausedTorrents();
  }

  // Handle streaming request
  handleStreamRequest(req, res, infoHash, fileName) {
    // First try to get torrent object from active torrents
    let torrent = this.stateManager.getActiveTorrent(infoHash);
    
    // If not found in active torrents, or if torrent has no files (paused), try to get from torrent info map
    if (!torrent || !torrent.files || torrent.files.length === 0) {
      const torrentInfo = this.stateManager.getTorrentInfo(infoHash);
      if (torrentInfo) {
        console.log(`Found torrent info for paused torrent: ${torrentInfo.name}`);
        // For paused torrents, we need to check if files exist on disk
        const filePath = path.join(torrentInfo.path, torrentInfo.name, fileName);
        if (this.fileOperations.checkFileExists(filePath)) {
          // Create a file-like object for streaming
          const file = this.fileOperations.createFileObject(filePath, fileName);
          
          if (file) {
            console.log(`Serving paused torrent file: ${fileName} (${file.length} bytes)`);
            this.streamingServer.handleRangeRequest(req, res, file, fileName);
            return;
          }
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
    this.streamingServer.handleRangeRequest(req, res, file, fileName);
  }

  // Destroy the torrent client (cleanup paused torrents tracking)
  destroy() {
    this.coreManager.destroy();
    this.streamingServer.stop();
    this.stateManager.clear();
    console.log('Torrent manager destroyed');
  }
}

// Export a singleton instance
export default new TorrentManager();