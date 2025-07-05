<script>
  import { ChevronDown, ChevronRight, Pause, Play, ExternalLink, Trash2, Folder } from 'lucide-svelte';
  import { formatBytes, formatSpeed, getFileIcon, isStreamableFile, isPreviewableFile } from './utils.js';

  export let torrents = [];
  export let torrentType = '';
  export let onPauseTorrent = () => {};
  export let onResumeTorrent = () => {};
  export let onRemoveTorrent = () => {};
  export let onCopyMagnet = () => {};
  export let onOpenRootFolder = () => {};
  export let onStreamMediaFile = () => {};
  export let onPreviewImage = () => {};

  function toggleFiles(torrent) {
    torrent.filesExpanded = !torrent.filesExpanded;
    torrents = [...torrents];
  }

  function getSectionTitle() {
    switch (torrentType) {
      case 'website': return 'Websites';
      case 'downloading': return 'Downloads';
      case 'sharing': return 'Sharing';
      default: return 'Torrents';
    }
  }

  function getEmptyMessage() {
    switch (torrentType) {
      case 'website': return 'No websites';
      case 'downloading': return 'No active downloads';
      case 'sharing': return 'No shared files';
      default: return 'No torrents';
    }
  }

  function getStateLabel(torrent) {
    if (torrent.torrentType === 'sharing' && torrent.status === 'downloading') {
      return 'Seeding';
    }
    switch (torrent.status) {
      case 'downloading': return 'Downloading';
      case 'paused': return 'Paused';
      case 'completed': return 'Seeding';
      default: return 'Error';
    }
  }

  function getTypeBadge(torrent) {
    if (torrentType === 'website') {
      return torrent.websiteType || 'Unknown';
    }
    return torrent.torrentType || 'Unknown';
  }
</script>

<h3>{getSectionTitle()}</h3>
{#if torrents.length === 0}
  <div class="empty-message">{getEmptyMessage()}</div>
{:else}
  <table>
    <thead>
      <tr>
        <th>Name</th>
        {#if torrentType === 'website'}
          <th>Type</th>
        {/if}
        <th>State</th>
        <th>Progress</th>
        <th>Controls</th>
      </tr>
    </thead>
    <tbody>
      {#each torrents as torrent (torrent.infoHash)}
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
          
          {#if torrentType === 'website'}
            <td class="type-cell">
              <span class="website-type-badge">{getTypeBadge(torrent)}</span>
            </td>
          {/if}
          
          <td class="state-cell">
            <span class="state-badge state-{torrent.status}">
              {getStateLabel(torrent)}
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
              {#if torrent.status === 'downloading' || torrent.status === 'completed'}
                <button class="control-btn pause-btn" on:click={() => onPauseTorrent(torrent)} title="Pause">
                  <Pause size={16} />
                </button>
              {:else if torrent.status === 'paused'}
                <button class="control-btn play-btn" on:click={() => onResumeTorrent(torrent)} title="Resume">
                  <Play size={16} />
                </button>
              {/if}
              <button class="control-btn copy-btn" on:click={() => onCopyMagnet(torrent)} title="Copy magnet">
                <ExternalLink size={16} />
              </button>
              <button class="control-btn folder-btn" on:click={() => onOpenRootFolder(torrent)} title="Open root folder">
                <Folder size={16} />
              </button>
              <button class="control-btn remove-btn" on:click={() => {if(confirm('Remove?')) onRemoveTorrent(torrent);}} title="Remove">
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
        
        {#if torrent.filesExpanded && torrent.files}
          <tr class="files-row">
            <td colspan={torrentType === 'website' ? 5 : 4} class="files-cell">
              <div class="files-container">
                {#each torrent.files as file}
                  <div class="file-item">
                    <span class="file-icon">{getFileIcon(file.name)}</span>
                    <span class="file-name">{file.name}</span>
                    <span class="file-size">{formatBytes(file.length)}</span>
                    <div class="file-actions">
                      {#if isStreamableFile(file.name)}
                        <button 
                          class="file-btn stream-btn" 
                          on:click={() => onStreamMediaFile(torrent, file)}
                          title="Stream"
                        >
                          🎬 Stream
                        </button>
                      {/if}
                      {#if isPreviewableFile(file.name)}
                        <button 
                          class="file-btn preview-btn" 
                          on:click={() => onPreviewImage(torrent, file)}
                          title="Preview"
                        >
                          👁️ Preview
                        </button>
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

<style>
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
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .state-error {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Progress cell */
  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--chrome-blue);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 11px;
    color: var(--chrome-text-secondary);
  }

  .speed-text {
    font-size: 10px;
    color: var(--chrome-text-secondary);
  }

  /* Controls cell */
  .controls {
    display: flex;
    gap: 4px;
  }

  .control-btn {
    width: 28px;
    height: 28px;
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

  .pause-btn:hover {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .play-btn:hover {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .remove-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  /* Files section */
  .files-row {
    background: rgba(255, 255, 255, 0.02);
  }

  .files-cell {
    padding: 0;
  }

  .files-container {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid var(--chrome-border);
  }

  .file-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  .file-name {
    flex: 1;
    font-size: 12px;
    color: var(--chrome-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 11px;
    color: var(--chrome-text-secondary);
    min-width: 60px;
    text-align: right;
  }

  .file-actions {
    display: flex;
    gap: 4px;
  }

  .file-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
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

  /* Type badge */
  .website-type-badge {
    padding: 2px 6px;
    background: rgba(139, 196, 255, 0.2);
    color: var(--chrome-blue);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    border: 1px solid rgba(139, 196, 255, 0.3);
  }

  /* Empty state */
  .empty-message {
    padding: 40px 16px;
    text-align: center;
    color: var(--chrome-text-secondary);
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
  }
</style> 