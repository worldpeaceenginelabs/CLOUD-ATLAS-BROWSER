<script>
  import { Download, File, Play, Pause, Trash2, ExternalLink } from 'lucide-svelte';
  
  export let tab;
  export let active = false;
  export let addLog;

  $: torrentInfo = tab.torrentInfo;
  $: torrentProgress = tab.torrentProgress;

  async function downloadFile(file) {
    try {
      addLog(`Downloading file: ${file.name}`, 'info');
      const savePath = await window.electronAPI.downloadFile(tab.url, file.name);
      if (savePath) {
        addLog(`File saved to: ${savePath}`, 'success');
      }
    } catch (error) {
      addLog(`Download error: ${error.message}`, 'error');
    }
  }

  async function pauseTorrent() {
    try {
      await window.electronAPI.pauseTorrent(tab.url);
      addLog('Torrent paused', 'info');
    } catch (error) {
      addLog(`Pause error: ${error.message}`, 'error');
    }
  }

  async function resumeTorrent() {
    try {
      await window.electronAPI.resumeTorrent(tab.url);
      addLog('Torrent resumed', 'info');
    } catch (error) {
      addLog(`Resume error: ${error.message}`, 'error');
    }
  }

  async function removeTorrent() {
    try {
      await window.electronAPI.removeTorrent(tab.url);
      addLog('Torrent removed', 'info');
    } catch (error) {
      addLog(`Remove error: ${error.message}`, 'error');
    }
  }

  function copyMagnetLink() {
    const magnetUri = tab.url || tab.generatedMagnet;
    if (magnetUri) {
      navigator.clipboard.writeText(magnetUri);
      addLog('Magnet link copied to clipboard', 'success');
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
</script>

<div class="tab-content {active ? 'active' : 'hidden'} h-full bg-white">
  {#if tab.url?.startsWith('magnet:')}
    <!-- Torrent Content -->
    <div class="torrent-container p-6 h-full overflow-y-auto">
      <!-- Torrent Header -->
      <div class="torrent-header mb-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">
          {torrentInfo?.name || 'Torrent Download'}
        </h2>
        
        {#if torrentProgress}
          <!-- Status Bar -->
          <div class="status-bar bg-gray-100 rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700">
                Progress: {(torrentProgress.progress * 100).toFixed(1)}%
              </span>
              <span class="text-sm text-gray-600">{torrentProgress.peers} peers</span>
            </div>
            
            <!-- Progress Bar -->
            <div class="progress-bar bg-gray-200 rounded-full h-2 mb-2">
              <div 
                class="progress-fill bg-blue-600 rounded-full h-2 transition-all duration-500"
                style="width: {torrentProgress.progress * 100}%"
              ></div>
            </div>
            
            <div class="flex justify-between text-xs text-gray-600">
              <span>↓ {formatSpeed(torrentProgress.downloadSpeed)} ↑ {formatSpeed(torrentProgress.uploadSpeed)}</span>
              <span>Downloaded: {formatBytes(torrentProgress.downloaded)}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions flex gap-2 mb-4">
            <button 
              class="action-btn bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              on:click={pauseTorrent}
            >
              <Pause size={16} class="mr-2" />
              Pause
            </button>
            
            <button 
              class="action-btn bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              on:click={resumeTorrent}
            >
              <Play size={16} class="mr-2" />
              Resume
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
        {/if}
      </div>

      <!-- Files List -->
      {#if torrentInfo?.files && torrentInfo.files.length > 0}
        <div class="files-section">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">
            Files ({torrentInfo.files.length})
          </h3>
          
          <div class="files-list space-y-2">
            {#each torrentInfo.files as file, index (file.name)}
              <div class="file-item bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors">
                <div class="flex items-center justify-between">
                  <div class="file-info flex-1">
                    <div class="flex items-center mb-1">
                      <span class="text-lg mr-2">{getFileIcon(file.name)}</span>
                      <span class="font-medium text-gray-900">{file.name}</span>
                    </div>
                    <div class="text-sm text-gray-600">
                      {formatBytes(file.length)}
                      {#if file.path !== file.name}
                        <span class="text-gray-400"> • {file.path}</span>
                      {/if}
                    </div>
                    
                    <!-- Individual file progress if available -->
                    {#if torrentProgress && torrentProgress.progress > 0}
                      <div class="file-progress bg-gray-200 rounded-full h-1 mt-2">
                        <div 
                          class="progress-fill bg-green-500 rounded-full h-1 transition-all duration-500"
                          style="width: {Math.min(torrentProgress.progress * 100, 100)}%"
                        ></div>
                      </div>
                    {/if}
                  </div>
                  
                  <div class="file-actions ml-4 flex gap-2">
                    <button 
                      class="action-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors flex items-center"
                      on:click={() => downloadFile(file)}
                      disabled={!torrentProgress || torrentProgress.progress < 0.01}
                    >
                      <Download size={14} class="mr-1" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else if tab.loading}
        <div class="loading-state text-center py-12">
          <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-600">Loading torrent metadata...</p>
          <p class="text-sm text-gray-500 mt-2">Connecting to peers and fetching file information...</p>
        </div>
      {:else}
        <div class="error-state text-center py-12">
          <div class="text-gray-400 text-4xl mb-4">📦</div>
          <p class="text-gray-600 font-medium">No torrent data available</p>
          <p class="text-gray-500 text-sm mt-2">The torrent may still be loading or there was an error</p>
        </div>
      {/if}
    </div>

  {:else if tab.viewId}
    <!-- Web Content (handled by BrowserView in main process) -->
    <div class="web-content-placeholder h-full flex items-center justify-center bg-white">
      {#if tab.loading}
        <div class="loading-state text-center">
          <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-600">Loading {tab.url}...</p>
        </div>
      {:else}
        <!-- This space is occupied by the BrowserView -->
        <div class="web-content-active">
          <!-- BrowserView renders here -->
        </div>
      {/if}
    </div>

  {:else if tab.seedingFile}
    <!-- File Seeding Content -->
    <div class="seeding-container p-6 h-full">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">File Seeding</h2>
      
      <div class="seeding-info bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <h3 class="font-medium text-green-900 mb-2">
          📤 Seeding: {tab.seedingFile.split('/').pop() || tab.seedingFile.split('\\').pop()}
        </h3>
        <p class="text-green-700 text-sm mb-3">Your file is now available for download by others</p>
        
        {#if tab.generatedMagnet}
          <div class="magnet-link bg-white border border-green-300 rounded p-3">
            <label for="magnet-link-input" class="block text-sm font-medium text-green-900 mb-1">Magnet Link:</label>
            <div class="flex items-center gap-2">
              <input 
                id="magnet-link-input"
                type="text" 
                value={tab.generatedMagnet} 
                readonly 
                class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono bg-gray-50 select-all"
                on:click={(e) => e.target.select()}
              />
              <button 
                class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                on:click={copyMagnetLink}
              >
                Copy
              </button>
            </div>
            <p class="text-xs text-green-600 mt-2">
              Share this magnet link with others to let them download your file
            </p>
          </div>
        {:else}
          <div class="loading-state">
            <div class="flex items-center">
              <div class="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full mr-2"></div>
              <span class="text-green-700 text-sm">Generating magnet link...</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Seeding Stats (if available) -->
      <div class="seeding-stats bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 class="font-medium text-gray-900 mb-2">Seeding Statistics</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600">Status:</span>
            <span class="font-medium text-green-600 ml-2">Active</span>
          </div>
          <div>
            <span class="text-gray-600">File Size:</span>
            <span class="font-medium ml-2">Calculating...</span>
          </div>
          <div>
            <span class="text-gray-600">Uploaded:</span>
            <span class="font-medium ml-2">0 B</span>
          </div>
          <div>
            <span class="text-gray-600">Peers:</span>
            <span class="font-medium ml-2">0</span>
          </div>
        </div>
      </div>
    </div>

  {:else}
    <!-- Default/Empty Tab Content -->
    <div class="default-content p-6 h-full flex items-center justify-center">
      <div class="text-center max-w-md">
        <div class="text-6xl mb-6">🌐</div>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">WebTorrent Browser</h2>
        <p class="text-gray-600 mb-6">Enter a magnet link or select a file to seed</p>
        
        <div class="bg-gray-50 rounded-lg p-4 text-left">
          <h3 class="font-medium text-gray-900 mb-3">How to use:</h3>
          <div class="space-y-2 text-sm text-gray-600">
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>Paste magnet links in the address bar to download torrents</span>
            </div>
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>Use the Send button to seed your own files</span>
            </div>
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>All operations run securely in the main process</span>
            </div>
          </div>
        </div>

        <!-- Example magnet link for testing -->
        <div class="mt-6 p-3 bg-blue-50 rounded-lg">
          <p class="text-xs text-blue-700 mb-2">Example magnet link (Big Buck Bunny):</p>
          <code class="text-xs bg-white px-2 py-1 rounded border text-gray-700 block break-all">
            magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny
          </code>
        </div>
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
    background-color: inherit !important;
  }
  
  .file-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .select-all {
    user-select: all;
  }
  
  code {
    word-wrap: break-word;
    white-space: pre-wrap;
  }
</style>