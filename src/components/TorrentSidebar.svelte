<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { Pause, Play, ExternalLink, Trash2, ChevronDown, ChevronRight, Folder, Volume2, VolumeX, Maximize2, Minimize2, X } from 'lucide-svelte';
  import { torrentStore } from '../stores/torrentStore.js';
  import { persistenceStore } from '../stores/persistenceStore.js';

  export let addLog = () => {};

  let torrents = [];
  let sidebarOpen = false;
  let sidebarWidth = 500;
  let resizing = false;
  let sidebarElement;

  // Media Player State
  let mediaPlayerOpen = false;
  let currentMediaFile = null;
  let currentTorrent = null;
  let videoElement;
  let audioElement;
  let isPlaying = false;
  let isMuted = false;
  let volume = 1.0;
  let currentTime = 0;
  let duration = 0;
  let isFullscreen = false;

  let downloadingTorrents = [];
  let sharingTorrents = [];

  // Subscribe to torrent store
  const unsubscribe = torrentStore.subscribe(state => {
    torrents = state.torrents;
    sidebarOpen = state.sidebarOpen;
    sidebarWidth = state.sidebarWidth;
    downloadingTorrents = torrents.filter(t => t.torrentType === 'downloading');
    sharingTorrents = torrents.filter(t => t.torrentType === 'sharing');
  });

  // Reactive statement to ensure fullscreen state is always current
  $: {
    // This will run whenever the component updates, ensuring fullscreen state is current
    if (typeof document !== 'undefined') {
      const fullscreenElement = document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement;
      isFullscreen = !!fullscreenElement;
    }
  }

  onMount(async () => {
    try {
      const savedSidebarOpen = await persistenceStore.loadUIState('sidebarOpen', false);
      const savedSidebarWidth = await persistenceStore.loadUIState('sidebarWidth', 600);
      
      torrentStore.setSidebarOpen(savedSidebarOpen);
      torrentStore.setSidebarWidth(savedSidebarWidth);
      
      // Notify main process about initial sidebar state
      if (window.electronAPI) {
        window.electronAPI.updateSidebarState(savedSidebarOpen, savedSidebarWidth);
      }
      
      // Initialize fullscreen state
      updateFullscreenState();
      
      // Load saved torrents
      const savedTorrents = await persistenceStore.loadTorrents();
      for (const torrent of savedTorrents) {
        // Check for duplicates before adding
        if (!torrentStore.torrentExists(torrent.magnetUri)) {
          torrentStore.addTorrent(torrent.magnetUri, torrent);
        }
        // Always re-add to WebTorrent client
        if (window.electronAPI) {
          await window.electronAPI.addTorrent(torrent.magnetUri);
          if (torrent.status === 'paused') {
            await window.electronAPI.pauseTorrent(torrent.magnetUri);
          }
        }
        // Update store with restored state
        torrentStore.updateTorrent(torrent.infoHash, {
          name: torrent.name,
          status: torrent.status,
          files: torrent.files,
          dateAdded: new Date(torrent.dateAdded),
          actualDownloadPath: torrent.actualDownloadPath
        });
      }
      if (savedTorrents.length > 0) {
        addLog(`Restored ${savedTorrents.length} torrents from previous session`, 'info');
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
      addLog('Failed to restore previous session data', 'warning');
    }

    setupResizeHandlers();
    setupFullscreenDetection();
  });

  onDestroy(() => {
    unsubscribe();
    if (persistenceStore) {
      persistenceStore.saveUIState('sidebarOpen', sidebarOpen);
      persistenceStore.saveUIState('sidebarWidth', sidebarWidth);
    }
    
    // Cleanup fullscreen detection
    document.removeEventListener('fullscreenchange', updateFullscreenState);
    document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    document.removeEventListener('mozfullscreenchange', updateFullscreenState);
    document.removeEventListener('MSFullscreenChange', updateFullscreenState);
  });

  function setupResizeHandlers() {
    let startX = 0;
    let startWidth = 0;

    function handleMouseDown(e) {
      resizing = true;
      startX = e.clientX;
      startWidth = sidebarWidth;
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    function handleMouseMove(e) {
      if (!resizing) return;
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(250, Math.min(600, startWidth + deltaX));
      torrentStore.setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      resizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistenceStore.saveUIState('sidebarWidth', sidebarWidth);
    }

    const resizeHandle = sidebarElement?.querySelector('.resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }
  }

  async function handlePauseTorrent(torrent) {
    try {
      // Prevent duplicate saves if already paused
      if (torrent.status === 'paused') {
        addLog(`Already paused: ${torrent.name}`, 'info');
        return;
      }
      
      if (window.electronAPI) {
        const success = await window.electronAPI.pauseTorrent(torrent.magnetUri);
        if (success) {
          torrentStore.pauseTorrent(torrent.infoHash);
          // Only save if status actually changed
          if (torrent.status !== 'paused') {
            await persistenceStore.saveTorrent({ ...torrent, status: 'paused' }, false);
          }
          addLog(`Paused: ${torrent.name}`, 'info');
        } else {
          addLog(`Failed to pause: ${torrent.name}`, 'error');
        }
      }
    } catch (error) {
      addLog(`Error pausing torrent: ${error.message}`, 'error');
    }
  }

  async function handleResumeTorrent(torrent) {
    try {
      // Prevent duplicate saves if already downloading
      if (torrent.status === 'downloading') {
        addLog(`Already downloading: ${torrent.name}`, 'info');
        return;
      }
      
      if (window.electronAPI) {
        const torrentInfo = await window.electronAPI.addTorrent(torrent.magnetUri);
        if (torrentInfo) {
          torrentStore.resumeTorrent(torrent.infoHash);
          // Only save if status actually changed
          if (torrent.status !== 'downloading') {
            await persistenceStore.saveTorrent({ ...torrent, status: 'downloading' }, false);
          }
          addLog(`Resumed: ${torrent.name}`, 'info');
        } else {
          addLog(`Failed to resume: ${torrent.name}`, 'error');
        }
      }
    } catch (error) {
      addLog(`Error resuming torrent: ${error.message}`, 'error');
    }
  }

  async function handleRemoveTorrent(torrent) {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.removeTorrent(torrent.magnetUri);
        if (success) {
          torrentStore.removeTorrent(torrent.infoHash);
          await persistenceStore.removeTorrent(torrent.infoHash);
          addLog(`Removed: ${torrent.name}`, 'info');
        } else {
          addLog(`Failed to remove: ${torrent.name}`, 'error');
        }
      }
    } catch (error) {
      addLog(`Error removing torrent: ${error.message}`, 'error');
    }
  }

  async function handleDownloadFile(torrent, file) {
    try {
      if (window.electronAPI) {
        const savePath = await window.electronAPI.downloadFile(torrent.magnetUri, file.name);
        if (savePath) {
          addLog(`File saved: ${file.name}`, 'success');
        }
      }
    } catch (error) {
      addLog(`Download error: ${error.message}`, 'error');
    }
  }

  function handleCopyMagnet(torrent) {
    navigator.clipboard.writeText(torrent.magnetUri);
    addLog('Magnet link copied to clipboard', 'success');
  }

  function toggleFiles(torrent) {
    torrent.filesExpanded = !torrent.filesExpanded;
    torrents = [...torrents];
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

  // Media Player Functions
  function toggleMediaPlayer() {
    mediaPlayerOpen = !mediaPlayerOpen;
    if (!mediaPlayerOpen) {
      stopMedia();
    }
  }

  function stopMedia() {
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
    }
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    isPlaying = false;
    currentMediaFile = null;
    currentTorrent = null;
  }

  async function streamMediaFile(torrent, file) {
    try {
      // Check if file has any progress
      if (torrent.progress === 0) {
        addLog(`Cannot stream: ${file.name} - not yet downloaded`, 'warning');
        return;
      }
      
      stopMedia();
      currentTorrent = torrent;
      currentMediaFile = file;
      mediaPlayerOpen = true;
      
      // Wait for the next tick to ensure DOM elements are rendered
      await tick();
      
      addLog(`Starting stream: ${file.name}`, 'info');
      // Use local HTTP server URL
      const url = `http://127.0.0.1:18080/stream/${torrent.infoHash}/${encodeURIComponent(file.name)}`;
      const isVideo = file.name.match(/\.(mp4|webm|avi|mkv|mov|flv)$/i);
      const isAudio = file.name.match(/\.(mp3|wav|flac|ogg|m4a|aac)$/i);
      
      if (isVideo) {
        if (videoElement) {
          videoElement.src = url;
          videoElement.style.display = 'block';
          if (audioElement) audioElement.style.display = 'none';
          addLog(`Video streaming: ${file.name}`, 'success');
        } else {
          addLog(`Video element not available`, 'error');
        }
      } else if (isAudio) {
        if (audioElement) {
          audioElement.src = url;
          audioElement.style.display = 'block';
          if (videoElement) videoElement.style.display = 'none';
          addLog(`Audio streaming: ${file.name}`, 'success');
        } else {
          addLog(`Audio element not available`, 'error');
        }
      } else {
        addLog(`Unsupported media format: ${file.name}`, 'warning');
      }
    } catch (error) {
      console.error('Streaming error:', error);
      addLog(`Streaming error: ${error.message}`, 'error');
    }
  }

  async function previewImage(torrent, file) {
    try {
      // Check if file has any progress
      if (torrent.progress === 0) {
        addLog(`Cannot preview: ${file.name} - not yet downloaded`, 'warning');
        return;
      }
      
      addLog(`Loading preview: ${file.name}`, 'info');
      // Use local HTTP server URL
      const url = `http://127.0.0.1:18080/stream/${torrent.infoHash}/${encodeURIComponent(file.name)}`;
      
      // Open in new Electron tab instead of Chrome browser
      if (window.electronAPI) {
        window.electronAPI.createNewTabWithUrl(url);
        addLog(`Preview opened in new tab: ${file.name}`, 'success');
      } else {
        // Fallback to window.open if Electron API not available
        window.open(url, '_blank');
        addLog(`Preview opened: ${file.name}`, 'success');
      }
    } catch (error) {
      console.error('Preview error:', error);
      addLog(`Preview error: ${error.message}`, 'error');
    }
  }

  function togglePlayPause() {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      if (isPlaying) {
        mediaElement.pause();
      } else {
        mediaElement.play();
      }
      isPlaying = !isPlaying;
    }
  }

  function toggleMute() {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      mediaElement.muted = !isMuted;
      isMuted = !isMuted;
    }
  }

  function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      mediaElement.volume = volume;
    }
  }

  function toggleFullscreen() {
    const mediaElement = videoElement || audioElement;
    if (!mediaElement) return;

    if (!isFullscreen) {
      if (mediaElement.requestFullscreen) {
        mediaElement.requestFullscreen();
      } else if (mediaElement.webkitRequestFullscreen) {
        mediaElement.webkitRequestFullscreen();
      } else if (mediaElement.mozRequestFullScreen) {
        mediaElement.mozRequestFullScreen();
      } else if (mediaElement.msRequestFullscreen) {
        mediaElement.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  function updateProgress() {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      currentTime = mediaElement.currentTime;
      duration = mediaElement.duration || 0;
    }
  }

  function seekTo(time) {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement && !isNaN(time)) {
      mediaElement.currentTime = time;
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getFileIcon(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    
    if (videoExtensions.includes(ext)) return '🎬';
    if (audioExtensions.includes(ext)) return '🎵';
    if (imageExtensions.includes(ext)) return '🖼️';
    return '📄';
  }

  function isStreamableFile(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'];
    return videoExtensions.includes(ext) || audioExtensions.includes(ext);
  }

  function isPreviewableFile(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    return imageExtensions.includes(ext);
  }

  function canStreamFile(torrent, file) {
    return torrent.progress > 0 && isStreamableFile(file.name);
  }

  function canPreviewFile(torrent, file) {
    return torrent.progress > 0 && isPreviewableFile(file.name);
  }

  // Calculate total stats
  $: totalStats = torrents.reduce((acc, torrent) => {
    acc.downloading += torrent.status === 'downloading' ? 1 : 0;
    acc.paused += torrent.status === 'paused' ? 1 : 0;
    acc.completed += torrent.status === 'completed' ? 1 : 0;
    acc.totalDownloadSpeed += torrent.downloadSpeed || 0;
    acc.totalUploadSpeed += torrent.uploadSpeed || 0;
    return acc;
  }, { downloading: 0, paused: 0, completed: 0, totalDownloadSpeed: 0, totalUploadSpeed: 0 });

  function updateFullscreenState() {
    const fullscreenElement = document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement;
    
    isFullscreen = !!fullscreenElement;
    console.log('Fullscreen state updated:', isFullscreen);
  }

  function setupFullscreenDetection() {
    // Listen for all fullscreen change events
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener('mozfullscreenchange', updateFullscreenState);
    document.addEventListener('MSFullscreenChange', updateFullscreenState);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
      document.removeEventListener('mozfullscreenchange', updateFullscreenState);
      document.removeEventListener('MSFullscreenChange', updateFullscreenState);
    };
  }
</script>

{#if sidebarOpen}
  <!-- Sidebar -->
  <div 
    bind:this={sidebarElement}
    class="sidebar"
    style="width: {sidebarWidth}px"
  >
    <!-- Resize Handle -->
    <div class="resize-handle"></div>

    <!-- Header -->
    <div class="header">
      <h2>Torrents</h2>
      {#if torrents.length > 0}
        <div class="stats">
          <span>Total: {torrents.length}</span>
          {#if totalStats.totalDownloadSpeed > 0}
            <span>↓ {formatSpeed(totalStats.totalDownloadSpeed)}</span>
          {/if}
          {#if totalStats.totalUploadSpeed > 0}
            <span>↑ {formatSpeed(totalStats.totalUploadSpeed)}</span>
          {/if}
          {#if totalStats.downloading > 0}
            <span>{totalStats.downloading} Active</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Media Player Section -->
    <div class="media-player-section">
      <div class="media-player-header" on:click={toggleMediaPlayer}>
        <div class="media-player-title">
          {#if currentMediaFile}
            <span class="media-icon">🎬</span>
            <span class="media-name">{currentMediaFile.name}</span>
          {:else}
            <span class="media-icon">📺</span>
            <span class="media-name">Media Player</span>
          {/if}
        </div>
        <button class="media-toggle-btn">
          {#if mediaPlayerOpen}
            <ChevronDown size={16} />
          {:else}
            <ChevronRight size={16} />
          {/if}
        </button>
      </div>

      {#if mediaPlayerOpen}
        <div class="media-player-content">
          <!-- Video Player -->
          <video 
            bind:this={videoElement}
            class="media-video"
            style="display: none;"
            on:timeupdate={updateProgress}
            on:loadedmetadata={updateProgress}
            on:ended={() => isPlaying = false}
            controls={false}
          ></video>

          <!-- Audio Player -->
          <audio 
            bind:this={audioElement}
            class="media-audio"
            style="display: none;"
            on:timeupdate={updateProgress}
            on:loadedmetadata={updateProgress}
            on:ended={() => isPlaying = false}
            controls={false}
          ></audio>

          <!-- Media Controls -->
          {#if currentMediaFile}
            <div class="media-controls">
              <!-- Progress Bar -->
              <div class="progress-bar-container">
                <input 
                  type="range" 
                  class="progress-slider"
                  min="0" 
                  max={duration || 0} 
                  value={currentTime}
                  on:input={(e) => seekTo(parseFloat(e.target.value))}
                />
                <div class="time-display">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <!-- Control Buttons -->
              <div class="control-buttons">
                <button class="control-btn" on:click={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                  {#if isPlaying}
                    <Pause size={16} />
                  {:else}
                    <Play size={16} />
                  {/if}
                </button>

                <button class="control-btn" on:click={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                  {#if isMuted}
                    <VolumeX size={16} />
                  {:else}
                    <Volume2 size={16} />
                  {/if}
                </button>

                <input 
                  type="range" 
                  class="volume-slider"
                  min="0" 
                  max="1" 
                  step="0.1"
                  value={volume}
                  on:input={(e) => setVolume(parseFloat(e.target.value))}
                  title="Volume"
                />

                <button class="control-btn" on:click={toggleFullscreen} title="Fullscreen">
                  {#if isFullscreen}
                    <Minimize2 size={16} />
                  {:else}
                    <Maximize2 size={16} />
                  {/if}
                </button>

                <button class="control-btn close-btn" on:click={stopMedia} title="Stop">
                  <X size={16} />
                </button>
              </div>
            </div>
          {:else}
            <div class="media-placeholder">
              <div class="placeholder-icon">🎬</div>
              <p>Select a media file to stream</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Downloading Section -->
      <h3>Downloading</h3>
      {#if downloadingTorrents.length === 0}
        <div class="empty-message">No active downloads</div>
      {:else}
        <!-- Table -->
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Progress</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {#each downloadingTorrents as torrent (torrent.id)}
              <!-- Main row -->
              <tr class="torrent-row">
                <td class="name-cell">
                  <div class="name-content">
                    {#if torrent.files && torrent.files.length > 0}
                      <button class="expand-btn" on:click={() => toggleFiles(torrent)}>
                        {#if torrent.filesExpanded}
                          <ChevronDown size={14} />
                        {:else}
                          <ChevronRight size={14} />
                        {/if}
                      </button>
                    {:else}
                      <div class="expand-spacer"></div>
                    {/if}
                    <span class="name-text" title={torrent.name}>{torrent.name}</span>
                  </div>
                </td>
                
                <td class="state-cell">
                  <span class="state-badge state-{torrent.status}">
                    {torrent.torrentType === 'sharing' && torrent.status === 'downloading'
                      ? 'Sharing'
                      : torrent.status === 'downloading' ? 'Downloading'
                      : torrent.status === 'paused' ? 'Paused'
                      : torrent.status === 'completed' ? 'Completed'
                      : 'Error'}
                  </span>
                </td>
                
                <td class="progress-cell">
                  <div class="progress-container">
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: {Math.round(torrent.progress * 100)}%"></div>
                    </div>
                    <span class="progress-text">{Math.round(torrent.progress * 100)}%</span>
                  </div>
                  {#if torrent.status === 'downloading'}
                    <div class="speed-text">↓ {formatSpeed(torrent.downloadSpeed)} • {torrent.peers} peers</div>
                  {/if}
                </td>
                
                <td class="controls-cell">
                  <div class="controls">
                    {#if torrent.status === 'downloading'}
                      <button class="control-btn pause-btn" on:click={() => handlePauseTorrent(torrent)} title="Pause">
                        <Pause size={16} />
                      </button>
                    {:else if torrent.status === 'paused'}
                      <button class="control-btn play-btn" on:click={() => handleResumeTorrent(torrent)} title="Resume">
                        <Play size={16} />
                      </button>
                    {/if}
                    
                    <button class="control-btn copy-btn" on:click={() => handleCopyMagnet(torrent)} title="Copy magnet">
                      <ExternalLink size={16} />
                    </button>
                    
                    <button class="control-btn remove-btn" on:click={() => {if(confirm('Remove?')) handleRemoveTorrent(torrent);}} title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Files row -->
              {#if torrent.filesExpanded && torrent.files}
                <tr class="files-row">
                  <td colspan="4" class="files-cell">
                    <div class="files-container">
                      {#each torrent.files as file}
                        <div class="file-item">
                          <span class="file-icon">{getFileIcon(file.name)}</span>
                          <span class="file-name">{file.name}</span>
                          <span class="file-size">{formatBytes(file.length)}</span>
                          <div class="file-actions">
                            {#if torrent.progress > 0}
                              <!-- Video/Audio Stream Button -->
                              {#if isStreamableFile(file.name)}
                                <button 
                                  class="file-btn stream-btn {!canStreamFile(torrent, file) ? 'disabled' : ''}" 
                                  on:click={() => canStreamFile(torrent, file) && streamMediaFile(torrent, file)}
                                  title={canStreamFile(torrent, file) ? 'Stream' : 'Not ready for streaming'}
                                  disabled={!canStreamFile(torrent, file)}
                                >
                                  🎬 Stream
                                </button>
                              {/if}
                              
                              <!-- Image Preview Button -->
                              {#if isPreviewableFile(file.name)}
                                <button 
                                  class="file-btn preview-btn {!canPreviewFile(torrent, file) ? 'disabled' : ''}" 
                                  on:click={() => canPreviewFile(torrent, file) && previewImage(torrent, file)}
                                  title={canPreviewFile(torrent, file) ? 'Preview' : 'Not ready for preview'}
                                  disabled={!canPreviewFile(torrent, file)}
                                >
                                  👁️ Preview
                                </button>
                              {/if}
                              
                              <!-- Save Button (for all files) -->
                              <button 
                                class="file-btn save-btn" 
                                on:click={() => handleDownloadFile(torrent, file)}
                                title="Save to disk"
                              >
                                <Folder size={12} />
                                Save
                              </button>
                            {:else}
                              <span class="file-status">Waiting for download...</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      {/if}

      <!-- Sharing Section -->
      <h3>Sharing</h3>
      {#if sharingTorrents.length === 0}
        <div class="empty-message">No active shares</div>
      {:else}
        <!-- Table -->
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Progress</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {#each sharingTorrents as torrent (torrent.id)}
              <!-- Main row -->
              <tr class="torrent-row">
                <td class="name-cell">
                  <div class="name-content">
                    {#if torrent.files && torrent.files.length > 0}
                      <button class="expand-btn" on:click={() => toggleFiles(torrent)}>
                        {#if torrent.filesExpanded}
                          <ChevronDown size={14} />
                        {:else}
                          <ChevronRight size={14} />
                        {/if}
                      </button>
                    {:else}
                      <div class="expand-spacer"></div>
                    {/if}
                    <span class="name-text" title={torrent.name}>{torrent.name}</span>
                  </div>
                </td>
                
                <td class="state-cell">
                  <span class="state-badge state-{torrent.status}">
                    {torrent.torrentType === 'sharing' && torrent.status === 'downloading'
                      ? 'Sharing'
                      : torrent.status === 'downloading' ? 'Downloading'
                      : torrent.status === 'paused' ? 'Paused'
                      : torrent.status === 'completed' ? 'Completed'
                      : 'Error'}
                  </span>
                </td>
                
                <td class="progress-cell">
                  <div class="progress-container">
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: {Math.round(torrent.progress * 100)}%"></div>
                    </div>
                    <span class="progress-text">{Math.round(torrent.progress * 100)}%</span>
                  </div>
                  {#if torrent.status === 'downloading'}
                    <div class="speed-text">↓ {formatSpeed(torrent.downloadSpeed)} • {torrent.peers} peers</div>
                  {/if}
                </td>
                
                <td class="controls-cell">
                  <div class="controls">
                    {#if torrent.status === 'downloading'}
                      <button class="control-btn pause-btn" on:click={() => handlePauseTorrent(torrent)} title="Pause">
                        <Pause size={16} />
                      </button>
                    {:else if torrent.status === 'paused'}
                      <button class="control-btn play-btn" on:click={() => handleResumeTorrent(torrent)} title="Resume">
                        <Play size={16} />
                      </button>
                    {/if}
                    
                    <button class="control-btn copy-btn" on:click={() => handleCopyMagnet(torrent)} title="Copy magnet">
                      <ExternalLink size={16} />
                    </button>
                    
                    <button class="control-btn remove-btn" on:click={() => {if(confirm('Remove?')) handleRemoveTorrent(torrent);}} title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Files row -->
              {#if torrent.filesExpanded && torrent.files}
                <tr class="files-row">
                  <td colspan="4" class="files-cell">
                    <div class="files-container">
                      {#each torrent.files as file}
                        <div class="file-item">
                          <span class="file-icon">{getFileIcon(file.name)}</span>
                          <span class="file-name">{file.name}</span>
                          <span class="file-size">{formatBytes(file.length)}</span>
                          <div class="file-actions">
                            {#if torrent.progress > 0}
                              <!-- Video/Audio Stream Button -->
                              {#if isStreamableFile(file.name)}
                                <button 
                                  class="file-btn stream-btn {!canStreamFile(torrent, file) ? 'disabled' : ''}" 
                                  on:click={() => canStreamFile(torrent, file) && streamMediaFile(torrent, file)}
                                  title={canStreamFile(torrent, file) ? 'Stream' : 'Not ready for streaming'}
                                  disabled={!canStreamFile(torrent, file)}
                                >
                                  🎬 Stream
                                </button>
                              {/if}
                              
                              <!-- Image Preview Button -->
                              {#if isPreviewableFile(file.name)}
                                <button 
                                  class="file-btn preview-btn {!canPreviewFile(torrent, file) ? 'disabled' : ''}" 
                                  on:click={() => canPreviewFile(torrent, file) && previewImage(torrent, file)}
                                  title={canPreviewFile(torrent, file) ? 'Preview' : 'Not ready for preview'}
                                  disabled={!canPreviewFile(torrent, file)}
                                >
                                  👁️ Preview
                                </button>
                              {/if}
                              
                              <!-- Save Button (for all files) -->
                              <button 
                                class="file-btn save-btn" 
                                on:click={() => handleDownloadFile(torrent, file)}
                                title="Save to disk"
                              >
                                <Folder size={12} />
                                Save
                              </button>
                            {:else}
                              <span class="file-status">Waiting for download...</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    background: var(--chrome-bg);
    border-left: 1px solid var(--chrome-border);
    z-index: 50;
    display: flex;
    flex-direction: column;
    margin-top: 84px; /* Tab + Address bar height */
    backdrop-filter: blur(10px);
  }

  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    background: transparent;
    cursor: col-resize;
    z-index: 10;
  }

  .resize-handle:hover {
    background: var(--chrome-blue);
  }

  .header {
    padding: 16px;
    border-bottom: 1px solid var(--chrome-border);
    background: rgba(255, 255, 255, 0.05);
    text-align: center;
    backdrop-filter: blur(10px);
  }

  .header h2 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--chrome-text);
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
  }

  .stats span {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--chrome-border);
    color: var(--chrome-text-secondary);
    backdrop-filter: blur(10px);
  }

  .content {
    flex: 1;
    overflow: auto;
    background: var(--chrome-bg);
  }

  /* Empty state */
  .empty {
    padding: 40px 16px;
    text-align: center;
    color: var(--chrome-text);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: var(--chrome-text-secondary);
  }

  .empty h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: var(--chrome-text);
  }

  .empty p {
    margin: 0 0 16px 0;
    color: var(--chrome-text-secondary);
    font-size: 14px;
  }

  .example {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    padding: 12px;
    text-align: left;
    border: 1px solid var(--chrome-border);
    backdrop-filter: blur(10px);
  }

  .example-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--chrome-text);
    margin-bottom: 4px;
  }

  .example code {
    display: block;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--chrome-border);
    border-radius: 4px;
    padding: 6px;
    font-size: 10px;
    word-break: break-all;
    line-height: 1.4;
    color: var(--chrome-text);
    backdrop-filter: blur(10px);
  }

  /* Table */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  thead {
    position: sticky;
    top: 0;
    background: rgba(255, 255, 255, 0.05);
    z-index: 5;
    backdrop-filter: blur(10px);
  }

  th {
    padding: 12px 8px;
    text-align: left;
    font-weight: 600;
    color: var(--chrome-text);
    border-bottom: 2px solid var(--chrome-border);
  }

  /* Column widths */
  th:nth-child(1) { width: 45%; }
  th:nth-child(2) { width: 18%; }
  th:nth-child(3) { width: 22%; }
  th:nth-child(4) { width: 15%; }

  .torrent-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .torrent-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  td {
    padding: 12px 8px;
    vertical-align: middle;
  }

  /* Name cell */
  .name-content {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .expand-btn {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: var(--chrome-text-secondary);
    border-radius: 2px;
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
  }

  .expand-spacer {
    width: 18px;
  }

  .name-text {
    font-weight: 500;
    color: var(--chrome-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* State cell */
  .state-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
  }

  .state-downloading {
    background: rgba(171, 214, 255, 0.2);
    color: var(--chrome-blue);
    border: 1px solid rgba(171, 214, 255, 0.3);
  }

  .state-paused {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text-secondary);
    border: 1px solid var(--chrome-border);
  }

  .state-completed {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .state-error {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Progress cell */
  .progress-container {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--chrome-blue);
    transition: width 0.3s;
  }

  .progress-text {
    font-size: 11px;
    color: var(--chrome-text-secondary);
    font-weight: 500;
    min-width: 32px;
  }

  .speed-text {
    font-size: 10px;
    color: var(--chrome-text-secondary);
    font-family: 'Courier New', monospace;
    min-width: 120px;
    display: inline-block;
  }

  /* Controls */
  .controls {
    display: flex;
    gap: 4px;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.1s;
    backdrop-filter: blur(10px);
    border: 1px solid var(--chrome-border);
  }

  .pause-btn:hover, .play-btn:hover {
    background: rgba(171, 214, 255, 0.2);
    color: var(--chrome-blue);
    border-color: rgba(171, 214, 255, 0.3);
  }

  .copy-btn:hover {
    background: rgba(171, 214, 255, 0.2);
    color: var(--chrome-blue);
    border-color: rgba(171, 214, 255, 0.3);
  }

  .remove-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  /* Files */
  .files-row {
    background: rgba(255, 255, 255, 0.02);
  }

  .files-container {
    padding: 8px 16px 8px 40px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 11px;
  }

  .file-icon {
    font-size: 14px;
    color: var(--chrome-text-secondary);
  }

  .file-name {
    flex: 1;
    color: var(--chrome-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: var(--chrome-text-secondary);
    min-width: 60px;
    text-align: right;
  }

  .file-actions {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .file-btn {
    background: var(--chrome-blue);
    color: white;
    border: none;
    border-radius: 3px;
    padding: 4px 8px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.1s;
    backdrop-filter: blur(10px);
  }

  .file-btn:hover:not(:disabled) {
    background: #8bc4ff;
  }

  .file-btn:disabled {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text-secondary);
    cursor: not-allowed;
    opacity: 0.6;
    border: 1px solid var(--chrome-border);
  }

  .file-btn.disabled {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text-secondary);
    cursor: not-allowed;
    opacity: 0.6;
    border: 1px solid var(--chrome-border);
  }

  .file-status {
    font-size: 10px;
    color: var(--chrome-text-secondary);
    font-style: italic;
  }

  .stream-btn {
    background: #10b981;
  }

  .stream-btn:hover:not(:disabled) {
    background: #059669;
  }

  .preview-btn {
    background: #f59e0b;
  }

  .preview-btn:hover:not(:disabled) {
    background: #d97706;
  }

  .save-btn {
    background: #6b7280;
  }

  .save-btn:hover:not(:disabled) {
    background: #4b5563;
  }

  /* Media Player Section */
  .media-player-section {
    padding: 16px;
    border-bottom: 1px solid var(--chrome-border);
    background: rgba(255, 255, 255, 0.02);
  }

  .media-player-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .media-player-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .media-icon {
    font-size: 16px;
    color: var(--chrome-text-secondary);
  }

  .media-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--chrome-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .media-toggle-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--chrome-text-secondary);
    border-radius: 4px;
    transition: all 0.1s;
  }

  .media-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
  }

  .media-player-content {
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-top: 8px;
    backdrop-filter: blur(10px);
    border: 1px solid var(--chrome-border);
  }

  .media-video, .media-audio {
    width: 100%;
    max-height: 200px;
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .media-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .progress-bar-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-slider {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    cursor: pointer;
  }

  .progress-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--chrome-blue);
    cursor: pointer;
  }

  .progress-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--chrome-blue);
    cursor: pointer;
    border: none;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--chrome-text-secondary);
  }

  .control-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.1s;
    backdrop-filter: blur(10px);
    border: 1px solid var(--chrome-border);
  }

  .control-btn:hover {
    background: rgba(171, 214, 255, 0.2);
    color: var(--chrome-blue);
    border-color: rgba(171, 214, 255, 0.3);
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .volume-slider {
    width: 60px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--chrome-text-secondary);
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--chrome-text-secondary);
    cursor: pointer;
    border: none;
  }

  .media-placeholder {
    text-align: center;
    padding: 32px 16px;
    color: var(--chrome-text-secondary);
  }

  .placeholder-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .media-placeholder p {
    margin: 0;
    font-size: 14px;
  }

  /* Responsive adjustments */
  @media (max-width: 400px) {
    .file-actions {
      flex-direction: column;
      gap: 2px;
    }
    
    .file-btn {
      font-size: 9px;
      padding: 2px 6px;
    }
    
    .media-name {
      max-width: 150px;
    }
  }
</style>