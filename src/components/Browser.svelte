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
  let addressBarComponent;

  // Subscribe to tab store with debugging
  tabStore.subscribe(value => {
    console.log('Tab store updated:', value);
    const oldActiveTabId = activeTabId;
    tabs = value.tabs;
    activeTabId = value.activeTabId;
    
    // If activeTabId changed, handle the switch
    if (oldActiveTabId !== activeTabId) {
      console.log('Active tab changed from', oldActiveTabId, 'to', activeTabId);
      
      // Handle browser view switching when active tab changes
      if (window.electronAPI) {
        const newActiveTab = tabs.find(t => t.id === activeTabId);
        if (newActiveTab && newActiveTab.viewId) {
          console.log('Switching to browser view:', newActiveTab.viewId);
          window.electronAPI.setActiveBrowserView(newActiveTab.viewId);
        } else {
          console.log('No browser view for active tab, hiding all views');
          window.electronAPI.setActiveBrowserView(null);
        }
      }
    }
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
            case 'loading-finish':
              tabStore.updateTab(tab.id, { loading: false });
              // Only set fallback title if we still have a generic title AND no real title is coming
              setTimeout(() => {
                const currentTab = tabs.find(t => t.id === tab.id);
                if (currentTab && (currentTab.title === 'Loading...' || currentTab.title === 'New Tab')) {
                  try {
                    const url = new URL(currentTab.url);
                    const hostname = url.hostname || 'Unknown';
                    tabStore.updateTab(tab.id, { title: hostname });
                  } catch {
                    tabStore.updateTab(tab.id, { title: 'Page Loaded' });
                  }
                }
              }, 1000); // Wait 1 second to see if a real title comes
              break;
            case 'title-updated':
              // Always update with the actual page title when available - this takes priority
              if (data.title && data.title.trim() && data.title !== 'Loading...') {
                console.log('Updating tab title to:', data.title);
                tabStore.updateTab(tab.id, { title: data.title });
              }
              break;
            case 'favicon-updated':
              tabStore.updateTab(tab.id, { favicon: data.favicon });
              break;
            case 'navigate':
              tabStore.updateTab(tab.id, { 
                url: data.url,
                canGoBack: data.canGoBack || false,
                canGoForward: data.canGoForward || false
              });
              // Don't immediately update title on navigate - wait for page-title-updated
              break;
          }
        }
      });

      // Handle new tab requests from target="_blank" links
      window.electronAPI.onCreateNewTabWithUrl(async (url) => {
        console.log('Creating new tab for URL:', url);
        const tabId = tabStore.createTab(url, 'Loading...');
        
        // Switch to the new tab first
        tabStore.setActiveTab(tabId);
        
        // Then load the web content
        try {
          await handleWebContent(url, tabId);
          addLog(`New tab opened: ${url}`, 'info');
        } catch (error) {
          addLog(`Failed to load new tab: ${error.message}`, 'error');
          tabStore.updateTab(tabId, { loading: false, title: 'Failed to load' });
        }
      });

      // Handle address bar focus requests
      window.electronAPI.onFocusAddressBar(() => {
        if (addressBarComponent) {
          addressBarComponent.focusInput();
        }
      });

      // Handle tab process information
      window.electronAPI.onTabProcessInfo((data) => {
        const { viewId, type, processId, memoryInfo, message } = data;
        const tab = tabs.find(t => t.viewId === viewId);
        
        if (tab) {
          switch (type) {
            case 'created':
              tabStore.updateTab(tab.id, { 
                processId,
                processStatus: 'running',
                statusMessage: message
              });
              addLog(`Tab process created: PID ${processId}`, 'info');
              break;
              
            case 'crashed':
              tabStore.updateTab(tab.id, { 
                processStatus: 'crashed',
                statusMessage: message,
                loading: false
              });
              addLog(`Tab crashed: ${tab.title || tab.url}`, 'error');
              break;
              
            case 'unresponsive':
              tabStore.updateTab(tab.id, { 
                processStatus: 'unresponsive',
                statusMessage: message
              });
              addLog(`Tab became unresponsive: ${tab.title || tab.url}`, 'warning');
              break;
              
            case 'responsive':
              tabStore.updateTab(tab.id, { 
                processStatus: 'running',
                statusMessage: message
              });
              addLog(`Tab is responsive again: ${tab.title || tab.url}`, 'success');
              break;
              
            case 'memory-update':
              tabStore.updateTab(tab.id, { 
                processId,
                memoryInfo,
                processStatus: 'running'
              });
              // Only log high memory usage
              if (memoryInfo && memoryInfo.workingSetSize > 100 * 1024 * 1024) { // > 100MB
                addLog(`High memory usage in tab: ${Math.round(memoryInfo.workingSetSize / 1024 / 1024)}MB`, 'warning');
              }
              break;
              
            case 'process-gone':
              tabStore.updateTab(tab.id, { 
                processStatus: 'terminated',
                statusMessage: message,
                loading: false
              });
              addLog(`Tab process terminated: ${tab.title || tab.url}`, 'error');
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
      window.electronAPI.removeAllListeners('create-new-tab-with-url');
      window.electronAPI.removeAllListeners('focus-address-bar');
      window.electronAPI.removeAllListeners('tab-process-info');
      
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
    
    // Focus address bar for new tabs
    setTimeout(() => {
      if (addressBarComponent) {
        addressBarComponent.focusInput();
      }
    }, 100);
    
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
    // Just update the store - the subscription will handle browser view switching
    tabStore.setActiveTab(tabId);
  }

  async function handleAddressSubmit(event) {
    const { url, action } = event.detail;
    
    try {
      if (!url.trim()) return;

      if (activeTabId) {
        if (action === 'refresh') {
          // Handle refresh action - reload current page
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (activeTab && activeTab.viewId) {
            const view = window.electronAPI ? await window.electronAPI.navigateBrowserView(activeTab.viewId, activeTab.url) : null;
            if (view !== false) {
              addLog(`Page refreshed: ${activeTab.url}`, 'info');
            }
          }
        } else if (url.startsWith('magnet:')) {
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
    handleWebContent(url, activeTabId);
  }

  async function handleWebContent(url, tabId = null) {
    const targetTabId = tabId || activeTabId;
    
    try {
      console.log('handleWebContent called with:', { url, tabId: targetTabId, activeTabId });
      
      // Update tab to loading state
      tabStore.updateTab(targetTabId, { 
        url, 
        loading: true,
        title: 'Loading...',
        favicon: null // Clear favicon when loading new page
      });
      
      // Create browser view
      console.log('Creating browser view for:', url);
      const viewId = await window.electronAPI.createBrowserView(url);
      
      if (viewId) {
        console.log('Browser view created with ID:', viewId);
        
        // Update tab with view ID
        tabStore.updateTab(targetTabId, { 
          viewId
        });
        
        // If this is the active tab, set the view as active
        if (targetTabId === activeTabId) {
          console.log('Setting as active browser view since it\'s the active tab');
          const success = await window.electronAPI.setActiveBrowserView(viewId);
          if (!success) {
            console.error('Failed to set browser view as active');
          }
        }
        
        addLog(`Web content loaded: ${url}`, 'success');
      } else {
        throw new Error('Failed to create browser view');
      }
    } catch (error) {
      console.error('Web navigation error:', error);
      addLog(`Web navigation error: ${error.message}`, 'error');
      tabStore.updateTab(targetTabId, { 
        loading: false, 
        title: 'Failed to load',
        favicon: null 
      });
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

  function handleNavigation(event) {
    const { action } = event.detail;
    addLog(`Navigation: ${action}`, 'info');
  }

  async function handleReloadCrashedTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.viewId && tab.url) {
      try {
        const success = await window.electronAPI.reloadCrashedTab(tab.viewId, tab.url);
        if (success) {
          tabStore.updateTab(tabId, { 
            processStatus: 'running',
            loading: true,
            statusMessage: 'Reloading...'
          });
          addLog(`Reloading crashed tab: ${tab.title || tab.url}`, 'info');
        } else {
          addLog(`Failed to reload crashed tab: ${tab.title || tab.url}`, 'error');
        }
      } catch (error) {
        addLog(`Error reloading crashed tab: ${error.message}`, 'error');
      }
    }
  }

  async function handleTerminateTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.viewId) {
      try {
        const success = await window.electronAPI.terminateTabProcess(tab.viewId);
        if (success) {
          addLog(`Terminated tab process: ${tab.title || tab.url}`, 'info');
        } else {
          addLog(`Failed to terminate tab process: ${tab.title || tab.url}`, 'error');
        }
      } catch (error) {
        addLog(`Error terminating tab process: ${error.message}`, 'error');
      }
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
    bind:this={addressBarComponent}
    url={tabs.find(t => t.id === activeTabId)?.url || ''}
    loading={tabs.find(t => t.id === activeTabId)?.loading || false}
    canGoBack={tabs.find(t => t.id === activeTabId)?.canGoBack || false}
    canGoForward={tabs.find(t => t.id === activeTabId)?.canGoForward || false}
    viewId={tabs.find(t => t.id === activeTabId)?.viewId || null}
    on:submit={handleAddressSubmit}
    on:send={handleSendAction}
    on:navigation={handleNavigation}
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
    width: 100vw;
    background: var(--chrome-bg);
    overflow: hidden;
    position: relative;
  }

  .content-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: white;
    /* Ensure content area takes exactly the remaining space */
    min-height: 0;
    width: 100%;
  }

  /* Ensure tab content fills the content area properly */
  .content-area :global(.tab-content) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .content-area :global(.tab-content.hidden) {
    display: none;
  }

  .content-area :global(.tab-content.active) {
    display: block;
  }
</style>