<script>
  import { Download, Play, Pause, Trash2, ExternalLink, ChevronDown, ChevronRight, AlertCircle, CheckCircle } from 'lucide-svelte';
  
  export let torrent;
  export let onPause = () => {};
  export let onResume = () => {};
  export let onRemove = () => {};
  export let onDownloadFile = () => {};
  export let addLog = () => {};

  let filesExpanded = false;

  function toggleFiles() {
    filesExpanded = !filesExpanded;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatSpeed(bytesPerSecond) {
    return formatBytes(bytesPerSecond) + '/s';
  }

  function formatTimeRemaining(eta) {
    if (!eta || eta === Infinity) return '';
    
    const hours = Math.floor(eta / 3600);
    const minutes = Math.floor((eta % 3600) / 60);
    const seconds = Math.floor(eta % 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'downloading': return { icon: Download, color: 'text-blue-600' };
      case 'paused': return { icon: Pause, color: 'text-gray-600' };
      case 'completed': return { icon: CheckCircle, color: 'text-green-600' };
      case 'error': return { icon: AlertCircle, color: 'text-red-600' };
      default: return { icon: Download, color: 'text-gray-600' };
    }
  }

  function getFileIcon(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    
    if (videoExtensions.includes(ext)) return '🎬';
    if (audioExtensions.includes(ext)) return '🎵';
    if (imageExtensions.includes(ext)) return '🖼️';
    return '📄';
  }

  function handlePause() {
    onPause(torrent);
    addLog(`Paused torrent: ${torrent.name}`, 'info');
  }

  function handleResume() {
    onResume(torrent);
    addLog(`Resumed torrent: ${torrent.name}`, 'info');
  }

  function handleRemove() {
    if (confirm(`Remove "${torrent.name}"? This will delete the downloaded files.`)) {
      onRemove(torrent);
      addLog(`Removed torrent: ${torrent.name}`, 'info');
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(torrent.magnetUri);
    addLog('Magnet link copied to clipboard', 'success');
  }

  function handleDownloadFile(file) {
    onDownloadFile(torrent, file);
  }

  $: statusInfo = getStatusIcon(torrent.status);
  $: progressPercent = Math.round(torrent.progress * 100);
  $: hasFiles = torrent.files && torrent.files.length > 0;
</script>

<!-- List-style torrent row -->
<div class="torrent-row">
  <!-- Main torrent info row -->
  <div class="torrent-main">
    <!-- Status icon and name -->
    <div class="torrent-info">
      <svelte:component 
        this={statusInfo.icon} 
        size={14} 
        class="{statusInfo.color} flex-shrink-0" 
      />
      <div class="torrent-details">
        <div class="torrent-name" title={torrent.name}>
          {torrent.name}
        </div>
        <div class="torrent-stats">
          {#if torrent.status === 'downloading'}
            {progressPercent}% • ↓ {formatSpeed(torrent.downloadSpeed)} ↑ {formatSpeed(torrent.uploadSpeed)} • {torrent.peers} peers
          {:else if torrent.status === 'completed'}
            Completed • {formatBytes(torrent.downloaded)}
          {:else if torrent.status === 'paused'}
            Paused • {progressPercent}%
          {:else if torrent.status === 'error'}
            Error: {torrent.error || 'Unknown error'}
          {/if}
        </div>
      </div>
    </div>

    <!-- Progress bar (for downloading/completed torrents) -->
    {#if torrent.status === 'downloading' || torrent.status === 'completed'}
      <div class="progress-container">
        <div class="progress-bar">
          <div 
            class="progress-fill {torrent.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}"
            style="width: {progressPercent}%"
          ></div>
        </div>
        <div class="progress-text">{progressPercent}%</div>
      </div>
    {/if}

    <!-- Action buttons -->
    <div class="torrent-actions">
      {#if torrent.status === 'downloading'}
        <button 
          class="action-btn"
          on:click={handlePause}
          title="Pause"
        >
          <Pause size={12} />
        </button>
      {:else if torrent.status === 'paused' || torrent.status === 'error'}
        <button 
          class="action-btn action-play"
          on:click={handleResume}
          title="Resume"
        >
          <Play size={12} />
        </button>
      {/if}
      
      <button 
        class="action-btn"
        on:click={handleCopyLink}
        title="Copy magnet link"
      >
        <ExternalLink size={12} />
      </button>
      
      <button 
        class="action-btn action-remove"
        on:click={handleRemove}
        title="Remove torrent"
      >
        <Trash2 size={12} />
      </button>

      <!-- Files toggle (if has files) -->
      {#if hasFiles}
        <button 
          class="action-btn"
          on:click={toggleFiles}
          title="Toggle files"
        >
          <svelte:component 
            this={filesExpanded ? ChevronDown : ChevronRight} 
            size={12}
          />
        </button>
      {/if}
    </div>
  </div>

  <!-- Expandable files section -->
  {#if hasFiles && filesExpanded}
    <div class="files-section">
      {#each torrent.files as file, index (file.name)}
        <div class="file-row">
          <div class="file-info">
            <span class="file-icon">{getFileIcon(file.name)}</span>
            <div class="file-details">
              <div class="file-name" title={file.name}>{file.name}</div>
              <div class="file-size">{formatBytes(file.length)}</div>
            </div>
          </div>
          
          {#if torrent.progress > 0}
            <button 
              class="download-btn"
              on:click={() => handleDownloadFile(file)}
              disabled={torrent.progress < 0.01}
              title="Download file"
            >
              <Download size={10} />
              Save
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .torrent-row {
    border-bottom: 1px solid #e5e7eb;
    background: white;
    transition: background-color 0.1s ease;
  }

  .torrent-row:hover {
    background: #f9fafb;
  }

  .torrent-main {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
  }

  .torrent-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .torrent-details {
    min-width: 0;
    flex: 1;
  }

  .torrent-name {
    font-size: 13px;
    font-weight: 500;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .torrent-stats {
    font-size: 11px;
    color: #6b7280;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
  }

  .progress-bar {
    width: 60px;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 10px;
    color: #6b7280;
    font-weight: 500;
    min-width: 32px;
    text-align: right;
  }

  .torrent-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.1s ease;
  }

  .action-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .action-btn.action-play:hover {
    background: #dbeafe;
    color: #2563eb;
  }

  .action-btn.action-remove:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .files-section {
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
    padding: 8px 16px 8px 40px;
  }

  .file-row {
    display: flex;
    align-items: center;
    justify-between;
    padding: 4px 0;
    gap: 8px;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .file-icon {
    font-size: 12px;
    flex-shrink: 0;
  }

  .file-details {
    min-width: 0;
    flex: 1;
  }

  .file-name {
    font-size: 11px;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .file-size {
    font-size: 10px;
    color: #9ca3af;
  }

  .download-btn {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 2px;
    transition: background-color 0.1s ease;
    flex-shrink: 0;
  }

  .download-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .download-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
</style>