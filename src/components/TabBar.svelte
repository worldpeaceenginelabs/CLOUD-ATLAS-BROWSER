<script>
  import { X, Plus, Globe, Download, Lock } from 'lucide-svelte';

  export let tabs = [];
  export let activeTabId = null;
  export let onNewTab = () => {};
  export let onCloseTab = () => {};
  export let onSelectTab = () => {};

  function handleNewTab() {
    onNewTab();
  }

  function handleCloseTab(tabId, event) {
    event.stopPropagation();
    onCloseTab(tabId);
  }

  function handleSelectTab(tabId) {
    onSelectTab(tabId);
  }

  function getTabIcon(tab) {
    if (tab.url?.startsWith('magnet:')) {
      return Download;
    }
    // Always return Globe for web content, regardless of protocol
    // The lock icon was confusing and the rotation was unnecessary
    return Globe;
  }

  function getTabTitle(tab) {
    if (tab.title && tab.title !== 'New Tab') {
      return tab.title;
    }
    
    if (tab.url?.startsWith('magnet:')) {
      return 'Torrent Download';
    }
    
    if (tab.seedingFile) {
      return 'Seeding File';
    }
    
    if (tab.url && tab.url !== 'about:blank') {
      try {
        const url = new URL(tab.url);
        return url.hostname || tab.url;
      } catch {
        return tab.url.substring(0, 30) + (tab.url.length > 30 ? '...' : '');
      }
    }
    
    return 'New Tab';
  }

  function handleTabKeydown(event, tabId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectTab(tabId);
    }
  }

  function handleCloseKeydown(event, tabId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCloseTab(tabId, event);
    }
  }

  function handleFaviconError(tab) {
    // Remove favicon if it fails to load
    tab.favicon = null;
  }
</script>

<div class="tab-bar">
  <!-- Tabs -->
  <div class="tabs-container">
    {#each tabs as tab (tab.id)}
      <div 
        class="tab {tab.id === activeTabId ? 'active' : ''}"
        on:click={() => handleSelectTab(tab.id)}
        on:keydown={(e) => handleTabKeydown(e, tab.id)}
        role="tab"
        tabindex="0"
        aria-selected={tab.id === activeTabId}
      >
        <!-- Tab Icon/Favicon -->
        {#if tab.favicon}
          <img 
            src={tab.favicon} 
            alt="Favicon" 
            class="tab-favicon"
            on:error={() => handleFaviconError(tab)}
          />
        {:else}
          <svelte:component 
            this={getTabIcon(tab)} 
            size={12} 
            class="tab-icon" 
          />
        {/if}

        <!-- Tab Title -->
        <span class="tab-title" title={getTabTitle(tab)}>
          {getTabTitle(tab)}
        </span>

        <!-- Loading Indicator -->
        {#if tab.loading}
          <div class="loading-indicator"></div>
        {/if}

        <!-- Close Button -->
        {#if tabs.length > 1}
          <button 
            class="close-btn"
            on:click={(e) => handleCloseTab(tab.id, e)}
            on:keydown={(e) => handleCloseKeydown(e, tab.id)}
            aria-label="Close tab"
            tabindex="-1"
          >
            <X size={10} />
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- New Tab Button -->
  <button 
    class="new-tab-btn"
    on:click={handleNewTab}
    aria-label="New tab"
    title="New tab (Ctrl+T)"
  >
    <Plus size={16} />
  </button>
</div>

<style>
  .tab-bar {
    background: var(--chrome-bg);
    border-bottom: 1px solid var(--chrome-border);
    height: var(--tab-bar-height);
    min-height: var(--tab-bar-height);
    max-height: var(--tab-bar-height);
    display: flex;
    align-items: flex-end;
    padding: 0 8px;
    flex-shrink: 0;
    backdrop-filter: blur(10px);
  }

  .tabs-container {
    display: flex;
    flex: 0 1 auto;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    margin-right: 4px;
  }
  
  .tabs-container::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Edge */
  }

  .tab {
    background: var(--chrome-tab-inactive);
    border: 1px solid var(--chrome-border);
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    height: 32px;
    min-width: 240px;
    max-width: 240px;
    margin-right: 1px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    cursor: pointer;
    position: relative;
    transition: background-color 0.1s ease;
    backdrop-filter: blur(10px);
  }

  .tab:hover {
    background: var(--chrome-tab-hover);
  }

  .tab.active {
    background: var(--chrome-tab);
    border-color: var(--chrome-border);
    z-index: 10;
  }

  .tab.active::before {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--chrome-tab);
  }
  
  :global(.tab-icon) {
    margin-right: 6px;
    flex-shrink: 0;
    color: var(--chrome-text-secondary);
  }

  .tab-favicon {
    width: 12px;
    height: 12px;
    margin-right: 6px;
    flex-shrink: 0;
    border-radius: 2px;
    object-fit: contain;
  }

  .tab-title {
    flex: 1;
    font-size: 12px;
    font-weight: 400;
    color: var(--chrome-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
    min-width: 0; /* Allow shrinking */
  }

  .tab.active .tab-title {
    color: var(--chrome-text);
    font-weight: 500;
  }

  .loading-indicator {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top: 2px solid var(--chrome-blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 6px;
    flex-shrink: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.1s ease;
    flex-shrink: 0;
    color: var(--chrome-text-secondary);
  }

  .tab:hover .close-btn {
    opacity: 1;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
  }

  .new-tab-btn {
    background: transparent;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    transition: background-color 0.1s ease;
    flex-shrink: 0;
    color: var(--chrome-text-secondary);
  }

  .new-tab-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>