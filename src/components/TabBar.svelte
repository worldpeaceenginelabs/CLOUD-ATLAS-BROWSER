<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Plus } from 'lucide-svelte';

  export let tabs = [];
  export let activeTabId = null;

  const dispatch = createEventDispatcher();

  function selectTab(tabId) {
    dispatch('selectTab', tabId);
  }

  function closeTab(tabId, event) {
    event.stopPropagation();
    dispatch('closeTab', tabId);
  }

  function newTab() {
    dispatch('newTab');
  }

  function getTabTitle(tab) {
    if (tab.title) return tab.title;
    if (tab.url) {
      if (tab.url.startsWith('magnet:')) return 'Torrent';
      return new URL(tab.url).hostname || tab.url;
    }
    return 'New Tab';
  }
</script>

<div class="tab-bar flex items-center bg-chrome-bg border-b border-chrome-border">
  <!-- Tabs -->
  <div class="tabs flex-1 flex overflow-x-auto">
    {#each tabs as tab (tab.id)}
      <div 
        class="tab flex items-center min-w-0 max-w-64 flex-shrink-0 cursor-pointer group
               {tab.id === activeTabId ? 'active bg-white border-t-2 border-t-blue-500' : 'bg-chrome-tab-hover hover:bg-chrome-tab-hover'}
               border-r border-chrome-border h-8 px-3"
        on:click={() => selectTab(tab.id)}
        on:keydown={(e) => e.key === 'Enter' && selectTab(tab.id)}
        role="tab"
        tabindex="0"
      >
        <!-- Favicon placeholder -->
        <div class="favicon w-4 h-4 mr-2 bg-gray-300 rounded-full flex-shrink-0"></div>
        
        <!-- Tab title -->
        <span class="tab-title text-sm text-gray-700 truncate flex-1 min-w-0">
          {getTabTitle(tab)}
        </span>
        
        <!-- Loading indicator -->
        {#if tab.loading}
          <div class="loading-spinner w-3 h-3 ml-2 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        {/if}
        
        <!-- Close button -->
        <button 
          class="close-btn ml-2 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
          on:click={(e) => closeTab(tab.id, e)}
          aria-label="Close tab"
        >
          <X size={12} class="text-gray-600" />
        </button>
      </div>
    {/each}
  </div>

  <!-- New tab button -->
  <button 
    class="new-tab-btn p-2 hover:bg-gray-200 rounded mx-1"
    on:click={newTab}
    aria-label="New tab"
  >
    <Plus size={16} class="text-gray-600" />
  </button>

  <!-- Window controls placeholder -->
  <div class="window-controls w-20 flex-shrink-0"></div>
</div>

<style>
  .tab {
    transition: background-color 0.1s ease;
  }
  
  .tab.active {
    position: relative;
    z-index: 1;
  }

  .tab:not(.active):hover {
    background-color: #f8f9fa;
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>