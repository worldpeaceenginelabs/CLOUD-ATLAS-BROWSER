<script>
  import { createEventDispatcher } from 'svelte';
  import { Search, Send, Shield, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-svelte';

  export let url = '';
  export let loading = false;

  const dispatch = createEventDispatcher();
  
  let inputValue = url;
  let inputElement;

  $: inputValue = url;

  function handleSubmit() {
    if (inputValue.trim()) {
      let processedUrl = inputValue.trim();
      
      // Check if it's a magnet link
      if (processedUrl.startsWith('magnet:')) {
        dispatch('submit', { url: processedUrl, action: 'torrent' });
      } else if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
        dispatch('submit', { url: processedUrl, action: 'navigate' });
      } else if (processedUrl.includes('.') && !processedUrl.includes(' ')) {
        // Assume it's a domain
        dispatch('submit', { url: `https://${processedUrl}`, action: 'navigate' });
      } else {
        // Search query
        dispatch('submit', { 
          url: `https://www.google.com/search?q=${encodeURIComponent(processedUrl)}`, 
          action: 'search' 
        });
      }
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  }

  function handleSendClick() {
    dispatch('send');
  }

  function handleRefresh() {
    if (url) {
      dispatch('submit', { url, action: 'refresh' });
    }
  }

  function handleBack() {
    // TODO: Implement navigation history
    console.log('Back clicked');
  }

  function handleForward() {
    // TODO: Implement navigation history
    console.log('Forward clicked');
  }

  function selectAll() {
    if (inputElement) {
      inputElement.select();
    }
  }
</script>

<div class="address-bar flex items-center bg-chrome-bg px-3 py-2 border-b border-chrome-border">
  <!-- Navigation buttons -->
  <div class="nav-buttons flex mr-3">
    <button 
      class="nav-btn p-2 rounded hover:bg-gray-200 disabled:opacity-50"
      on:click={handleBack}
      disabled={true}
      aria-label="Back"
    >
      <ArrowLeft size={16} class="text-gray-600" />
    </button>
    <button 
      class="nav-btn p-2 rounded hover:bg-gray-200 disabled:opacity-50"
      on:click={handleForward}
      disabled={true}
      aria-label="Forward"
    >
      <ArrowRight size={16} class="text-gray-600" />
    </button>
    <button 
      class="nav-btn p-2 rounded hover:bg-gray-200"
      on:click={handleRefresh}
      aria-label="Refresh"
    >
      <RefreshCw size={16} class="text-gray-600 {loading ? 'animate-spin' : ''}" />
    </button>
  </div>

  <!-- Address input -->
  <div class="address-input-container flex-1 flex items-center bg-white border border-chrome-border rounded-full px-4 py-2 mx-2">
    <!-- Security indicator -->
    <div class="security-indicator mr-2">
      <Shield size={16} class="text-gray-400" />
    </div>

    <!-- URL input -->
    <input 
      bind:this={inputElement}
      bind:value={inputValue}
      on:keydown={handleKeyDown}
      on:focus={selectAll}
      class="url-input flex-1 outline-none text-sm text-gray-800 bg-transparent"
      placeholder="Search or enter address"
      spellcheck="false"
      autocomplete="off"
    />

    <!-- Search/Go button -->
    <button 
      class="search-btn p-1 rounded hover:bg-gray-100"
      on:click={handleSubmit}
      aria-label="Go"
    >
      <Search size={16} class="text-gray-500" />
    </button>
  </div>

  <!-- Send button -->
  <button 
    class="send-btn flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
    on:click={handleSendClick}
    aria-label="Send file via WebTorrent"
  >
    <Send size={16} class="mr-2" />
    Send
  </button>
</div>

<style>
  .address-bar {
    min-height: 48px;
  }

  .nav-btn {
    transition: background-color 0.1s ease;
  }

  .address-input-container {
    transition: border-color 0.1s ease;
  }

  .address-input-container:focus-within {
    border-color: #4285f4;
    box-shadow: 0 0 0 1px #4285f4;
  }

  .url-input::placeholder {
    color: #9aa0a6;
  }

  .send-btn {
    transition: background-color 0.1s ease;
  }
</style>