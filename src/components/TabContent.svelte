<script>
  import { RefreshCw, X } from 'lucide-svelte';
  
  export let tab;
  export let active = false;
  export let addLog;

  // Handle process-related actions
  async function handleReloadCrashedTab() {
    if (tab.viewId && tab.url && window.electronAPI) {
      try {
        const success = await window.electronAPI.reloadCrashedTab(tab.viewId, tab.url);
        if (success) {
          addLog(`Reloading crashed tab: ${tab.title || tab.url}`, 'info');
        } else {
          addLog(`Failed to reload crashed tab`, 'error');
        }
      } catch (error) {
        addLog(`Error reloading crashed tab: ${error.message}`, 'error');
      }
    }
  }

  async function handleTerminateTab() {
    if (tab.viewId && window.electronAPI) {
      try {
        const success = await window.electronAPI.terminateTabProcess(tab.viewId);
        if (success) {
          addLog(`Terminated tab process: ${tab.title || tab.url}`, 'info');
        } else {
          addLog(`Failed to terminate tab process`, 'error');
        }
      } catch (error) {
        addLog(`Error terminating tab process: ${error.message}`, 'error');
      }
    }
  }

  function handleCloseTab() {
    // Dispatch close event to parent
    window.dispatchEvent(new CustomEvent('close-tab', { detail: tab.id }));
  }

  function getProcessStatusIcon(status) {
    switch (status) {
      case 'running': return '✅';
      case 'crashed': return '💥';
      case 'unresponsive': return '⏳';
      case 'terminated': return '❌';
      case 'pending': return '⚪';
      default: return '❓';
    }
  }

  function getProcessStatusColor(status) {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'crashed': return 'text-red-600';
      case 'unresponsive': return 'text-orange-600';
      case 'terminated': return 'text-gray-600';
      case 'pending': return 'text-blue-600';
      default: return 'text-gray-400';
    }
  }
</script>

