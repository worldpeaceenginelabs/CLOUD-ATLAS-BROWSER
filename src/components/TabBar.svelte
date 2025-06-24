<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Plus, Globe, Download } from 'lucide-svelte';

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
    return Globe;
  }

  function getTabTitle(tab) {
    if (tab.title && tab.title !== 'New Tab') {
      return tab.title;
    }
    
    if (tab.url?.startsWith('magnet:')) {
      return 'Torrent Download';
    }
    
    if (tab.url && tab.url !== 'about:blank') {
      try {
        const url = new URL(tab.url);
        return url.hostname || tab.url;
      } catch {
        return tab.url.substring(0, 30) + (tab.url.length > 30 ? '...' : '');
      }
    }
    
    return tab.title || 'New Tab';
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

<div class="tab-bar flex items-center bg-gray-100 border-b border-gray-300 px-1 py-1">
  <!-- Tabs -->
  <div class="tabs-container flex flex-1 overflow-x-auto">
    {#each tabs as tab (tab.id)}
      <div 
        class="tab flex items-center min-w-32 max-w-64 px-3 py-2 mr-1 rounded-t cursor-pointer border-b-2 transition-all duration-200
               {tab.id === activeTabId 
                 ? 'bg-white border-blue-500 text-gray-900 shadow-sm' 
                 : 'bg-gray-200 border-transparent text-gray-700 hover:bg-gray-250'}"
        on:click={() => handleSelectTab(tab.id)}
        on:keydown={(e) => handleTabKeydown(e, tab.id)}
        role="tab"
        tabindex="0"
        aria-selected={tab.id === activeTabId}
      >
        <!-- Tab Icon -->
        <svelte:component 
          this={getTabIcon(tab)} 
          size={14} 
          class="mr-2 flex-shrink-0 {tab.loading ? 'animate-spin' : ''}" 
        />

        <!-- Tab Title -->
        <span class="tab-title text-sm truncate flex-1" title={getTabTitle(tab)}>
          {getTabTitle(tab)}
        </span>

        <!-- Loading Indicator -->
        {#if tab.loading}
          <div class="loading-dot w-2 h-2 bg-blue-500 rounded-full ml-2 animate-pulse"></div>
        {/if}

        <!-- Close Button -->
        {#if tabs.length > 1}
          <button 
            class="close-btn ml-2 p-1 rounded hover:bg-gray-300 transition-colors flex-shrink-0"
            on:click={(e) => handleCloseTab(tab.id, e)}
            on:keydown={(e) => handleCloseKeydown(e, tab.id)}
            aria-label="Close tab"
            tabindex="0"
          >
            <X size={12} />
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- New Tab Button -->
  <button 
    class="new-tab-btn p-2 mx-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
    on:click={handleNewTab}
    aria-label="New tab"
    title="New tab (Ctrl+T)"
  >
    <Plus size={16} class="text-gray-600" />
  </button>
</div>

<style>
  .tab-bar {
    min-height: 44px;
    user-select: none;
  }
  
  .tabs-container {
    scrollbar-width: none; /* Firefox */
  }
  
  .tabs-container::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Edge */
  }
  
  .tab {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .tab:hover .close-btn {
    opacity: 1;
  }

  .close-btn {
    opacity: 0.7;
  }

  .loading-dot {
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Tab scroll shadows */
  .tabs-container {
    mask-image: linear-gradient(
      to right,
      transparent 0px,
      black 10px,
      black calc(100% - 10px),
      transparent 100%
    );
  }
</style>