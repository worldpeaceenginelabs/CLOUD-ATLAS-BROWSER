<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Plus, Globe, Download, Lock } from 'lucide-svelte';

  export let tabs = [];
  export let activeTabId = null;

  const dispatch = createEventDispatcher();

  function handleNewTab() {
    dispatch('newTab');
  }

  function handleCloseTab(tabId, event) {
    event.stopPropagation();
    dispatch('closeTab', tabId);
  }

  function handleSelectTab(tabId) {
    dispatch('selectTab', tabId);
  }

  function getTabIcon(tab) {
    if (tab.url?.startsWith('magnet:')) {
      return Download;
    }
    if (tab.url?.startsWith('https:')) {
      return Lock;
    }
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
        <!-- Tab Icon -->
        <svelte:component 
          this={getTabIcon(tab)} 
          size={12} 
          class="tab-icon {tab.loading ? 'animate-spin' : ''}" 
        />

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
  .tabs-container {
    display: flex;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
  }
  
  .tabs-container::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Edge */
  }
  
  :global(.tab-icon) {
    margin-right: 6px;
    flex-shrink: 0;
    color: #5f6368;
  }

  .tab-title {
    flex: 1;
    font-size: 12px;
    font-weight: 400;
    color: #3c4043;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
  }

  .tab.active .tab-title {
    color: #202124;
    font-weight: 500;
  }

  .loading-indicator {
    width: 12px;
    height: 12px;
    border: 2px solid #e8eaed;
    border-top: 2px solid #1a73e8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 6px;
    flex-shrink: 0;
  }

  .close-btn {
    flex-shrink: 0;
  }
</style>