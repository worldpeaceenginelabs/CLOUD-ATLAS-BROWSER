<script>
  import { onMount, onDestroy } from 'svelte';
  import { Download, X, Pause, Play, Activity, ExternalLink, Trash2, ChevronDown, ChevronRight } from 'lucide-svelte';
  import { torrentStore } from '../stores/torrentStore.js';
  import { persistenceStore } from '../stores/persistenceStore.js';

  export let addLog = () => {};

  let torrents = [];
  let sidebarOpen = false;
  let sidebarWidth = 350;
  let resizing = false;
  let sidebarElement;

  // Subscribe to torrent store
  const unsubscribe = torrentStore.subscribe(state => {
    torrents = state.torrents;
    sidebarOpen = state.sidebarOpen;
    sidebarWidth = state.sidebarWidth;
  });

  onMount(async () => {
    // Load persisted UI state
    try {
      const savedSidebarOpen = await persistenceStore.loadUIState('sidebarOpen', false);
      const savedSidebarWidth = await persistenceStore.loadUIState('sidebarWidth', 350);
      
      torrentStore.setSidebarOpen(savedSidebarOpen);
      torrentStore.setSidebarWidth(savedSidebarWidth);
      
      // Load persisted torrents
      const savedTorrents = await persistenceStore.loadTorrents();
      savedTorrents.forEach(torrent => {
        torrentStore.addTorrent(torrent.magnetUri, torrent);
        // Update the added torrent with saved state
        torrentStore.updateTorrent(torrent.id, {
          name: torrent.name,
          status: torrent.status,
          files: torrent.files,
          dateAdded: new Date(torrent.dateAdded)
        });
      });

      if (savedTorrents.length > 0) {
        addLog(`Restored ${savedTorrents.length} torrents from previous session`, 'info');
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
      addLog('Failed to restore previous session data', 'warning');
    }

    // Set up resize event listeners
    setupResizeHandlers();
  });

  onDestroy(() => {
    unsubscribe();
    // Save UI state on component destroy
    if (persistenceStore) {
      persistenceStore.saveUIState('sidebarOpen', sidebarOpen);
      persistenceStore.saveUIState('sidebarWidth', sidebarWidth);
    }
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
      
      const deltaX = startX - e.clientX; // Subtract because sidebar is on the right
      const newWidth = Math.max(250, Math.min(600, startWidth + deltaX));
      
      torrentStore.setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      resizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save new width
      persistenceStore.saveUIState('sidebarWidth', sidebarWidth);
    }

    // Attach resize handle
    const resizeHandle = sidebarElement?.querySelector('.resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }
  }

  function closeSidebar() {
    // Remove this function - we only toggle via three-dot button
  }

  async function handlePauseTorrent(torrent) {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.pauseTorrent(torrent.magnetUri);
        if (success) {
          torrentStore.pauseTorrent(torrent.id);
          await persistenceStore.saveTorrent({ ...torrent, status: 'paused' });
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
      if (window.electronAPI) {
        const torrentInfo = await window.electronAPI.addTorrent(torrent.magnetUri);
        if (torrentInfo) {
          torrentStore.resumeTorrent(torrent.id);
          await persistenceStore.saveTorrent({ ...torrent, status: 'downloading' });
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
          torrentStore.removeTorrent(torrent.id);
          await persistenceStore.removeTorrent(torrent.id);
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

  // Calculate total stats
  $: totalStats = torrents.reduce((acc, torrent) => {
    acc.downloading += torrent.status === 'downloading' ? 1 : 0;
    acc.paused += torrent.status === 'paused' ? 1 : 0;
    acc.completed += torrent.status === 'completed' ? 1 : 0;
    acc.totalDownloadSpeed += torrent.downloadSpeed || 0;
    acc.totalUploadSpeed += torrent.uploadSpeed || 0;
    return acc;
  }, { downloading: 0, paused: 0, completed: 0, totalDownloadSpeed: 0, totalUploadSpeed: 0 });

  // Check for mobile screen
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
</script>

{#if sidebarOpen}
  <!-- Mobile overlay -->
  {#if isMobile}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 z-40"
      on:click={closeSidebar}
    ></div>
  {/if}

  <!-- Sidebar -->
  <div 
    bind:this={sidebarElement}
    class="fixed top-0 right-0 h-full bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col {isMobile ? 'w-full' : ''}"
    style="{!isMobile ? `width: ${sidebarWidth}px` : ''}"
  >
    <!-- Resize Handle (desktop only) -->
    {#if !isMobile}
      <div 
        class="resize-handle absolute left-0 top-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-500 transition-colors z-10"
        class:resizing
      ></div>
    {/if}

    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200 {isMobile ? 'mt-20' : 'mt-24'}">
      <div class="flex items-center gap-2">
        <Download size={20} class="text-blue-600" />
        <h2 class="text-lg font-semibold text-gray-900">Torrents</h2>
        {#if torrents.length > 0}
          <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
            {torrents.length}
          </span>
        {/if}
      </div>
    </div>

    <!-- Stats Header -->
    {#if torrents.length > 0 && (totalStats.totalDownloadSpeed > 0 || totalStats.totalUploadSpeed > 0)}
      <div class="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <div class="flex items-center gap-4 text-sm">
          <div class="flex items-center gap-1">
            <Activity size={14} class="text-blue-600" />
            <span class="text-blue-700">
              ↓ {formatSpeed(totalStats.totalDownloadSpeed)}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Activity size={14} class="text-green-600" />
            <span class="text-green-700">
              ↑ {formatSpeed(totalStats.totalUploadSpeed)}
            </span>
          </div>
        </div>
        
        {#if totalStats.downloading > 0 || totalStats.paused > 0}
          <div class="flex gap-4 mt-1 text-xs text-gray-600">
            {#if totalStats.downloading > 0}
              <span>{totalStats.downloading} downloading</span>
            {/if}
            {#if totalStats.paused > 0}
              <span>{totalStats.paused} paused</span>
            {/if}
            {#if totalStats.completed > 0}
              <span>{totalStats.completed} completed</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Torrent List -->
    <div class="flex-1 overflow-y-auto">
      {#if torrents.length === 0}
        <!-- Empty State -->
        <div class="empty-state">
          <Download size={32} class="text-gray-300 mx-auto mb-3" />
          <h3 class="text-sm font-medium text-gray-900 mb-2">No torrents yet</h3>
          <p class="text-gray-500 text-xs mb-3">
            Paste a magnet link in the address bar to start downloading
          </p>
          
          <!-- Example -->
          <div class="example-box">
            <div class="text-xs font-medium text-gray-700 mb-1">Example:</div>
            <code class="example-code">
              magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny
            </code>
          </div>
        </div>
      {:else}
        <!-- Torrent List -->
        <div class="torrent-list">
          {#each torrents as torrent (torrent.id)}
            <div class="torrent-item" class:expanded={torrent.filesExpanded}>
              <div class="torrent-row">
                <!-- Status Icon -->
                <div class="status-icon">
                  {#if torrent.status === 'downloading'}
                    <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {:else if torrent.status === 'paused'}
                    <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                  {:else if torrent.status === 'completed'}
                    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                  {:else}
                    <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                  {/if}
                </div>

                <!-- Torrent Info -->
                <div class="torrent-info">
                  <div class="torrent-name">{torrent.name}</div>
                  <div class="torrent-meta">
                    {#if torrent.status === 'downloading'}
                      {Math.round(torrent.progress * 100)}% • {formatSpeed(torrent.downloadSpeed)} • {torrent.peers} peers
                    {:else if torrent.status === 'completed'}
                      Completed • {formatBytes(torrent.downloaded)}
                    {:else if torrent.status === 'paused'}
                      Paused • {Math.round(torrent.progress * 100)}%
                    {:else}
                      Error
                    {/if}
                  </div>
                </div>

                <!-- Progress -->
                {#if torrent.status === 'downloading' || torrent.status === 'completed'}
                  <div class="progress-mini">
                    <div class="progress-bar-mini">
                      <div 
                        class="progress-fill-mini"
                        style="width: {Math.round(torrent.progress * 100)}%"
                      ></div>
                    </div>
                  </div>
                {/if}

                <!-- Actions -->
                <div class="torrent-actions">
                  {#if torrent.status === 'downloading'}
                    <button class="btn-mini" on:click={() => handlePauseTorrent(torrent)} title="Pause">
                      <Pause size={10} />
                    </button>
                  {:else if torrent.status === 'paused'}
                    <button class="btn-mini btn-play" on:click={() => handleResumeTorrent(torrent)} title="Resume">
                      <Play size={10} />
                    </button>
                  {/if}
                  
                  <button class="btn-mini" on:click={() => {navigator.clipboard.writeText(torrent.magnetUri); addLog('Copied', 'success');}} title="Copy">
                    <ExternalLink size={10} />
                  </button>
                  
                  <button class="btn-mini btn-remove" on:click={() => {if(confirm('Remove?')) handleRemoveTorrent(torrent);}} title="Remove">
                    <Trash2 size={10} />
                  </button>

                  {#if torrent.files && torrent.files.length > 0}
                    <button class="btn-mini" on:click={() => torrent.filesExpanded = !torrent.filesExpanded} title="Files">
                      {#if torrent.filesExpanded}
                        <ChevronDown size={10} />
                      {:else}
                        <ChevronRight size={10} />
                      {/if}
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Files List -->
              {#if torrent.filesExpanded && torrent.files}
                <div class="files-list">
                  {#each torrent.files as file}
                    <div class="file-item">
                      <span class="file-icon">{getFileIcon(file.name)}</span>
                      <span class="file-name">{file.name}</span>
                      <span class="file-size">{formatBytes(file.length)}</span>
                      {#if torrent.progress > 0}
                        <button class="btn-download" on:click={() => handleDownloadFile(torrent, file)}>
                          <Download size={8} />
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer (optional stats) -->
    {#if torrents.length > 0}
      <div class="border-t border-gray-200 px-4 py-2">
        <div class="text-xs text-gray-500 text-center">
          {torrents.length} torrent{torrents.length !== 1 ? 's' : ''}
          {#if totalStats.downloading > 0}
            • {totalStats.downloading} active
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .resize-handle {
    transition: background-color 0.2s ease;
  }

  .resize-handle:hover {
    background-color: rgba(59, 130, 246, 0.5);
  }

  .resize-handle.resizing {
    background-color: rgba(59, 130, 246, 0.8);
  }

  /* Custom scrollbar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.3);
    border-radius: 3px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.5);
  }

  /* Animation for sidebar */
  .fixed {
    animation: slideInRight 0.3s ease-out;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  /* Empty state styling */
  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .example-box {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px;
    text-align: left;
  }

  .example-code {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 10px;
    color: #374151;
    display: block;
    word-break: break-all;
    line-height: 1.3;
  }

  .torrent-list {
    /* Clean list container */
  }

  .torrent-item {
    border-bottom: 1px solid #f3f4f6;
  }

  .torrent-row {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    background: white;
    transition: background-color 0.1s;
  }

  .torrent-row:hover {
    background: #f9fafb;
  }

  .status-icon {
    flex-shrink: 0;
  }

  .torrent-info {
    flex: 1;
    min-width: 0;
  }

  .torrent-name {
    font-size: 12px;
    font-weight: 500;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .torrent-meta {
    font-size: 10px;
    color: #6b7280;
    margin-top: 1px;
  }

  .progress-mini {
    flex-shrink: 0;
    width: 40px;
  }

  .progress-bar-mini {
    width: 40px;
    height: 2px;
    background: #e5e7eb;
    border-radius: 1px;
    overflow: hidden;
  }

  .progress-fill-mini {
    height: 100%;
    background: #3b82f6;
    border-radius: 1px;
    transition: width 0.3s;
  }

  .torrent-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .btn-mini {
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.1s;
  }

  .btn-mini:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-mini.btn-play:hover {
    background: #dbeafe;
    color: #2563eb;
  }

  .btn-mini.btn-remove:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .files-list {
    background: #fafafa;
    border-top: 1px solid #f3f4f6;
    padding: 4px 12px 4px 28px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    font-size: 10px;
  }

  .file-icon {
    flex-shrink: 0;
  }

  .file-name {
    flex: 1;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-size {
    color: #9ca3af;
    flex-shrink: 0;
  }

  .btn-download {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 2px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-download:hover {
    background: #2563eb;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .fixed {
      animation: slideInUp 0.3s ease-out;
    }

    @keyframes slideInUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .empty-state {
      padding: 20px 16px;
    }
  }
</style>