<div class="tab-content {active ? 'active' : 'hidden'} h-full bg-white">
  {#if tab.viewId}
    <!-- Web Content (handled by BrowserView in main process) -->
    <div class="web-content-placeholder h-full flex items-center justify-center bg-white relative">
      {#if tab.processStatus === 'crashed'}
        <!-- Crashed Tab Recovery -->
        <div class="crashed-state text-center p-8">
          <div class="text-6xl mb-4">💥</div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Tab Crashed</h2>
          <p class="text-gray-600 mb-4">This tab has stopped working</p>
          <div class="space-y-2">
            <button 
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              on:click={handleReloadCrashedTab}
            >
              <RefreshCw size={16} />
              Reload Tab
            </button>
            <button 
              class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors flex items-center gap-2 ml-2"
              on:click={handleCloseTab}
            >
              <X size={16} />
              Close Tab
            </button>
          </div>
          {#if tab.processId}
            <div class="mt-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
              <div class="font-medium mb-1">Process Information</div>
              <div>Process ID: {tab.processId}</div>
              {#if tab.statusMessage}
                <div class="text-gray-600">{tab.statusMessage}</div>
              {/if}
            </div>
          {/if}
        </div>
      {:else if tab.processStatus === 'unresponsive'}
        <!-- Unresponsive Tab -->
        <div class="unresponsive-state text-center p-8">
          <div class="text-6xl mb-4">⏳</div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Tab Not Responding</h2>
          <p class="text-gray-600 mb-4">This tab is taking too long to respond</p>
          <div class="space-y-2">
            <button 
              class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors flex items-center gap-2"
              on:click={handleTerminateTab}
            >
              <X size={16} />
              Force Close
            </button>
            <button 
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center gap-2 ml-2"
              on:click={handleReloadCrashedTab}
            >
              <RefreshCw size={16} />
              Reload
            </button>
          </div>
          {#if tab.processId}
            <div class="mt-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
              <div class="font-medium mb-1">Process Information</div>
              <div>Process ID: {tab.processId}</div>
              {#if tab.statusMessage}
                <div class="text-gray-600">{tab.statusMessage}</div>
              {/if}
            </div>
          {/if}
        </div>
      {:else if tab.processStatus === 'terminated'}
        <!-- Terminated Process -->
        <div class="terminated-state text-center p-8">
          <div class="text-6xl mb-4">❌</div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Process Terminated</h2>
          <p class="text-gray-600 mb-4">The tab process was terminated</p>
          <div class="space-y-2">
            <button 
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              on:click={handleReloadCrashedTab}
            >
              <RefreshCw size={16} />
              Restart Tab
            </button>
            <button 
              class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors flex items-center gap-2 ml-2"
              on:click={handleCloseTab}
            >
              <X size={16} />
              Close Tab
            </button>
          </div>
          {#if tab.processId}
            <div class="mt-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
              <div class="font-medium mb-1">Process Information</div>
              <div>Previous Process ID: {tab.processId}</div>
              {#if tab.statusMessage}
                <div class="text-gray-600">{tab.statusMessage}</div>
              {/if}
            </div>
          {/if}
        </div>
      {:else if tab.loading}
        <!-- Loading State -->
        <div class="loading-state text-center">
          <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-600">Loading {tab.url}...</p>
          {#if tab.processId}
            <p class="text-xs text-gray-500 mt-2">Process ID: {tab.processId}</p>
          {/if}
          {#if tab.statusMessage}
            <p class="text-xs text-gray-600 mt-1">{tab.statusMessage}</p>
          {/if}
        </div>
      {:else}
        <!-- Normal Web Content (BrowserView renders here) -->
        <div class="web-content-active h-full w-full relative">
          <!-- BrowserView renders here -->
          
          <!-- Process Information Overlay -->
          {#if tab.processId && tab.processStatus}
            <div class="process-info absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 z-10">
              <div class="flex items-center gap-2 mb-1">
                <span class={getProcessStatusColor(tab.processStatus)}>
                  {getProcessStatusIcon(tab.processStatus)}
                </span>
                <span class="font-medium">PID: {tab.processId}</span>
              </div>
              {#if tab.memoryInfo}
                <div class="text-gray-300">
                  Memory: {Math.round(tab.memoryInfo.workingSetSize / 1024 / 1024)}MB
                </div>
                {#if tab.memoryInfo.privateBytes}
                  <div class="text-gray-300">
                    Private: {Math.round(tab.memoryInfo.privateBytes / 1024 / 1024)}MB
                  </div>
                {/if}
              {/if}
              {#if tab.statusMessage}
                <div class="text-gray-300 mt-1 text-xs">
                  {tab.statusMessage}
                </div>
              {/if}
              <div class="text-gray-400 mt-1 text-xs">
                Status: {tab.processStatus}
              </div>
            </div>
          {/if}
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
                on:click={() => {
                  navigator.clipboard.writeText(tab.generatedMagnet);
                  addLog('Magnet link copied to clipboard', 'success');
                }}
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
        <h2 class="text-2xl font-bold text-gray-900 mb-4">CLOUD-ATLAS-BROWSER</h2>
        <p class="text-gray-600 mb-6">Browse the web or manage torrents via the sidebar</p>
        
        <div class="bg-gray-50 rounded-lg p-4 text-left">
          <h3 class="font-medium text-gray-900 mb-3">How to use:</h3>
          <div class="space-y-2 text-sm text-gray-600">
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>Enter URLs in the address bar to browse websites</span>
            </div>
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>Paste magnet links to add torrents to the sidebar</span>
            </div>
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>Use the ⋮ button to toggle the torrent sidebar</span>
            </div>
            <div class="flex items-start">
              <span class="text-blue-600 mr-2">•</span>
              <span>Click "Send" to seed your own files</span>
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
  
  .crashed-state,
  .unresponsive-state,
  .terminated-state {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .web-content-active {
    position: relative;
  }

  .loading-state {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  .process-info {
    backdrop-filter: blur(4px);
    max-width: 200px;
  }

  .select-all {
    user-select: all;
  }
  
  code {
    word-wrap: break-word;
    white-space: pre-wrap;
  }
</style>