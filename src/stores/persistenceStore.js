import fs from 'fs';
import path from 'path';
import os from 'os';

// IndexedDB wrapper for persisting torrent and UI state
class PersistenceStore {
  constructor() {
    this.dbName = 'WebTorrentBrowser';
    this.dbVersion = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create torrents store
        if (!db.objectStoreNames.contains('torrents')) {
          const torrentStore = db.createObjectStore('torrents', { keyPath: 'infoHash' });
          torrentStore.createIndex('magnetUri', 'magnetUri', { unique: true });
          torrentStore.createIndex('status', 'status', { unique: false });
        }
        
        // Create UI state store
        if (!db.objectStoreNames.contains('uiState')) {
          db.createObjectStore('uiState', { keyPath: 'key' });
        }
      };
    });
  }

  // Extract info hash from magnet URI
  extractInfoHash(magnetUri) {
    try {
      const match = magnetUri.match(/[?&]xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/);
      return match ? match[1].toLowerCase() : null;
    } catch (error) {
      console.error('Error extracting info hash:', error);
      return null;
    }
  }

  // Check if torrent exists by hash
  async torrentExistsByHash(infoHash) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents'], 'readonly');
      const store = transaction.objectStore('torrents');
      const index = store.index('infoHash');
      const request = index.get(infoHash.toLowerCase());
      
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Save torrent data with deduplication (only for new torrents)
  async saveTorrent(torrent, isNewTorrent = false) {
    if (!this.db) await this.init();
    
    // Extract and add info hash if not present
    if (!torrent.infoHash && torrent.magnetUri) {
      torrent.infoHash = this.extractInfoHash(torrent.magnetUri);
    }

    if (!torrent.infoHash) {
      throw new Error('Cannot save torrent without valid info hash');
    }

    // Only check for duplicates when adding NEW torrents
    if (isNewTorrent) {
      const exists = await this.torrentExistsByHash(torrent.infoHash);
      if (exists) {
        console.log('Torrent already exists in database, skipping save:', torrent.name);
        return false; // Signal that torrent was not saved
      }
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents'], 'readwrite');
      const store = transaction.objectStore('torrents');
      
      // Don't save temporary UI state - only persistent torrent data
      const persistentTorrent = {
        infoHash: torrent.infoHash,
        magnetUri: torrent.magnetUri,
        name: torrent.name,
        status: torrent.status,
        files: torrent.files,
        dateAdded: torrent.dateAdded,
        actualDownloadPath: torrent.actualDownloadPath || null, // Store the REAL path from download event
        // Don't save progress/speed data - these are ephemeral
      };
      
      const request = store.put(persistentTorrent);
      request.onsuccess = () => {
        if (isNewTorrent) {
          console.log('New torrent saved to database:', torrent.name);
        } else {
          console.log('Torrent updated in database:', torrent.name, 'status:', torrent.status);
        }
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Load all torrents
  async loadTorrents() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents'], 'readonly');
      const store = transaction.objectStore('torrents');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const torrents = request.result.map(torrent => ({
          ...torrent,
          // Reset ephemeral data on load
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0,
          downloaded: 0,
          uploaded: 0,
          error: null,
          size: 0,
          eta: null
        }));
        resolve(torrents);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Remove torrent from storage
  async removeTorrent(infoHash) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents'], 'readwrite');
      const store = transaction.objectStore('torrents');
      const request = store.delete(infoHash.toLowerCase());
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Save UI state (sidebar open/closed, width, etc.)
  async saveUIState(key, value) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['uiState'], 'readwrite');
      const store = transaction.objectStore('uiState');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Load UI state
  async loadUIState(key, defaultValue = null) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['uiState'], 'readonly');
      const store = transaction.objectStore('uiState');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data (for testing/reset)
  async clearAll() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents', 'uiState'], 'readwrite');
      
      const torrentStore = transaction.objectStore('torrents');
      const uiStore = transaction.objectStore('uiState');
      
      Promise.all([
        new Promise(res => {
          const req = torrentStore.clear();
          req.onsuccess = () => res();
        }),
        new Promise(res => {
          const req = uiStore.clear();
          req.onsuccess = () => res();
        })
      ]).then(() => resolve()).catch(reject);
    });
  }

  // Get storage usage info
  async getStorageInfo() {
    if (!this.db) await this.init();
    
    try {
      const torrentsCount = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['torrents'], 'readonly');
        const store = transaction.objectStore('torrents');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return {
        torrentsCount,
        dbName: this.dbName,
        dbVersion: this.dbVersion
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { torrentsCount: 0, dbName: this.dbName, dbVersion: this.dbVersion };
    }
  }
}

// Create and export singleton instance
export const persistenceStore = new PersistenceStore();