import path from 'path';
import os from 'os';

class TorrentStateManager {
  constructor() {
    this.pausedTorrents = new Map(); // Store paused torrent info
    this.activeTorrentPaths = new Map(); // Store active torrent paths from download events
    this.activeTorrents = new Map(); // Store active torrent objects from download events - NOW A STREAMABLE TORRENTS REGISTRY
    this.torrentInfoMap = new Map(); // Store torrent info by infoHash for reliable lookup
  }

  // Store torrent path info during download event
  storeTorrentPath(magnetUri, torrent) {
    if (torrent.name && torrent.path) {
      this.activeTorrentPaths.set(magnetUri, {
        name: torrent.name,
        path: torrent.path,
        downloadPath: path.join(torrent.path, torrent.name)
      });
    }
  }

  // Store torrent object in streamable registry
  storeActiveTorrent(torrent, magnetUri) {
    if (torrent.infoHash) {
      const wasAlreadyInRegistry = this.activeTorrents.has(torrent.infoHash);
      
      this.activeTorrents.set(torrent.infoHash, torrent);
      
      // Store torrent info for reliable lookup when paused
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
  }

  // Store paused torrent info
  storePausedTorrent(magnetUri, torrentInfo) {
    this.pausedTorrents.set(magnetUri, torrentInfo);
    this.activeTorrentPaths.delete(magnetUri);
  }

  // Get torrent from active torrents
  getActiveTorrent(infoHash) {
    return this.activeTorrents.get(infoHash);
  }

  // Get torrent info from map
  getTorrentInfo(infoHash) {
    return this.torrentInfoMap.get(infoHash);
  }

  // Get paused torrent info
  getPausedTorrent(magnetUri) {
    return this.pausedTorrents.get(magnetUri);
  }

  // Get torrent path info
  getTorrentPath(magnetUri) {
    return this.activeTorrentPaths.get(magnetUri);
  }

  // Check if torrent is paused
  isTorrentPaused(magnetUri) {
    return this.pausedTorrents.has(magnetUri);
  }

  // Remove torrent from active paths
  removeFromActivePaths(magnetUri) {
    this.activeTorrentPaths.delete(magnetUri);
  }

  // Remove torrent from paused torrents
  removeFromPausedTorrents(magnetUri) {
    this.pausedTorrents.delete(magnetUri);
  }

  // Remove torrent from streamable registry
  removeFromActiveTorrents(infoHash) {
    this.activeTorrents.delete(infoHash);
  }

  // Remove torrent from info map
  removeFromTorrentInfoMap(infoHash) {
    this.torrentInfoMap.delete(infoHash);
  }

  // Find torrent by magnet URI in active torrents
  findActiveTorrentByMagnet(magnetUri) {
    for (const [infoHash, torrent] of this.activeTorrents.entries()) {
      if (torrent.magnetURI === magnetUri) {
        return { infoHash, torrent };
      }
    }
    return null;
  }

  // Find torrent info by magnet URI
  findTorrentInfoByMagnet(magnetUri) {
    for (const [infoHash, info] of this.torrentInfoMap.entries()) {
      if (info.magnetUri === magnetUri) {
        return { infoHash, info };
      }
    }
    return null;
  }

  // Get all paused torrents
  getAllPausedTorrents() {
    return Array.from(this.pausedTorrents.entries()).map(([magnetUri, info]) => ({
      magnetUri,
      ...info
    }));
  }

  // Get paused torrents count
  getPausedTorrentsCount() {
    return this.pausedTorrents.size;
  }

  // Get active torrents count
  getActiveTorrentsCount() {
    return this.activeTorrents.size;
  }

  // Create fallback torrent info from magnet URI
  createFallbackTorrentInfo(magnetUri) {
    const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/);
    const torrentName = dnMatch ? decodeURIComponent(dnMatch[1]).replace(/\+/g, ' ') : 'Unknown';
    const basePath = path.join(os.homedir(), 'Downloads');
    const downloadPath = path.join(basePath, torrentName);
    
    return {
      name: torrentName,
      path: basePath,
      downloadPath: downloadPath,
      files: []
    };
  }

  // Clear all state
  clear() {
    this.pausedTorrents.clear();
    this.activeTorrentPaths.clear();
    this.activeTorrents.clear();
    this.torrentInfoMap.clear();
    console.log('Torrent state cleared');
  }
}

export default TorrentStateManager; 