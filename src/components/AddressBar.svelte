<script>
  import { Search, Send, Shield, RefreshCw, ArrowLeft, ArrowRight, MoreVertical } from 'lucide-svelte';
  import { torrentStore } from '../stores/torrentStore.js';

  export let url = '';
  export let loading = false;
  export let canGoBack = false;
  export let canGoForward = false;
  export let viewId = null;
  export let onSubmit = () => {};
  export let onSend = () => {};
  export let onNavigation = () => {};

  let sidebarOpen = false;

  // Subscribe to sidebar state
  const unsubscribe = torrentStore.subscribe(state => {
    sidebarOpen = state.sidebarOpen;
  });

  import { onDestroy } from 'svelte';
  
  onDestroy(() => {
    unsubscribe();
  });

  let inputValue = url;
  let inputElement;

  $: inputValue = url;

  // Focus the input when requested
  export function focusInput() {
    if (inputElement) {
      inputElement.focus();
      inputElement.select();
    }
  }

  function handleSubmit() {
    if (inputValue.trim()) {
      let processedUrl = inputValue.trim();
      
      // Check if it's a magnet link
      if (processedUrl.startsWith('magnet:')) {
        onSubmit({ url: processedUrl, action: 'torrent' });
      } else if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
        onSubmit({ url: processedUrl, action: 'navigate' });
      } else if (processedUrl.includes('.') && !processedUrl.includes(' ')) {
        // Assume it's a domain
        onSubmit({ url: `https://${processedUrl}`, action: 'navigate' });
      } else {
        // Search query
        onSubmit({ 
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
    onSend();
  }

  function handleRefresh() {
    // Only refresh if there's a valid URL and a browser view
    if (url && url.trim() && url !== 'about:blank' && url !== '' && viewId) {
      onSubmit({ url, action: 'refresh' });
    } else {
      console.log('Refresh button clicked but no valid content to refresh');
    }
  }

  async function handleBack() {
    if (canGoBack && viewId && window.electronAPI) {
      await window.electronAPI.goBack(viewId);
      onNavigation({ action: 'back' });
    }
  }

  async function handleForward() {
    if (canGoForward && viewId && window.electronAPI) {
      await window.electronAPI.goForward(viewId);
      onNavigation({ action: 'forward' });
    }
  }

  // NEW FUNCTION: Toggle sidebar
  function handleToggleSidebar() {
    torrentStore.toggleSidebar();
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
        disabled={!canGoBack}
        aria-label="Back"
        title="Go back"
      >
        <ArrowLeft size={16} />
      </button>
      <button 
        class="nav-btn"
        on:click={handleForward}
        disabled={!canGoForward}
        aria-label="Forward"
        title="Go forward"
      >
        <ArrowRight size={16} />
      </button>
      <button 
        class="nav-btn"
        on:click={handleRefresh}
        aria-label="Refresh"
        title="Reload page (F5)"
      >
        <RefreshCw size={16} class="{loading ? 'animate-spin' : ''}" />
      </button>
    </div>

    <!-- Address input container - takes remaining space -->
    <div class="address-input-container">
      <!-- Security/Search indicator -->
      <div class="security-indicator">
        <svelte:component 
          this={securityInfo.icon} 
          size={16} 
          style="color: {securityInfo.color}" 
        />
      </div>

      <!-- URL input - expands to fill space -->
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
        title="Go to address"
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
      
      <!-- FIXED: Added click handler and better labeling -->
      <button 
        class="nav-btn"
        on:click={handleToggleSidebar}
        aria-label="Toggle torrent sidebar"
        title="Toggle torrent sidebar"
      >
        <MoreVertical size={16} />
      </button>
    </div>
  </div>
</div>

<style>
  .address-bar {
    background: var(--chrome-bg);
    border-bottom: 1px solid var(--chrome-border);
    height: var(--address-bar-height);
    min-height: var(--address-bar-height);
    max-height: var(--address-bar-height);
    padding: 8px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    width: 100%; /* Ensure full width */
    backdrop-filter: blur(10px);
  }

  .address-bar-content {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%; /* Take full width instead of max-width */
    height: 32px;
  }

  .nav-buttons {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .address-input-container {
    background: var(--chrome-address-bar);
    border: 1px solid var(--chrome-border);
    border-radius: 24px;
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    flex: 1; /* Take all remaining horizontal space */
    min-width: 0; /* Allow shrinking */
    backdrop-filter: blur(10px);
  }

  .address-input-container:focus-within {
    border-color: var(--chrome-blue);
    box-shadow: 0 0 0 1px var(--chrome-blue);
  }

  .security-indicator {
    display: flex;
    align-items: center;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .url-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: var(--chrome-text);
    min-width: 0; /* Allow shrinking */
  }

  .url-input::placeholder {
    color: var(--chrome-text-secondary);
  }

  .search-btn {
    margin-left: 4px;
    flex-shrink: 0;
  }

  .send-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Navigation button styles */
  .nav-btn {
    width: 32px;
    height: 32px;
    border-radius: 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.1s ease;
    flex-shrink: 0;
    color: var(--chrome-text);
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .send-btn {
    background: var(--chrome-blue);
    border: none;
    border-radius: 4px;
    color: white;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.1s ease;
    backdrop-filter: blur(10px);
  }

  .send-btn:hover {
    background: #8bc4ff;
  }
</style>