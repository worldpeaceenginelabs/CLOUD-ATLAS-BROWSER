import fs from 'fs';
import path from 'path';
import { dialog } from 'electron';
import os from 'os';

class FileOperations {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  // Download a specific file from a torrent
  async downloadFile(torrent, fileName) {
    try {
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

      // Create a readable stream from the file
      const fileStream = file.createReadStream();
      const writeStream = fs.createWriteStream(savePath.filePath);

      return new Promise((resolve, reject) => {
        fileStream.pipe(writeStream);
        
        writeStream.on('finish', () => {
          console.log('File downloaded:', savePath.filePath);
          resolve(savePath.filePath);
        });
        
        writeStream.on('error', (err) => {
          console.error('Download error:', err);
          reject(err);
        });
      });

    } catch (error) {
      console.error('Download file error:', error);
      throw error;
    }
  }

  // Get file stream for media playback
  async getFileStream(torrent, fileName) {
    try {
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      // Check if file has enough data to stream
      if (file.downloaded === 0) {
        throw new Error('File not yet downloaded');
      }

      // Create a blob URL from the file
      return new Promise((resolve, reject) => {
        file.getBlobURL((err, url) => {
          if (err) {
            console.error('Error creating blob URL:', err);
            reject(err);
          } else {
            console.log('Created blob URL for streaming:', fileName);
            resolve(url);
          }
        });
      });

    } catch (error) {
      console.error('Get file stream error:', error);
      throw error;
    }
  }

  // Get file blob URL for image preview
  async getFileBlobURL(torrent, fileName) {
    try {
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      // Check if file has enough data to preview
      if (file.downloaded === 0) {
        throw new Error('File not yet downloaded');
      }

      // Create a blob URL from the file
      return new Promise((resolve, reject) => {
        file.getBlobURL((err, url) => {
          if (err) {
            console.error('Error creating blob URL:', err);
            reject(err);
          } else {
            console.log('Created blob URL for preview:', fileName);
            resolve(url);
          }
        });
      });

    } catch (error) {
      console.error('Get file blob URL error:', error);
      throw error;
    }
  }

  // Get file info for streaming readiness
  async getFileInfo(torrent, fileName) {
    try {
      if (!torrent) {
        throw new Error('Torrent not found');
      }

      const file = torrent.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error('File not found in torrent');
      }

      return {
        name: file.name,
        length: file.length,
        downloaded: file.downloaded,
        progress: file.progress,
        canStream: file.downloaded > 0,
        streamable: file.length > 0 && file.downloaded > 0
      };

    } catch (error) {
      console.error('Get file info error:', error);
      throw error;
    }
  }

  // Delete torrent files from disk
  async deleteTorrentFiles(downloadPath, keepFiles) {
    if (keepFiles) {
      console.log('Skipping file deletion for seeding torrent');
      return true;
    }

    try {
      if (fs.existsSync(downloadPath)) {
        fs.rmSync(downloadPath, { recursive: true, force: true });
        console.log('Torrent files deleted successfully:', downloadPath);
        return true;
      } else {
        console.log('Torrent files not found (may have been moved/deleted):', downloadPath);
        return true;
      }
    } catch (fsError) {
      console.error('File deletion error:', fsError);
      return false;
    }
  }

  // Check if file exists on disk (for paused torrents)
  checkFileExists(filePath) {
    return fs.existsSync(filePath);
  }

  // Get file stats
  getFileStats(filePath) {
    try {
      return fs.statSync(filePath);
    } catch (error) {
      console.error('Error getting file stats:', error);
      return null;
    }
  }

  // Create file-like object for paused torrents
  createFileObject(filePath, fileName) {
    const stats = this.getFileStats(filePath);
    if (!stats) {
      return null;
    }

    return {
      name: fileName,
      length: stats.size,
      downloaded: stats.size, // Assume fully downloaded if file exists
      createReadStream: (options) => {
        return fs.createReadStream(filePath, options);
      }
    };
  }
}

export default FileOperations; 