<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Download, File, Play, Pause, Trash2, ExternalLink } from 'lucide-svelte';
  import WebTorrentHandler from '../utils/WebTorrentHandler.js';
  
  export let tab;
  export let active = false;
  export let logs = [];
  export let addLog;

  const dispatch = createEventDispatcher();

  let webTorrentHandler;
  let torrentFiles = [];
  let torrentProgress = 0;
  let downloadSpeed = 0;
  let uploadSpeed = 0;
  let peers = 0;
  let torrentStatus = 'idle'; // 'idle', 'downloading', 'completed', 'seeding', 'error'
  let selectedFiles = new Set();

  onMount(async () => {
    if (!webTorrentHandler) {
      webTorrentHandler = new WebTorrentHandler(addLog);
    }

    // Handle different content types
    if (tab.url?.startsWith('magnet:')) {
      await handleMagnetContent();
    } else if (tab.seedingFile) {
      await handleFileSeeding();
    }
  });

  onDestroy(() => {
    // Cleanup WebTorrent resources
    if (webTorrentHandler && tab.url?.startsWith('magnet:')) {
      // Optionally pause or remove torrent
    }
  });

  async function handleMagnetContent() {
    try {
      torrentStatus = 'downloading';
      addLog(`Loading torrent: ${tab.url}`, 'info');

      const files = await webTorrentHandler.downloadTorrent(tab.url);
      torrentFiles = files.map((file, index) => ({
        id: index,
        name: file.name,
        size: file.length,
        path: file.path,
        progress: 0,
        selected: true
      }));

      // Update progress periodically
      const progressInterval = setInterval(() => {
        const torrentInfo = webTorrentHandler.getTorrentStatus(tab.url);
        if (torrentInfo) {
          torrentProgress = torrentInfo.progress * 100;
          downloadSpeed = torrentInfo.downloadSpeed;
          uploadSpeed = torrentInfo.uploadSpeed;
          peers = torrentInfo.peers;

          // Update file progress
          torrentFiles = torrentFiles.map((file, index) => ({
            ...file,
            progress: torrentInfo.files[index]?.progress * 100 || 0
          }));

          if (torrentProgress >= 100) {
            torrentStatus = 'completed';
            clearInterval(progressInterval);
          }
        }
      }, 1000);

      // Store interval reference for cleanup
      tab.progressInterval = progressInterval;

    } catch (error) {
      torrentStatus = 'error';
      addLog(`Torrent error: ${error.message}`, 'error');
      dispatch('securityWarning', {
        message: `Failed to load torrent: ${error.message}`,
        severity: 'medium'
      });
    }
  }

  async function handleFileSeeding() {
    try {
      torrentStatus = 'seeding';
      addLog(`Seeding file: ${tab.seedingFile}`, 'info');

      const magnetUri = await webTorrentHandler.seedFile(tab.seedingFile);
      
      // Update tab with magnet URI
      tab.generatedMagnet = magnetUri;
      torrentStatus = 'seeding';
      
      addLog(`File seeded successfully. Magnet: ${magnetUri}`, 'success');

    } catch (error) {
      torrentStatus = 'error';
      addLog(`Seeding error: ${error.message}`, 'error');
    }
  }

  async function downloadFile(file) {
    try {
      if (!webTorrentHandler) return;
      
      const torrent = webTorrentHandler.client.get(tab.url);
      if (torrent) {
        const torrentFile = torrent.files.find(f => f.name === file.name);
        if (torrentFile) {
          await webTorrentHandler.downloadFile(torrentFile, torrent);
          addLog(`Downloaded: ${file.name}`, 'success');
        }
      }
    } catch (error) {
      addLog(`Download error: ${error.message}`, 'error');
    }
  }

  async function streamFile(file) {
    try {
      if (!webTorrentHandler) return;
      
      const torrent = webTorrentHandler.client.get(tab.url);
      if (torrent) {
        const torrentFile = torrent.files.find(f => f.name === file.name);
        if (torrentFile) {
          const streamUrl = await webTorrentHandler.streamFile(torrentFile);
          
          // Open in new window or handle based on file type
          if (isVideoFile(file.name) || isAudioFile(file.name)) {
            openMediaPlayer(streamUrl, file.name);
          } else {
            window.open(streamUrl, '_blank');
          }
          
          addLog(`Streaming: ${file.name}`, 'success');
        }
      }
    } catch (error) {
      addLog(`Streaming error: ${error.message}`, 'error');
    }
  }

  function openMediaPlayer(streamUrl, fileName) {
    // Create a simple media player interface
    const mediaWindow = window.open('', '_blank', 'width=800,height=600');
    const isVideo = isVideoFile(fileName);
    
    mediaWindow.document.write(`
      <html>
        <head>
          <title>Playing: ${fileName}</title>
          <style>
            body { margin: 0; padding: 20px; background: #000; color: white; font-family: Arial, sans-serif; }
            ${isVideo ? 'video' : 'audio'} { width: 100%; max-width: 100%; }
            .controls { margin-top: 10px; }
          </style>
        </head>
        <body>
          <h3>${fileName}</h3>
          <${isVideo ? 'video' : 'audio'} controls autoplay>
            <source src="${streamUrl}" />
            Your browser does not support this media format.
          </${isVideo ? 'video' : 'audio'}>
        </body>
      </html>
    `);
  }

  function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  function isAudioFile(filename) {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
    return audioExtensions.some(ext => filename.toLowerCase().endsWith(ext));
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

  function copyMagnetLink() {
    if (tab.url?.startsWith('magnet:')) {
      navigator.clipboard.writeText(tab.url);
      addLog('Magnet link copied to clipboard', 'success');
    } else if (tab.generatedMagnet) {
      navigator.clipboard.writeText(tab.generatedMagnet);
      addLog('Generated magnet link copied to clipboard', 'success');
    }
  }

  function pauseResumeTorrent() {
    if (!webTorrentHandler || !tab.url?.startsWith('magnet:')) return;
    
    if (torrentStatus === 'downloading') {
      webTorrentHandler.pauseTorrent(tab.url);
      torrentStatus = 'paused';
      addLog('Torrent paused', 'info');
    } else if (torrentStatus === 'paused') {
      webTorrentHandler.resumeTorrent(tab.url);
      torrentStatus = 'downloading';
      addLog('Torrent resumed', 'info');
    }
  }

  function removeTorrent() {
    if (!webTorrentHandler || !tab.url?.startsWith('magnet:')) return;
    
    if (webTorrentHandler.removeTorrent(tab.url)) {
      torrentStatus = 'idle';
      torrentFiles = [];
      addLog('Torrent removed', 'info');
    }
  }
</script>

<div class="tab-content {active ? 'active' : 'hidden'} h-full bg-white">
  {#if tab.url?.startsWith('magnet:')}
    <!-- Torrent Content -->
    <div class="torrent-container p-6 h-full overflow-y-auto">
      <!-- Torrent Header -->
      <div class="torrent-header mb-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Torrent Download</h2>
        
        <!-- Status Bar -->
        <div class="status-bar bg-gray-100 rounded-lg p-4 mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Status: 
              <span class="capitalize text-blue-600">{torrentStatus}</span>
            </span>
            <span class="text-sm text-gray-600">{peers} peers connected</span>
          </div>
          
          <!-- Progress Bar -->
          <div class="progress-bar bg-gray-200 rounded-full h-2 mb-2">
            <div 
              class="progress-fill bg-blue-600 rounded-full h-2 transition-all duration-500"
              style="width: {torrentProgress}%"
            ></div>
          </div>
          
          <div class="flex justify-between text-xs text-gray-600">
            <span>{torrentProgress.toFixed(1)}% complete</span>
            <span>↓ {formatSpeed(downloadSpeed)} ↑ {formatSpeed(uploadSpeed)}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions flex gap-2 mb-4">
          <button 
            class="action-btn bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            on:click={pauseResumeTorrent}
            disabled={torrentStatus === 'idle' || torrentStatus === 'error'}
          >
            <svelte:component 
              this={torrentStatus === 'downloading' ? Pause : Play} 
              size={16} 
              class="mr-2" 
            />
            {torrentStatus === 'downloading' ? 'Pause' : 'Resume'}
          </button>
          
          <button 
            class="action-btn bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            on:click={copyMagnetLink}
          >
            <ExternalLink size={16} class="mr-2" />
            Copy Link
          </button>
          
          <button 
            class="action-btn bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            on:click={removeTorrent}
          >
            <Trash2 size={16} class="mr-2" />
            Remove
          </button>
        </div>
      </div>

      <!-- Files List -->
      {#if torrentFiles.length > 0}
        <div class="files-section">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">Files ({torrentFiles.length})</h3>
          
          <div class="files-list space-y-2">
            {#each torrentFiles as file (file.id)}
              <div class="file-item bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div class="flex items-center justify-between">
                  <div class="file-info flex-1">
                    <div class="flex items-center mb-1">
                      <File size={16} class="text-gray-500 mr-2" />
                      <span class="font-medium text-gray-900">{file.name}</span>
                    </div>
                    <div class="text-sm text-gray-600">
                      {formatBytes(file.size)} • {file.progress.toFixed(1)}% complete
                    </div>
                    
                    <!-- File Progress Bar -->
                    <div class="file-progress bg-gray-200 rounded-full h-1 mt-2">
                      <div 
                        class="progress-fill bg-green-500 rounded-full h-1 transition-all duration-500"
                        style="width: {file.progress}%"
                      ></div>
                    </div>
                  </div>
                  
                  <div class="file-actions ml-4 flex gap-2">
                    <button 
                      class="action-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                      on:click={() => downloadFile(file)}
                      disabled={file.progress < 100}
                    >
                      <Download size={14} class="mr-1" />
                      Download
                    </button>
                    
                    {#if isVideoFile(file.name) || isAudioFile(file.name)}
                      <button 
                        class="action-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        on:click={() => streamFile(file)}
                        disabled={file.progress < 10}
                      >
                        <Play size={14} class="mr-1" />
                        Stream
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else if torrentStatus === 'downloading'}
        <div class="loading-state text-center py-12">
          <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-600">Loading torrent metadata...</p>
        </div>
      {:else if torrentStatus === 'error'}
        <div class="error-state text-center py-12">
          <div class="text-red-500 text-4xl mb-4">⚠️</div>
          <p class="text-red-600 font-medium">Failed to load torrent</p>
          <p class="text-gray-600 text-sm mt-2">Check the logs for more details</p>
        </div>
      {/if}
    </div>

  {:else if tab.seedingFile}
    <!-- File Seeding Content -->
    <div class="seeding-container p-6 h-full">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">File Seeding</h2>
      
      <div class="seeding-info bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <h3 class="font-medium text-green-900 mb-2">Seeding: {tab.seedingFile}</h3>
        <p class="text-green-700 text-sm mb-3">Your file is now available for download by others</p>
        
        {#if tab.generatedMagnet}
          <div class="magnet-link bg-white border border-green-300 rounded p-3">
            <label class="block text-sm font-medium text-green-900 mb-1">Magnet Link:</label>
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                value={tab.generatedMagnet} 
                readonly 
                class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
              <button 
                class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                on:click={copyMagnetLink}
              >
                Copy
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>

  {:else}
    <!-- Regular Web Content -->
    <div class="web-content p-6 h-full">
      <div class="text-center py-12">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Web Browser</h2>
        <p class="text-gray-600">Regular web browsing will be implemented here</p>
        <p class="text-sm text-gray-500 mt-2">URL: {tab.url || 'about:blank'}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .tab-content {
    transition: opacity 0.2s ease-in-out;
  }
  
  .tab-content.hidden {
    display: none;
  }
  
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .action-btn:disabled:hover {
    background-color: inherit;
  }
</style>