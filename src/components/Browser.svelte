<script>
  import { onMount, onDestroy } from 'svelte';
  import TabBar from './TabBar.svelte';
  import AddressBar from './AddressBar.svelte';
  import TabContent from './TabContent.svelte';
  import TorrentSidebar from './TorrentSidebar.svelte';
  import { tabStore } from '../stores/tabStore.js';
  import { torrentStore } from '../stores/torrentStore.js';

  export let addLog;
  
  // logs is for external reference only
  export const logs = [];

  let activeTabId = null;
  let tabs = [];
  let addressBarComponent;
  let sidebarOpen = false;
  let sidebarWidth = 600; // Default, will be updated by torrentStore subscription

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

  // Subscribe to torrent store for sidebar state
  torrentStore.subscribe(state => {
    sidebarOpen = state.sidebarOpen;
    sidebarWidth = state.sidebarWidth;
  });

  onMount(() => {
    // Set up magnet link handler
    if (window.electronAPI) {
      window.electronAPI.onMagnetLink((magnetUri) => {
        handleMagnetLink(magnetUri);
      });

      // Set up torrent event listeners
      window.electronAPI.onTorrentProgress((data) => {
        // Update torrent store with progress
        torrentStore.updateProgress(data.magnetUri, data);
        
        // Progress updates are handled by the torrent store
        // Database saves only happen on status changes (completion, pause, resume)
      });

      window.electronAPI.onTorrentCompleted((data) => {
        // Update torrent status to completed
        const torrent = torrentStore.findTorrentByMagnet(data.magnetUri);
        if (torrent) {
          torrentStore.setTorrentStatus(torrent.infoHash, 'completed');
          
          // Save the completed status to persistence
          setTimeout(async () => {
            const { persistenceStore } = await import('../stores/persistenceStore.js');
            await persistenceStore.saveTorrent({ ...torrent, status: 'completed' }, false);
          }, 100);
        }
        addLog(`Torrent completed: ${data.name}`, 'success');
      });

      window.electronAPI.onTorrentError((message) => {
        addLog(`Torrent error: ${message}`, 'error');
      });

      window.electronAPI.onTorrentWarning((message) => {
        addLog(`Torrent warning: ${message}`, 'warning');
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

      // Set up fullscreen detection
      setupFullscreenDetection();

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

      // Handle new tab keyboard shortcut
      window.electronAPI.onNewTab(() => {
        handleNewTab();
      });

      // Handle close current tab keyboard shortcut
      window.electronAPI.onCloseCurrentTab(() => {
        if (activeTabId) {
          handleTabClose(activeTabId);
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
      window.electronAPI.removeAllListeners('torrent-warning');
      window.electronAPI.removeAllListeners('web-navigation');
      window.electronAPI.removeAllListeners('create-new-tab-with-url');
      window.electronAPI.removeAllListeners('focus-address-bar');
      window.electronAPI.removeAllListeners('new-tab');
      window.electronAPI.removeAllListeners('close-current-tab');
      window.electronAPI.removeAllListeners('tab-process-info');
      
      // Close all browser views
      tabs.forEach(tab => {
        if (tab.viewId) {
          window.electronAPI.closeBrowserView(tab.viewId);
        }
      });
    }

    // Cleanup fullscreen detection
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
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
      if (!url.trim() && action !== 'refresh') return;

      if (action === 'refresh') {
        // Handle refresh action - reload current page
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.viewId && activeTab.url && 
            activeTab.url !== 'about:blank' && activeTab.url !== '') {
          // Use the dedicated reload method
          if (window.electronAPI) {
            try {
              const success = await window.electronAPI.reloadBrowserView(activeTab.viewId);
              if (success) {
                addLog(`Page refreshed: ${activeTab.url}`, 'info');
              } else {
                addLog('Cannot refresh: no content loaded', 'info');
              }
            } catch (error) {
              addLog(`Refresh error: ${error.message}`, 'error');
            }
          }
        } else {
          addLog('Nothing to refresh - tab is empty', 'info');
        }
      } else if (url.startsWith('magnet:')) {
        // Handle magnet links via sidebar instead of creating tabs
        await handleMagnetLink(url);
      } else {
        // Handle regular web navigation
        handleWebNavigation(url, action);
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
      addLog(`Processing magnet link: ${magnetUri.substring(0, 50)}...`, 'info');
      
      // Check for duplicates first
      if (torrentStore.torrentExists(magnetUri)) {
        addLog(`Torrent already exists - skipping duplicate`, 'warning');
        return;
      }
      
      // Add torrent via main process
      const torrentInfo = await window.electronAPI.addTorrent(magnetUri);
      
      if (torrentInfo) {
        // Add to torrent store (with built-in deduplication)
        const torrentId = torrentStore.addTorrent(magnetUri, torrentInfo, 'download');
        
        if (torrentId) {
          addLog(`Torrent added: ${torrentInfo.name}`, 'success');
          
          // Save to persistence (with deduplication for NEW torrents)
          const { persistenceStore } = await import('../stores/persistenceStore.js');
          const saved = await persistenceStore.saveTorrent({
            id: torrentId,
            magnetUri,
            infoHash: torrentStore.extractInfoHash(magnetUri),
            name: torrentInfo.name,
            status: 'download',
            files: torrentInfo.files,
            dateAdded: new Date(),
            actualDownloadPath: null, // Will be set when download event fires
            torrentType: 'download',
            websiteType: null
          }, true); // ← TRUE = this is a new torrent, check for duplicates
          
          if (!saved) {
            addLog(`Torrent already in database - skipping save`, 'info');
          }
        } else {
          addLog(`Duplicate torrent detected - not added to store`, 'info');
        }
      } else {
        throw new Error('Failed to add torrent');
      }
      
    } catch (error) {
      addLog(`Magnet link error: ${error.message}`, 'error');
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

        // Add to torrent store as a sharing torrent, store seedPath
        if (seedResult && seedResult.magnetUri) {
          const torrentId = torrentStore.addTorrent(seedResult.magnetUri, {
            ...seedResult,
            seedPath: filePath // Store the original path
          }, 'seeding');
          if (torrentId) {
            // Save to persistence
            const { persistenceStore } = await import('../stores/persistenceStore.js');
            await persistenceStore.saveTorrent({
              id: torrentId,
              magnetUri: seedResult.magnetUri,
              infoHash: torrentStore.extractInfoHash(seedResult.magnetUri),
              name: seedResult.name,
              status: 'download',
              files: seedResult.files,
              dateAdded: new Date(),
              actualDownloadPath: null,
              torrentType: 'seeding',
              seedPath: filePath, // Persist the original path
              websiteType: null
            }, true);
          }
        }

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

  // Set up fullscreen detection
  function setupFullscreenDetection() {
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Also listen for fullscreen element changes (for video elements)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'fullscreen') {
          handleFullscreenChange();
        }
      });
    });
    
    // Observe the document for fullscreen attribute changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['fullscreen']
    });
  }

  function handleFullscreenChange() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    console.log('Fullscreen state changed in renderer:', isFullscreen);
    
    // Notify main process about fullscreen state change
    if (window.electronAPI) {
      window.electronAPI.handleFullscreenChange(isFullscreen);
    }
  }
