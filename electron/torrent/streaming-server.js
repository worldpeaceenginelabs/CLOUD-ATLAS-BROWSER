import http from 'http';
import url from 'url';
import path from 'path';
import fs from 'fs';

class StreamingServer {
  constructor() {
    this.httpServer = null;
    this.httpPort = 18080;
  }

  // Start local HTTP server for streaming
  start() {
    if (this.httpServer) return;
    
    this.httpServer = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const match = parsedUrl.pathname.match(/^\/stream\/([a-zA-Z0-9]+)\/(.+)$/);
      
      if (match) {
        const infoHash = match[1].toLowerCase();
        const fileName = decodeURIComponent(match[2]);
        
        console.log(`Stream request: ${infoHash} - ${fileName}`);
        
        // Delegate to handler
        this.handleStreamRequest(req, res, infoHash, fileName);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('Not found');
      }
    });
    
    this.httpServer.listen(this.httpPort, '127.0.0.1', () => {
      console.log(`Torrent HTTP server running at http://127.0.0.1:${this.httpPort}`);
    });
  }

  // Handle streaming request
  handleStreamRequest(req, res, infoHash, fileName) {
    // This will be called by the main torrent manager with the appropriate torrent data
    // For now, we'll provide a placeholder that can be overridden
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Stream handler not configured');
  }

  // Set the stream handler function
  setStreamHandler(handler) {
    this.handleStreamRequest = handler;
  }

  // Simple MIME type detection
  getMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv'].includes(ext)) return 'video/mp4';
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio/mpeg';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    if (ext === 'srt') return 'text/plain';
    return 'application/octet-stream';
  }

  // Handle HTTP Range requests
  handleRangeRequest(req, res, file, fileName) {
    const range = req.headers.range;
    const fileLength = file.length;
    let start = 0;
    let end = fileLength - 1;
    
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1], 10);
        if (match[2]) end = parseInt(match[2], 10);
      }
    }
    
    if (start > end || start < 0 || end >= fileLength) {
      res.writeHead(416, { 'Content-Range': `bytes */${fileLength}`, 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    
    const headers = {
      'Content-Type': this.getMimeType(fileName),
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    };
    
    // Only add Content-Range header if this is a range request
    if (range) {
      headers['Content-Range'] = `bytes ${start}-${end}/${fileLength}`;
    }
    
    res.writeHead(range ? 206 : 200, headers);
    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
    stream.on('error', err => {
      console.error(`Stream error for ${fileName}:`, err);
      res.end();
    });
  }

  // Stop the HTTP server
  stop() {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
      console.log('Torrent HTTP server stopped');
    }
  }

  // Get the server port
  getPort() {
    return this.httpPort;
  }
}

export default StreamingServer; 