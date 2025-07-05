export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSecond) {
  return formatBytes(bytesPerSecond) + '/s';
}

export function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons = {
    // Video
    mp4: '🎬', webm: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬', flv: '🎬',
    // Audio
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', m4a: '🎵', aac: '🎵',
    // Images
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', webp: '🖼️',
    // Documents
    pdf: '📄', doc: '📄', docx: '📄', txt: '📄', rtf: '📄',
    // Archives
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
    // Code
    js: '💻', ts: '💻', py: '💻', java: '💻', cpp: '💻', c: '💻', html: '💻', css: '💻',
    // Default
    default: '📁'
  };
  return icons[ext] || icons.default;
}

export function isStreamableFile(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const streamableExtensions = ['mp4', 'webm', 'avi', 'mkv', 'mov', 'flv', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'];
  return streamableExtensions.includes(ext);
}

export function isPreviewableFile(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const previewableExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf', 'txt'];
  return previewableExtensions.includes(ext);
} 