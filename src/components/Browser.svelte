<script>
  import { onMount, onDestroy } from 'svelte';
  import TabBar from './TabBar.svelte';
  import AddressBar from './AddressBar.svelte';
  import TabContent from './TabContent.svelte';
  import { tabStore } from '../stores/tabStore.js';

  export let addLog;
  
  // logs is for external reference only
  export const logs = [];

  let activeTabId = null;
  let tabs = [];

  // Subscribe to tab store
  tabStore.subscribe(value => {
    tabs = value.tabs;
    activeTabId = value.activeTabId;
  });

  onMount(() => {
    // Set up magnet link handler
    if (window.electronAPI) {
      window.electronAPI.onMagnetLink((magnetUri) => {
        handleMagnetLink(magnetUri);
      });

      // Set up torrent event listeners
      window.electronAPI.onTorrentProgress((data) => {
        // Update relevant tab with progress
        const tab = tabs.find(t => t.url === data.magnetUri);
        if (tab) {
          tabStore.updateTab(tab.id, { torrentProgress: data });
        }
      });

      window.electronAPI.onTorrentCompleted((data) => {
        addLog(`Torrent completed: ${data.name}`, 'success');
      });

      window.electronAPI.onTorrentError((message) => {
        addLog(`Torrent error: ${message}`, 'error');
      });

      // Set up web navigation listeners
      window.electronAPI.onWebNavigation((data) => {
        const tab = tabs.find(t => t.viewId === data.viewId);
        if (tab) {
          switch (data.event) {
            case 'loading-start':
              tabStore.updateTab(tab.id, { loading: true });
              break;
            case 'loading-stop':
              tabStore.updateTab(tab.id, { loading: false });
              break;
            case 'title-updated':
              tabStore.updateTab(tab.id, { title: data.title });
              break;
            case 'navigate':
              tabStore.updateTab(tab.id, { url: data.url });
              break;
          }
        }
      });
    }

    // Initialize with one tab if none exist
    if (tabs.length === 0) {
      handleNewTab();
    }
  });

  onDestroy(() => {
    // Cleanup event listeners
    if (window.electronAPI) {
      window.electronAPI.removeAllListeners('handle-magnet-link');
      window.electronAPI.removeAllListeners('torrent-progress');
      window.electronAPI.removeAllListeners('torrent-completed');
      window.electronAPI.removeAllListeners('torrent-error');
      window.electronAPI.removeAllListeners('web-navigation');
      
      // Close all browser views
      tabs.forEach(tab => {
        if (tab.viewId) {
          window.electronAPI.closeBrowserView(tab.viewId);
        }
      });
    }
  });

  function handleNewTab() {
    const tabId = tabStore.createTab();
    addLog(`New tab created: ${tabId}`, 'info');
  }

  function handleTabClose(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.viewId) {
      window.electronAPI.closeBrowserView(tab.viewId);
    }
    tabStore.closeTab(tabId);
    addLog(`Tab closed: ${tabId}`, 'info');
  }

  function handleTabSelect(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.viewId) {
      window.electronAPI.setActiveBrowserView(tab.viewId);
    } else {
      // Hide any active browser view if switching to non-web tab
      window.electronAPI.setActiveBrowserView(null);
    }
    tabStore.setActiveTab(tabId);
  }

  async function handleAddressSubmit(event) {
    const { url, action } = event.detail;
    
    try {
      if (!url.trim()) return;

      if (activeTabId) {
        if (url.startsWith('magnet:')) {
          await handleMagnetLink(url);
        } else {
          // Handle regular web navigation
          handleWebNavigation(url, action);
        }
      }
    } catch (error) {
      addLog(`Navigation error: ${error.message}`, 'error');
    }
  }

  function handleWebNavigation(url, action) {
    // Create browser view for web content
    handleWebContent(url);
  }

  async function handleWebContent(url) {
    try {
      // Create browser view
      const viewId = await window.electronAPI.createBrowserView(url);
      if (viewId) {
        tabStore.updateTab(activeTabId, { 
          url, 
          viewId,
          loading: true,
          title: 'Loading...'
        });
        
        // Set as active view
        await window.electronAPI.setActiveBrowserView(viewId);
        addLog(`Web content loaded: ${url}`, 'success');
      } else {
        throw new Error('Failed to create browser view');
      }
    } catch (error) {
      addLog(`Web navigation error: ${error.message}`, 'error');
      tabStore.updateTab(activeTabId, { loading: false });
    }
  }

  async function handleMagnetLink(magnetUri) {
    try {
      // Create new tab for torrent or use existing
      let targetTabId = activeTabId;
      if (!targetTabId || !tabs.find(t => t.id === targetTabId)?.url.startsWith('magnet:')) {
        targetTabId = tabStore.createTab();
      }

      tabStore.updateTab(targetTabId, { 
        url: magnetUri, 
        loading: true,
        title: 'Loading Torrent...'
      });

      addLog(`Loading magnet link: ${magnetUri.substring(0, 50)}...`, 'info');
      
      // Add torrent via main process
      const torrentInfo = await window.electronAPI.addTorrent(magnetUri);
      
      tabStore.updateTab(targetTabId, { 
        loading: false,
        title: torrentInfo.name,
        torrentInfo
      });
      
      addLog(`Torrent loaded: ${torrentInfo.name}`, 'success');
      
    } catch (error) {
      addLog(`Magnet link error: ${error.message}`, 'error');
      if (targetTabId) {
        tabStore.updateTab(targetTabId, { loading: false });
      }
    }
  }

  async function handleSendAction() {
    try {
      if (!window.electronAPI) {
        throw new Error('File operations require Electron environment');
      }

      const filePath = await window.electronAPI.selectFile();
      if (filePath) {
        addLog(`File selected for seeding: ${filePath}`, 'info');
        
        // Seed file via main process
        const seedResult = await window.electronAPI.seedFile(filePath);
        
        // Create new tab for seeding status
        const tabId = tabStore.createTab('', 'Seeding File...');
        tabStore.updateTab(tabId, { 
          seedingFile: filePath,
          generatedMagnet: seedResult.magnetUri,
          loading: false 
        });
        
        addLog(`File seeded: ${seedResult.magnetUri}`, 'success');
      }
    } catch (error) {
      addLog(`Send action error: ${error.message}`, 'error');
    }
  }
</script>

<!-- Browser Container -->
<div class="browser-window">
  <!-- Tab Bar -->
  <TabBar 
    {tabs} 
    {activeTabId} 
    on:newTab={handleNewTab}
    on:closeTab={(e) => handleTabClose(e.detail)}
    on:selectTab={(e) => handleTabSelect(e.detail)}
  />

  <!-- Address Bar -->
  <AddressBar 
    url={tabs.find(t => t.id === activeTabId)?.url || ''}
    loading={tabs.find(t => t.id === activeTabId)?.loading || false}
    on:submit={handleAddressSubmit}
    on:send={handleSendAction}
  />

  <!-- Content Area -->
  <div class="content-area">
    {#each tabs as tab (tab.id)}
      <TabContent 
        {tab} 
        active={tab.id === activeTabId}
        {addLog}
      />
    {/each}
  </div>
</div>

<style>
  .browser-window {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--chrome-bg);
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: white;
  }

  /* Ensure content area takes remaining space */
  .content-area :global(.tab-content) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
  }

  .content-area :global(.tab-content.hidden) {
    display: none;
  }

  .content-area :global(.tab-content.active) {
    display: block;
  }
</style>