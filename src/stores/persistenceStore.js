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
          const torrentStore = db.createObjectStore('torrents', { keyPath: 'id' });
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

  // Save torrent data
  async saveTorrent(torrent) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents'], 'readwrite');
      const store = transaction.objectStore('torrents');
      
      // Don't save temporary UI state - only persistent torrent data
      const persistentTorrent = {
        id: torrent.id,
        magnetUri: torrent.magnetUri,
        name: torrent.name,
        status: torrent.status,
        files: torrent.files,
        dateAdded: torrent.dateAdded,
        // Don't save progress/speed data - these are ephemeral
      };
      
      const request = store.put(persistentTorrent);
      request.onsuccess = () => resolve();
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
  async removeTorrent(torrentId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['torrents'], 'readwrite');
      const store = transaction.objectStore('torrents');
      const request = store.delete(torrentId);
      
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