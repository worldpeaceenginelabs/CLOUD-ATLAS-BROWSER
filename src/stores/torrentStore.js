import { writable } from 'svelte/store';

let torrentIdCounter = 0;

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
    sidebarWidth: 350 // Default sidebar width
  });

  return {
    subscribe,
    
    // Add a new torrent with deduplication
    addTorrent: (magnetUri, torrentInfo = null) => {
      const infoHash = extractInfoHash(magnetUri);
      
      if (!infoHash) {
        console.error('Invalid magnet URI - cannot extract info hash');
        return null;
      }

      // Check for duplicates
      let isDuplicate = false;
      update(state => {
        const existing = state.torrents.find(t => 
          extractInfoHash(t.magnetUri) === infoHash
        );
        
        if (existing) {
          isDuplicate = true;
          console.log('Torrent already exists:', existing.name || magnetUri);
          return state; // No changes
        }

        const newTorrent = {
          id: ++torrentIdCounter,
          magnetUri,
          infoHash, // Store the extracted hash
          name: torrentInfo?.name || 'Loading...',
          status: 'downloading', // downloading, paused, completed, error
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0,
          downloaded: 0,
          uploaded: 0,
          files: torrentInfo?.files || [],
          dateAdded: new Date(),
          error: null,
          actualDownloadPath: null, // Will be set when download event fires
          // Additional metadata
          size: 0,
          eta: null
        };
        
        return {
          ...state,
          torrents: [...state.torrents, newTorrent],
          sidebarOpen: true // Auto-open sidebar when adding torrent
        };
      });
      
      if (isDuplicate) {
        return null; // Signal that torrent was not added
      }
      
      return torrentIdCounter; // Return the new torrent ID
    },
    
    // Remove a torrent
    removeTorrent: (torrentId) => {
      update(state => ({
        ...state,
        torrents: state.torrents.filter(t => t.id !== torrentId)
      }));
    },
    
    // Update torrent data
    updateTorrent: (torrentId, updates) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.id === torrentId ? { ...torrent, ...updates } : torrent
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

    // Find torrent by info hash
    findTorrentByHash: (infoHash) => {
      let result = null;
      update(state => {
        result = state.torrents.find(t => t.infoHash === infoHash.toLowerCase());
        return state;
      });
      return result;
    },

    // Check if torrent exists by hash
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
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.magnetUri === magnetUri ? {
            ...torrent,
            progress: progressData.progress || 0,
            downloadSpeed: progressData.downloadSpeed || 0,
            uploadSpeed: progressData.uploadSpeed || 0,
            peers: progressData.peers || 0,
            downloaded: progressData.downloaded || 0,
            uploaded: progressData.uploaded || 0,
            // Store the ACTUAL reliable path info if provided
            actualDownloadPath: progressData.actualDownloadPath || torrent.actualDownloadPath,
            status: progressData.progress >= 1 ? 'completed' : 'downloading'
          } : torrent
        )
      }));
    },
    
    // Set torrent status
    setTorrentStatus: (torrentId, status, error = null) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.id === torrentId ? { ...torrent, status, error } : torrent
        )
      }));
    },
    
    // Pause torrent
    pauseTorrent: (torrentId) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.id === torrentId ? { ...torrent, status: 'paused' } : torrent
        )
      }));
    },
    
    // Resume torrent
    resumeTorrent: (torrentId) => {
      update(state => ({
        ...state,
        torrents: state.torrents.map(torrent => 
          torrent.id === torrentId ? { ...torrent, status: 'downloading' } : torrent
        )
      }));
    },
    
    // Sidebar controls
    toggleSidebar: () => {
      console.log('toggleSidebar called'); // Debug
      update(state => {
        console.log('Current sidebar state:', state.sidebarOpen); // Debug
        const newState = {
          ...state,
          sidebarOpen: !state.sidebarOpen
        };
        console.log('New sidebar state:', newState.sidebarOpen); // Debug
        return newState;
      });
    },
    
    setSidebarOpen: (open) => {
      update(state => ({
        ...state,
        sidebarOpen: open
      }));
    },
    
    setSidebarWidth: (width) => {
      update(state => ({
        ...state,
        sidebarWidth: Math.max(250, Math.min(600, width)) // Constrain between 250-600px
      }));
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
    
    // Clear all torrents (for testing/debugging)
    clearAll: () => {
      update(state => ({
        ...state,
        torrents: []
      }));
    },

    // Get all torrents (for external access)
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