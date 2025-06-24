<script>
  import { onMount } from 'svelte';
  import WebTorrentHandler from '../utils/WebTorrentHandler.js';

  export let tab;
  export let active = false;
  export let logs = [];
  export let addLog;

  let contentElement;
  let webTorrentHandler;

  onMount(() => {
    webTorrentHandler = new WebTorrentHandler(addLog);
    return () => {
      webTorrentHandler.destroy();
    };
  });

  $: if (active && tab.url && contentElement) {
    loadContent();
  }

  async function loadContent() {
    if (!tab.url) return;

    addLog(`Loading content for tab: ${tab.id}`, 'info');

    try {
      if (tab.url.startsWith('magnet:')) {
        await loadTorrentContent();
      } else {
        await loadWebContent();
      }
    } catch (error) {
      addLog(`Error loading content: ${error.message}`, 'error');
      showErrorPage(error.message);
    }
  }

  async function loadTorrentContent() {
    addLog(`Starting torrent download: ${tab.url}`, 'info');
    
    // Clear previous content
    contentElement.innerHTML = '<div class="loading">Loading torrent...</div>';

    try {
      const files = await webTorrentHandler.downloadTorrent(tab.url);
      displayTorrentFiles(files);
      addLog(`Torrent loaded successfully: ${files.length} files`, 'success');
    } catch (error) {
      addLog(`Torrent loading failed: ${error.message}`, 'error');
      showErrorPage(`Failed to load torrent: ${error.message}`);
    }
  }

  function displayTorrentFiles(files) {
    let html = '<div class="torrent-content p-6 bg-white">';
    html += '<h2 class="text-xl font-bold mb-4 text-gray-800">Torrent Files</h2>';
    html += '<div class="file-list space-y-2">';

    files.forEach(file => {
      html += `
        <div class="file-item p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
          <div class="font-medium text-gray-800">${file.name}</div>
          <div class="text-sm text-gray-500">Size: ${formatFileSize(file.length)}</div>
          <div class="mt-2">
            <button class="download-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" 
                    onclick="downloadFile('${file.name}')">
              Download
            </button>
            ${isViewableFile(file.name) ? `
              <button class="view-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 ml-2" 
                      onclick="viewFile('${file.name}')">
                View
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += '</div></div>';
    contentElement.innerHTML = html;

    // Add event listeners for download and view buttons
    files.forEach(file => {
      const downloadBtn = contentElement.querySelector(`button[onclick="downloadFile('${file.name}')"]`);
      const viewBtn = contentElement.querySelector(`button[onclick="viewFile('${file.name}')"]`);
      
      if (downloadBtn) {
        downloadBtn.onclick = (e) => {
          e.preventDefault();
          downloadFile(file);
        };
      }
      
      if (viewBtn) {
        viewBtn.onclick = (e) => {
          e.preventDefault();
          viewFile(file);
        };
      }
    });
  }

  async function loadWebContent() {
    addLog(`Loading web content: ${tab.url}`, 'info');
    
    // For now, show a simple iframe or message
    // In a real implementation, you'd use a webview or iframe
    contentElement.innerHTML = `
      <div class="web-content h-full">
        <iframe 
          src="${tab.url}" 
          class="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms"
        ></iframe>
      </div>
    `;
  }

  function showErrorPage(message) {
    contentElement.innerHTML = `
      <div class="error-page flex items-center justify-center h-full bg-white">
        <div class="text-center">
          <div class="text-6xl mb-4">⚠️</div>
          <h2 class="text-xl font-bold mb-2 text-gray-800">Unable to load page</h2>
          <p class="text-gray-600">${message}</p>
          <button class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" 
                  onclick="location.reload()">
            Retry
          </button>
        </div>
      </div>
    `;
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function isViewableFile(filename) {
    const viewableExtensions = ['.txt', '.html', '.htm', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mp3'];
    return viewableExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  function downloadFile(file) {
    addLog(`Downloading file: ${file.name}`, 'info');
    webTorrentHandler.downloadFile(file);
  }

  function viewFile(file) {
    addLog(`Viewing file: ${file.name}`, 'info');
    // TODO: Implement file viewing in a new tab or overlay
  }
</script>

<div 
  class="tab-content h-full {active ? 'block' : 'hidden'}"
  bind:this={contentElement}
>
  {#if !tab.url}
    <div class="new-tab-page flex items-center justify-center h-full bg-white">
      <div class="text-center">
        <div class="text-4xl mb-4">🌐</div>
        <h1 class="text-2xl font-bold mb-2 text-gray-800">New Tab</h1>
        <p class="text-gray-600 mb-6">Enter a URL or magnet link to get started</p>
        <div class="quick-actions space-x-4">
          <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Browse Web
          </button>
          <button class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Load Torrent
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="loading-placeholder flex items-center justify-center h-full bg-white">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading...</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .tab-content {
    background: white;
  }
  
  :global(.torrent-content) {
    font-family: inherit;
  }
  
  :global(.file-item:hover) {
    background-color: #f9fafb;
  }
  
  :global(.download-btn, .view-btn) {
    font-size: 0.875rem;
    transition: background-color 0.1s ease;
  }
</style>