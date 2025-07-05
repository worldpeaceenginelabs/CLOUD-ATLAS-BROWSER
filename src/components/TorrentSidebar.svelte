<script>
  import { onMount } from 'svelte';
  import { torrentStore } from '../stores/torrentStore.js';
  import { persistenceStore } from '../stores/persistenceStore.js';
  import SidebarLayout from './torrent-sidebar/SidebarLayout.svelte';
  import MediaPlayer from './torrent-sidebar/MediaPlayer.svelte';
  import TorrentList from './torrent-sidebar/TorrentList.svelte';

  export let addLog = () => {};

  let torrents = [];
  let downloadingTorrents = [];
  let sharingTorrents = [];
  let websiteTorrents = [];

  // Subscribe to torrent store
  const unsubscribe = torrentStore.subscribe(state => {
    torrents = state.torrents;
    downloadingTorrents = torrents.filter(t => t.torrentType === 'downloading');
    sharingTorrents = torrents.filter(t => t.torrentType === 'sharing');
    websiteTorrents = torrents.filter(t => t.torrentType === 'website');
  });

  onMount(async () => {
    try {
      // Load saved torrents
      const savedTorrents = await persistenceStore.loadTorrents();
      for (const torrent of savedTorrents) {
        // Ensure actualDownloadPath is set for seeding torrents
        if (torrent.torrentType === 'sharing' && !torrent.actualDownloadPath && torrent.seedPath) {
          torrent.actualDownloadPath = torrent.seedPath;
        }
        // 1. Add to store immediately as paused
        torrentStore.addTorrent(torrent.magnetUri, torrent, torrent.torrentType);
        torrentStore.setTorrentStatus(torrent.infoHash, 'paused');

        // 2. Try to re-add/re-seed in the background
        (async () => {
          try {
            if (torrent.torrentType === 'sharing' && torrent.seedPath) {
              await window.electronAPI.seedFile(torrent.seedPath);
              // Only set to 'downloading' if it was not paused
              if (torrent.status !== 'paused') {
                torrentStore.setTorrentStatus(torrent.infoHash, 'downloading');
              }
            } else {
              await window.electronAPI.addTorrent(torrent.magnetUri);
              if (torrent.status !== 'paused') {
                torrentStore.setTorrentStatus(torrent.infoHash, 'downloading');
              }
            }
          } catch (err) {
            // 3. If it fails, leave as paused and optionally set an error
            torrentStore.setTorrentStatus(torrent.infoHash, 'paused');
            torrentStore.updateTorrent(torrent.infoHash, { error: err.message });
          }
        })();
      }
      if (savedTorrents.length > 0) {
        addLog(`Restored ${savedTorrents.length} torrents from previous session`, 'info');
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
      addLog('Failed to restore previous session data', 'warning');
    }
  });

  let mediaPlayer;

  // Torrent operation functions
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
        let torrentInfo;
        
        // Handle seeding torrents differently - reseed the original file
        if (torrent.torrentType === 'sharing' && torrent.seedPath) {
          addLog(`Reseeding file: ${torrent.seedPath}`, 'info');
          torrentInfo = await window.electronAPI.seedFile(torrent.seedPath);
        } else {
          // Handle downloading torrents - re-add by magnet URI
          torrentInfo = await window.electronAPI.addTorrent(torrent.magnetUri);
        }
        
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
        // For seeding torrents, pass keepFiles=true to prevent file deletion
        const keepFiles = torrent.torrentType === 'sharing';
        const success = await window.electronAPI.removeTorrent(torrent.magnetUri, keepFiles);
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

  function handleCopyMagnet(torrent) {
    navigator.clipboard.writeText(torrent.magnetUri);
    addLog('Magnet link copied to clipboard', 'success');
  }

  async function handleOpenRootFolder(torrent) {
    if (window.electronAPI && torrent.actualDownloadPath) {
      const result = await window.electronAPI.openRootFolder(torrent.actualDownloadPath);
      if (!result) {
        addLog('Failed to open torrent root folder', 'error');
      }
    } else {
      addLog('No root folder path available for this torrent', 'error');
    }
  }

  function handleStreamMediaFile(torrent, file) {
    return mediaPlayer.streamMediaFile(torrent, file);
  }

  async function handlePreviewImage(torrent, file) {
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
</script>

<SidebarLayout {addLog}>
  <MediaPlayer bind:this={mediaPlayer} {addLog} />
  
  <div class="content">
    <TorrentList 
      torrents={websiteTorrents}
      torrentType="website"
      onPauseTorrent={handlePauseTorrent}
      onResumeTorrent={handleResumeTorrent}
      onRemoveTorrent={handleRemoveTorrent}
      onCopyMagnet={handleCopyMagnet}
      onOpenRootFolder={handleOpenRootFolder}
      onStreamMediaFile={handleStreamMediaFile}
      onPreviewImage={handlePreviewImage}
    />

    <TorrentList 
      torrents={downloadingTorrents}
      torrentType="downloading"
      onPauseTorrent={handlePauseTorrent}
      onResumeTorrent={handleResumeTorrent}
      onRemoveTorrent={handleRemoveTorrent}
      onCopyMagnet={handleCopyMagnet}
      onOpenRootFolder={handleOpenRootFolder}
      onStreamMediaFile={handleStreamMediaFile}
      onPreviewImage={handlePreviewImage}
    />

    <TorrentList 
      torrents={sharingTorrents}
      torrentType="sharing"
      onPauseTorrent={handlePauseTorrent}
      onResumeTorrent={handleResumeTorrent}
      onRemoveTorrent={handleRemoveTorrent}
      onCopyMagnet={handleCopyMagnet}
      onOpenRootFolder={handleOpenRootFolder}
      onStreamMediaFile={handleStreamMediaFile}
      onPreviewImage={handlePreviewImage}
    />
    </div>


</SidebarLayout>

<style>
  .content {
    flex: 1;
    overflow: auto;
    background: var(--chrome-bg);
  }
</style>