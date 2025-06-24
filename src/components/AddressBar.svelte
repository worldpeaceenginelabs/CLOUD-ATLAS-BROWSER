<script>
  import { createEventDispatcher } from 'svelte';
  import { Search, Send, Shield, RefreshCw, ArrowLeft, ArrowRight, MoreVertical } from 'lucide-svelte';

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

  function getSecurityIcon() {
    if (url.startsWith('https:')) {
      return { icon: Shield, color: '#34a853' }; // Green for secure
    } else if (url.startsWith('http:')) {
      return { icon: Shield, color: '#ea4335' }; // Red for insecure
    } else if (url.startsWith('magnet:')) {
      return { icon: Shield, color: '#1a73e8' }; // Blue for magnet
    }
    return { icon: Search, color: '#5f6368' }; // Gray for search
  }

  $: securityInfo = getSecurityIcon();
</script>

<div class="address-bar">
  <div class="address-bar-content">
    <!-- Navigation buttons -->
    <div class="nav-buttons">
      <button 
        class="nav-btn"
        on:click={handleBack}
        disabled={true}
        aria-label="Back"
      >
        <ArrowLeft size={16} />
      </button>
      <button 
        class="nav-btn"
        on:click={handleForward}
        disabled={true}
        aria-label="Forward"
      >
        <ArrowRight size={16} />
      </button>
      <button 
        class="nav-btn"
        on:click={handleRefresh}
        aria-label="Refresh"
      >
        <RefreshCw size={16} class="{loading ? 'animate-spin' : ''}" />
      </button>
    </div>

    <!-- Address input -->
    <div class="address-input-container">
      <!-- Security/Search indicator -->
      <div class="security-indicator">
        <svelte:component 
          this={securityInfo.icon} 
          size={16} 
          style="color: {securityInfo.color}" 
        />
      </div>

      <!-- URL input -->
      <input 
        bind:this={inputElement}
        bind:value={inputValue}
        on:keydown={handleKeyDown}
        on:focus={selectAll}
        class="url-input"
        placeholder="Search Google or type a URL"
        spellcheck="false"
        autocomplete="off"
      />

      <!-- Search/Go button -->
      <button 
        class="search-btn nav-btn"
        on:click={handleSubmit}
        aria-label="Go"
      >
        <Search size={16} />
      </button>
    </div>

    <!-- Action buttons -->
    <div class="action-buttons">
      <button 
        class="send-btn"
        on:click={handleSendClick}
        aria-label="Send file via WebTorrent"
        title="Seed a file"
      >
        <Send size={14} />
        Send
      </button>
      
      <button 
        class="nav-btn"
        aria-label="More options"
        title="More options"
      >
        <MoreVertical size={16} />
      </button>
    </div>
  </div>
</div>

<style>
  .address-bar-content {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .nav-buttons {
    display: flex;
    gap: 2px;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .security-indicator {
    display: flex;
    align-items: center;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .search-btn {
    margin-left: 4px;
  }

  .send-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
</style>