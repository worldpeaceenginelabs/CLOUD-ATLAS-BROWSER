import { writable } from 'svelte/store';

// Extract info hash from magnet URI
function extractInfoHash(magnetUri) {
  try {
    const match = magnetUri.match(/[?&]xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/);
    return match ? match[1].toLowerCase() : null;
  } catch (error) {
    console.error('Error extracting info hash:', error);
    return null;
  }
}

function createTorrentStore() {
  const { subscribe, set, update } = writable({
    torrents: [], // Array of torrent objects
    sidebarOpen: false,
    sidebarWidth: 600 // Default sidebar width
  });

  return {
    subscribe,
    
    // Add a new torrent with deduplication
    addTorrent: (magnetUri, torrentInfo = null, torrentType = 'download') => {
      const infoHash = extractInfoHash(magnetUri);
      if (!infoHash) {
        console.error('Invalid magnet URI - cannot extract info hash');
        return null;
      }
      // Check for duplicates
      let isDuplicate = false;
      update(state => {
        const existing = state.torrents.find(t => t.infoHash === infoHash);
        if (existing) {
          isDuplicate = true;
          console.log('Torrent already exists:', existing.name || magnetUri);
          return state; // No changes
        }
        const newTorrent = {
          infoHash,
          magnetUri,
          name: torrentInfo?.name || 'Loading...',
          status: 'downloading',
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0,
          downloaded: 0,
          uploaded: 0,
          files: torrentInfo?.files || [],
          dateAdded: new Date(),
          error: null,
          actualDownloadPath: null,
          size: 0,
          eta: null,
          torrentType,
          websiteType: torrentInfo?.websiteType ?? null,
        };
        return {
          ...state,
          torrents: [...state.torrents, newTorrent],
          sidebarOpen: true
        };
      });
      if (isDuplicate) {
        return null;
      }
      return infoHash;
    },

    // Remove a torrent by infoHash
    removeTorrent: (infoHash) => {
      update(state => ({
        ...state,
        torrents: state.torrents.filter(t => t.infoHash !== infoHash)
      }));
    },

    // Update torrent data by infoHash
    updateTorrent: (infoHash, updates) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.infoHash === infoHash ? { ...torrent, ...updates } : torrent
        )
      }));
    },

    // Find torrent by magnet URI
    findTorrentByMagnet: (magnetUri) => {
      let result = null;
      update(state => {
        result = state.torrents.find(t => t.magnetUri === magnetUri);
        return state;
      });
      return result;
    },

    // Find torrent by infoHash
    findTorrentByHash: (infoHash) => {
      let result = null;
      update(state => {
        result = state.torrents.find(t => t.infoHash === infoHash.toLowerCase());
        return state;
      });
      return result;
    },

    // Check if torrent exists by infoHash
    torrentExists: (magnetUri) => {
      const infoHash = extractInfoHash(magnetUri);
      if (!infoHash) return false;
      let exists = false;
      update(state => {
        exists = state.torrents.some(t => t.infoHash === infoHash);
        return state;
      });
      return exists;
    },

    // Update torrent progress from WebTorrent events
    updateProgress: (magnetUri, progressData) => {
      const infoHash = extractInfoHash(magnetUri);
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.infoHash === infoHash ? {
            ...torrent,
            progress: progressData.progress || 0,
            downloadSpeed: progressData.downloadSpeed || 0,
            uploadSpeed: progressData.uploadSpeed || 0,
            peers: progressData.peers || 0,
            downloaded: progressData.downloaded || 0,
            uploaded: progressData.uploaded || 0,
            actualDownloadPath: progressData.actualDownloadPath || torrent.actualDownloadPath,
            status: progressData.progress >= 1 ? 'completed' : 'downloading'
          } : torrent
        )
      }));
    },

    // Set torrent status by infoHash
    setTorrentStatus: (infoHash, status, error = null) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.infoHash === infoHash ? { ...torrent, status, error } : torrent
        )
      }));
    },

    // Pause torrent by infoHash
    pauseTorrent: (infoHash) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.infoHash === infoHash ? { ...torrent, status: 'paused' } : torrent
        )
      }));
    },

    // Resume torrent by infoHash
    resumeTorrent: (infoHash) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.infoHash === infoHash ? { ...torrent, status: 'downloading' } : torrent
        )
      }));
    },

    // Sidebar controls
    toggleSidebar: () => {
      update(state => {
        const newState = {
          ...state,
          sidebarOpen: !state.sidebarOpen
        };
        
        // Notify main process about sidebar state change
        if (window.electronAPI) {
          window.electronAPI.updateSidebarState(newState.sidebarOpen, newState.sidebarWidth);
        }
        
        return newState;
      });
    },

    setSidebarOpen: (open) => {
      update(state => {
        const newState = {
          ...state,
          sidebarOpen: open
        };
        
        // Notify main process about sidebar state change
        if (window.electronAPI) {
          window.electronAPI.updateSidebarState(newState.sidebarOpen, newState.sidebarWidth);
        }
        
        return newState;
      });
    },

    setSidebarWidth: (width) => {
      update(state => {
        const newWidth = Math.max(250, Math.min(600, width));
        const newState = {
          ...state,
          sidebarWidth: newWidth
        };
        
        // Notify main process about sidebar state change
        if (window.electronAPI) {
          window.electronAPI.updateSidebarState(newState.sidebarOpen, newState.sidebarWidth);
        }
        
        return newState;
      });
    },

    // Get all downloading torrents
    getActiveTorrents: () => {
      let result = [];
      update(state => {
        result = state.torrents.filter(t => t.status === 'downloading');
        return state;
      });
      return result;
    },

    // Get torrent statistics
    getStats: () => {
      let stats = { total: 0, downloading: 0, paused: 0, completed: 0, totalSpeed: 0 };
      update(state => {
        stats = state.torrents.reduce((acc, torrent) => {
          acc.total++;
          if (torrent.status === 'downloading') {
            acc.downloading++;
            acc.totalSpeed += torrent.downloadSpeed;
          } else if (torrent.status === 'paused') {
            acc.paused++;
          } else if (torrent.status === 'completed') {
            acc.completed++;
          }
          return acc;
        }, { total: 0, downloading: 0, paused: 0, completed: 0, totalSpeed: 0 });
        return state;
      });
      return stats;
    },

    // Clear all torrents
    clearAll: () => {
      update(state => ({
        ...state,
        torrents: []
      }));
    },

    // Get all torrents
    getAllTorrents: () => {
      let result = [];
      update(state => {
        result = [...state.torrents];
        return state;
      });
      return result;
    },

    // Utility: Extract info hash from magnet URI (exposed for external use)
    extractInfoHash
  };
}

export const torrentStore = createTorrentStore();