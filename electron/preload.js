const { contextBridge, ipcRenderer } = require('electron');

// Security: Validate all inputs before sending to main process
const validateInput = (input, type) => {
  switch (type) {
    case 'string':
      return typeof input === 'string' && input.length > 0 && input.length < 10000;
    case 'number':
      return typeof input === 'number' && !isNaN(input) && isFinite(input);
    case 'path':
      return typeof input === 'string' && input.length > 0 && input.length < 500;
    case 'magnetUri':
      return typeof input === 'string' && input.startsWith('magnet:') && input.length < 2000;
    default:
      return false;
  }
};

// Security: Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = {
  invoke: [
    'select-file',
    'select-folder',
    'get-download-path',
    'show-save-dialog',
    'read-file-for-seeding',
    'save-stream-to-file',
    'create-tab-view',
    'set-active-tab-view',
    'close-tab-view',
    'validate-magnet-uri',
    'handle-magnet-link'
  ],
  send: [
    'console-message',
    'tab-navigation'
  ],
  receive: [
    'main-process-message',
    'handle-magnet-link',
    'tab-update',
    'torrent-progress'
  ]
};

// Security: Create safe IPC wrapper
const createSafeIpcInvoker = (channel, validator) => {
  return async (...args) => {
    if (!ALLOWED_CHANNELS.invoke.includes(channel)) {
      throw new Error(`Channel ${channel} is not allowed`);
    }
    
    if (validator && !args.every(validator)) {
      throw new Error(`Invalid arguments for ${channel}`);
    }
    
    try {
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      console.error(`IPC Error on ${channel}:`, error);
      throw error;
    }
  };
};

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  selectFile: createSafeIpcInvoker('select-file'),
  selectFolder: createSafeIpcInvoker('select-folder'),
  getDownloadPath: createSafeIpcInvoker('get-download-path'),
  
  showSaveDialog: createSafeIpcInvoker('show-save-dialog', (filename) => 
    validateInput(filename, 'string')
  ),
  
  readFileForSeeding: createSafeIpcInvoker('read-file-for-seeding', (filePath) => 
    validateInput(filePath, 'path')
  ),
  
  saveStreamToFile: createSafeIpcInvoker('save-stream-to-file', (streamData, savePath) => 
    streamData && validateInput(savePath, 'path')
  ),

  // Torrent operations
  validateMagnetUri: createSafeIpcInvoker('validate-magnet-uri', (magnetUri) => 
    validateInput(magnetUri, 'magnetUri')
  ),
  
  handleMagnetLink: createSafeIpcInvoker('handle-magnet-link', (magnetUri) => 
    validateInput(magnetUri, 'magnetUri')
  ),

  // Tab management
  createTabView: createSafeIpcInvoker('create-tab-view', (url) => 
    !url || validateInput(url, 'string') || validateInput(url, 'magnetUri')
  ),
  
  setActiveTabView: createSafeIpcInvoker('set-active-tab-view', (viewId) => 
    validateInput(viewId, 'number')
  ),
  
  closeTabView: createSafeIpcInvoker('close-tab-view', (viewId) => 
    validateInput(viewId, 'number')
  ),

  // Event listeners with validation
  onMainProcessMessage: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    ipcRenderer.on('main-process-message', (event, ...args) => {
      // Security: Sanitize received data
      const sanitizedArgs = args.map(arg => {
        if (typeof arg === 'string' && arg.length > 10000) {
          return arg.substring(0, 10000) + '... [truncated]';
        }
        return arg;
      });
      callback(...sanitizedArgs);
    });
  },

  onMagnetLink: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    ipcRenderer.on('handle-magnet-link', (event, magnetUri) => {
      if (validateInput(magnetUri, 'magnetUri')) {
        callback(magnetUri);
      }
    });
  },

  onTabUpdate: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    ipcRenderer.on('tab-update', (event, data) => {
      callback(data);
    });
  },

  onTorrentProgress: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    ipcRenderer.on('torrent-progress', (event, data) => {
      callback(data);
    });
  },

  // Security utilities
  sanitizeUrl: (url) => {
    if (!validateInput(url, 'string')) {
      return null;
    }
    
    try {
      const urlObj = new URL(url);
      
      // Allow only safe protocols
      const allowedProtocols = ['https:', 'http:', 'magnet:', 'file:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return null;
      }
      
      return urlObj.toString();
    } catch {
      return null;
    }
  },

  // Cleanup
  removeAllListeners: (channel) => {
    if (ALLOWED_CHANNELS.receive.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});

// Security: Expose limited console API for debugging
contextBridge.exposeInMainWorld('secureConsole', {
  log: (...args) => {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string' && arg.length > 1000) {
        return arg.substring(0, 1000) + '... [truncated]';
      }
      return arg;
    });
    console.log('[Renderer]', ...sanitizedArgs);
  },
  
  error: (...args) => {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string' && arg.length > 1000) {
        return arg.substring(0, 1000) + '... [truncated]';
      }
      return arg;
    });
    console.error('[Renderer]', ...sanitizedArgs);
  },
  
  warn: (...args) => {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string' && arg.length > 1000) {
        return arg.substring(0, 1000) + '... [truncated]';
      }
      return arg;
    });
    console.warn('[Renderer]', ...sanitizedArgs);
  }
});

// Security: Block access to dangerous globals
delete window.require;
delete window.exports;
delete window.module;

// Security: Prevent prototype pollution
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(Function.prototype);