import { dialog, shell } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

class FileManager {
  constructor() {
    this.mainWindow = null;
    this.defaultDownloadPath = path.join(os.homedir(), 'Downloads');
    this.fileFilters = {
      all: { name: 'All Files', extensions: ['*'] },
      videos: { name: 'Videos', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'] },
      audio: { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma'] },
      images: { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'] },
      documents: { name: 'Documents', extensions: ['pdf', 'txt', 'doc', 'docx', 'rtf', 'odt'] },
      archives: { name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'] },
      torrents: { name: 'Torrents', extensions: ['torrent'] }
    };
  }

  // Set reference to main window
  setMainWindow(window) {
    this.mainWindow = window;
  }

  // Set default download path
  setDefaultDownloadPath(downloadPath) {
    this.defaultDownloadPath = downloadPath;
    console.log('Default download path set to:', downloadPath);
  }

  // Get default download path
  getDefaultDownloadPath() {
    return this.defaultDownloadPath;
  }

  // Show file selection dialog
  async selectFile(options = {}) {
    try {
      const defaultOptions = {
        properties: ['openFile'],
        filters: [
          this.fileFilters.all,
          this.fileFilters.videos,
          this.fileFilters.audio,
          this.fileFilters.images,
          this.fileFilters.documents,
          this.fileFilters.archives,
          this.fileFilters.torrents
        ]
      };

      const dialogOptions = { ...defaultOptions, ...options };
      
      const result = await dialog.showOpenDialog(this.mainWindow, dialogOptions);
      
      if (result.canceled) {
        console.log('File selection canceled');
        return null;
      }

      const selectedFile = result.filePaths[0];
      console.log('File selected:', selectedFile);
      return selectedFile;
      
    } catch (error) {
      console.error('File selection error:', error);
      return null;
    }
  }

  // Show multiple file selection dialog
  async selectMultipleFiles(options = {}) {
    try {
      const defaultOptions = {
        properties: ['openFile', 'multiSelections'],
        filters: [
          this.fileFilters.all,
          this.fileFilters.videos,
          this.fileFilters.audio,
          this.fileFilters.images,
          this.fileFilters.documents
        ]
      };

      const dialogOptions = { ...defaultOptions, ...options };
      
      const result = await dialog.showOpenDialog(this.mainWindow, dialogOptions);
      
      if (result.canceled) {
        console.log('Multiple file selection canceled');
        return null;
      }

      console.log('Multiple files selected:', result.filePaths);
      return result.filePaths;
      
    } catch (error) {
      console.error('Multiple file selection error:', error);
      return null;
    }
  }

  // Show folder selection dialog
  async selectFolder(options = {}) {
    try {
      const defaultOptions = {
        properties: ['openDirectory']
      };

      const dialogOptions = { ...defaultOptions, ...options };
      
      const result = await dialog.showOpenDialog(this.mainWindow, dialogOptions);
      
      if (result.canceled) {
        console.log('Folder selection canceled');
        return null;
      }

      const selectedFolder = result.filePaths[0];
      console.log('Folder selected:', selectedFolder);
      return selectedFolder;
      
    } catch (error) {
      console.error('Folder selection error:', error);
      return null;
    }
  }

  // Show save dialog
  async showSaveDialog(defaultName = 'download', options = {}) {
    try {
      const defaultOptions = {
        defaultPath: path.join(this.defaultDownloadPath, defaultName),
        filters: [this.fileFilters.all]
      };

      const dialogOptions = { ...defaultOptions, ...options };
      
      const result = await dialog.showSaveDialog(this.mainWindow, dialogOptions);
      
      if (result.canceled) {
        console.log('Save dialog canceled');
        return null;
      }

      console.log('Save path selected:', result.filePath);
      return result.filePath;
      
    } catch (error) {
      console.error('Save dialog error:', error);
      return null;
    }
  }

  // Show save dialog with specific file type
  async showSaveDialogForType(fileType, defaultName = 'download', options = {}) {
    const filter = this.fileFilters[fileType] || this.fileFilters.all;
    
    const typeOptions = {
      ...options,
      filters: [filter, this.fileFilters.all]
    };

    return this.showSaveDialog(defaultName, typeOptions);
  }

  // Check if file exists
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Get file info
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const parsed = path.parse(filePath);
      
      return {
        path: filePath,
        name: parsed.name,
        extension: parsed.ext,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get file type from extension
  getFileTypeFromExtension(extension) {
    const ext = extension.toLowerCase().replace('.', '');
    
    for (const [type, filter] of Object.entries(this.fileFilters)) {
      if (filter.extensions.includes(ext) || filter.extensions.includes('*')) {
        return type;
      }
    }
    
    return 'unknown';
  }

  // Create download path if it doesn't exist
  async ensureDownloadPath() {
    try {
      await fs.mkdir(this.defaultDownloadPath, { recursive: true });
      console.log('Download path ensured:', this.defaultDownloadPath);
      return true;
    } catch (error) {
      console.error('Error creating download path:', error);
      return false;
    }
  }

  // Generate unique filename to avoid conflicts
  async generateUniqueFilename(filePath) {
    const parsed = path.parse(filePath);
    let counter = 1;
    let newPath = filePath;

    while (await this.fileExists(newPath)) {
      const newName = `${parsed.name} (${counter})${parsed.ext}`;
      newPath = path.join(parsed.dir, newName);
      counter++;
    }

    return newPath;
  }

  // Validate file path
  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      // Check for valid characters (basic validation)
      const invalidChars = /[<>:"|?*]/;
      if (invalidChars.test(filePath)) {
        return false;
      }

      // Check path length (Windows has 260 char limit)
      if (filePath.length > 255) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // Get available drives (Windows only)
  async getAvailableDrives() {
    if (process.platform !== 'win32') {
      return ['/'];
    }

    try {
      const drives = [];
      for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':';
        try {
          await fs.access(drive);
          drives.push(drive);
        } catch {
          // Drive not available
        }
      }
      return drives;
    } catch (error) {
      console.error('Error getting drives:', error);
      return ['C:'];
    }
  }

  // Get recent download paths
  getRecentPaths() {
    // This could be expanded to store/retrieve from user preferences
    return [
      this.defaultDownloadPath,
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Videos'),
      path.join(os.homedir(), 'Music'),
      path.join(os.homedir(), 'Pictures')
    ];
  }

  // Open file in default application
  async openFile(filePath) {
    try {
      await shell.openPath(filePath);
      console.log('Opened file:', filePath);
      return true;
    } catch (error) {
      console.error('Error opening file:', error);
      return false;
    }
  }

  // Show file in folder
  async showFileInFolder(filePath) {
    try {
      await shell.showItemInFolder(filePath);
      console.log('Showed file in folder:', filePath);
      return true;
    } catch (error) {
      console.error('Error showing file in folder:', error);
      return false;
    }
  }

  // Copy file path to clipboard
  async copyPathToClipboard(filePath) {
    try {
      const { clipboard } = require('electron');
      clipboard.writeText(filePath);
      console.log('Copied path to clipboard:', filePath);
      return true;
    } catch (error) {
      console.error('Error copying path to clipboard:', error);
      return false;
    }
  }

  // Get file filters by category
  getFileFilters(categories = ['all']) {
    const filters = [];
    
    categories.forEach(category => {
      if (this.fileFilters[category]) {
        filters.push(this.fileFilters[category]);
      }
    });

    // Always include 'all files' if not already present
    if (!filters.some(f => f.name === this.fileFilters.all.name)) {
      filters.push(this.fileFilters.all);
    }

    return filters;
  }

  // Add custom file filter
  addFileFilter(name, extensions) {
    this.fileFilters[name.toLowerCase()] = {
      name,
      extensions: Array.isArray(extensions) ? extensions : [extensions]
    };
    console.log('Added custom file filter:', name, extensions);
  }

  // Remove custom file filter
  removeFileFilter(name) {
    const key = name.toLowerCase();
    if (this.fileFilters[key] && !['all', 'videos', 'audio', 'images', 'documents', 'archives', 'torrents'].includes(key)) {
      delete this.fileFilters[key];
      console.log('Removed custom file filter:', name);
      return true;
    }
    return false;
  }

  // Get file statistics
  getFileStatistics() {
    return {
      defaultDownloadPath: this.defaultDownloadPath,
      availableFilters: Object.keys(this.fileFilters),
      platform: process.platform,
      homeDirectory: os.homedir()
    };
  }

  // Cleanup
  destroy() {
    console.log('File manager destroyed');
  }

  // Open the default download (root) folder or a specific folder
  async openRootFolder(folderPath) {
    try {
      const targetPath = folderPath || this.defaultDownloadPath;
      await shell.openPath(targetPath);
      console.log('Opened root folder:', targetPath);
      return true;
    } catch (error) {
      console.error('Error opening root folder:', error);
      return false;
    }
  }
}

// Export a singleton instance
export default new FileManager();