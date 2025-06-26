<script>
  import { onMount, onDestroy } from 'svelte';
  import { Pause, Play, ExternalLink, Trash2, ChevronDown, ChevronRight, Folder } from 'lucide-svelte';
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
    try {
      const savedSidebarOpen = await persistenceStore.loadUIState('sidebarOpen', false);
      const savedSidebarWidth = await persistenceStore.loadUIState('sidebarWidth', 350);
      
      torrentStore.setSidebarOpen(savedSidebarOpen);
      torrentStore.setSidebarWidth(savedSidebarWidth);
      
      const savedTorrents = await persistenceStore.loadTorrents();
      savedTorrents.forEach(torrent => {
        torrentStore.addTorrent(torrent.magnetUri, torrent);
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

    setupResizeHandlers();
  });

  onDestroy(() => {
    unsubscribe();
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

    <!-- Content -->
    <div class="content">
      {#if torrents.length === 0}
        <!-- Empty State -->
        <div class="empty">
          <div class="empty-icon">📥</div>
          <h3>No torrents yet</h3>
          <p>Paste a magnet link in the address bar to start downloading</p>
          <div class="example">
            <div class="example-label">Example:</div>
            <code>magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny</code>
          </div>
        </div>
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
            {#each torrents as torrent (torrent.id)}
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
                    {torrent.status === 'downloading' ? 'Downloading' : 
                     torrent.status === 'paused' ? 'Paused' : 
                     torrent.status === 'completed' ? 'Completed' : 'Error'}
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
                          {#if torrent.progress > 0}
                            <button class="file-btn" on:click={() => handleDownloadFile(torrent, file)}>
                              <Folder size={12} />
                              Save
                            </button>
                          {/if}
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
    background: white;
    border-left: 1px solid #ccc;
    z-index: 50;
    display: flex;
    flex-direction: column;
    margin-top: 84px; /* Tab + Address bar height */
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
    background: #3b82f6;
  }

  .header {
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    text-align: center;
  }

  .header h2 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
  }

  .stats span {
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    color: #6b7280;
  }

  .content {
    flex: 1;
    overflow: auto;
  }

  /* Empty state */
  .empty {
    padding: 40px 16px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: #111827;
  }

  .empty p {
    margin: 0 0 16px 0;
    color: #6b7280;
    font-size: 14px;
  }

  .example {
    background: #f3f4f6;
    border-radius: 6px;
    padding: 12px;
    text-align: left;
  }

  .example-label {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
  }

  .example code {
    display: block;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 6px;
    font-size: 10px;
    word-break: break-all;
    line-height: 1.4;
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
    background: #f3f4f6;
    z-index: 5;
  }

  th {
    padding: 12px 8px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 2px solid #d1d5db;
  }

  /* Column widths */
  th:nth-child(1) { width: 45%; }
  th:nth-child(2) { width: 18%; }
  th:nth-child(3) { width: 22%; }
  th:nth-child(4) { width: 15%; }

  .torrent-row {
    border-bottom: 1px solid #f3f4f6;
  }

  .torrent-row:hover {
    background: #f9fafb;
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
    color: #6b7280;
    border-radius: 2px;
  }

  .expand-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .expand-spacer {
    width: 18px;
  }

  .name-text {
    font-weight: 500;
    color: #111827;
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
    background: #dbeafe;
    color: #1d4ed8;
  }

  .state-paused {
    background: #f3f4f6;
    color: #6b7280;
  }

  .state-completed {
    background: #dcfce7;
    color: #166534;
  }

  .state-error {
    background: #fee2e2;
    color: #dc2626;
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
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s;
  }

  .progress-text {
    font-size: 11px;
    color: #6b7280;
    font-weight: 500;
    min-width: 32px;
  }

  .speed-text {
    font-size: 10px;
    color: #9ca3af;
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
    background: #f3f4f6;
    color: #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.1s;
  }

  .pause-btn:hover, .play-btn:hover {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .copy-btn:hover {
    background: #f0f9ff;
    color: #0369a1;
  }

  .remove-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  /* Files */
  .files-row {
    background: #f9fafb;
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
  }

  .file-name {
    flex: 1;
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: #9ca3af;
    min-width: 60px;
    text-align: right;
  }

  .file-btn {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 3px;
    padding: 4px 8px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .file-btn:hover {
    background: #2563eb;
  }
</style>