</script>

<!-- Browser Container -->
<div class="browser-window">
  <!-- Tab Bar -->
  <TabBar 
    {tabs} 
    {activeTabId} 
    onNewTab={handleNewTab}
    onCloseTab={(tabId) => handleTabClose(tabId)}
    onSelectTab={(tabId) => handleTabSelect(tabId)}
  />

  <!-- Address Bar -->
  <AddressBar 
    bind:this={addressBarComponent}
    url={tabs.find(t => t.id === activeTabId)?.url || ''}
    loading={tabs.find(t => t.id === activeTabId)?.loading || false}
    canGoBack={tabs.find(t => t.id === activeTabId)?.canGoBack || false}
    canGoForward={tabs.find(t => t.id === activeTabId)?.canGoForward || false}
    viewId={tabs.find(t => t.id === activeTabId)?.viewId || null}
    onSubmit={(event) => handleAddressSubmit({ detail: event })}
    onSend={handleSendAction}
    onNavigation={(event) => handleNavigation({ detail: event })}
  />

  <!-- Main Content Area with Sidebar -->
  <div class="content-wrapper">
    <!-- Content Area -->
    <div 
      class="content-area" 
      style="{sidebarOpen ? `margin-right: ${sidebarWidth}px` : ''}"
    >
      {#each tabs as tab (tab.id)}
        <TabContent 
          {tab} 
          active={tab.id === activeTabId}
          {addLog}
        />
      {/each}
    </div>

    <!-- Torrent Sidebar -->
    <TorrentSidebar {addLog} />
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

  .content-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    min-height: 0;
  }

  .content-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: white;
    transition: margin-right 0.3s ease;
    min-height: 0;
    width: 100%;
  }

  /* Remove all problematic CSS that overrides centering */
  /* .content-area :global(.tab-content) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  } */

  /* .content-area :global(.tab-content.hidden) {
    display: none;
  } */

  /* .content-area :global(.tab-content.active) {
    display: block;
  } */

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .content-area {
      margin-right: 0 !important;
    }
  }
</style>