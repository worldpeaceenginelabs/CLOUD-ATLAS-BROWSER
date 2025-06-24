<script>
  import { onMount, onDestroy } from 'svelte';
  import TabBar from './TabBar.svelte';
  import AddressBar from './AddressBar.svelte';
  import TabContent from './TabContent.svelte';
  import DevSidebar from './DevSidebar.svelte';
  import SecurityModal from './SecurityModal.svelte';
  import { tabStore } from '../stores/tabStore.js';
  import { sidebarStore } from '../stores/sidebarStore.js';
  import { securityStore } from '../stores/securityStore.js';
  import { validateUrl, sanitizeInput } from '../utils/security.js';

  export let logs = [];
  export let addLog;

  let activeTabId = null;
  let tabs = [];
  let sidebarVisible = true;
  let sidebarWidth = 400;
  let securityModal = null;
  let securityWarnings = [];

  // Security: Track navigation attempts
  let navigationAttempts = [];
  const MAX_NAVIGATION_ATTEMPTS = 10;
  const NAVIGATION_WINDOW = 60000; // 1 minute

  // Subscribe to stores
  tabStore.subscribe(value => {
    tabs = value.tabs;
    activeTabId = value.activeTabId;
  });

  sidebarStore.subscribe(value => {
    sidebarVisible = value.visible;
    sidebarWidth = value.width;
  });

  securityStore.subscribe(value => {
    securityWarnings = value.warnings;
  });

  onMount(() => {
    // Security: Set up magnet link handler
    if (window.electronAPI) {
      window.electronAPI.onMagnetLink((magnetUri) => {
        handleMagnetLink(magnetUri);
      });

      // Security: Monitor for suspicious activity
      setupSecurityMonitoring();
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
      window.electronAPI.removeAllListeners('tab-update');
    }
  });

  function setupSecurityMonitoring() {
    // Monitor navigation patterns
    setInterval(() => {
      const now = Date.now();
      navigationAttempts = navigationAttempts.filter(
        attempt => now - attempt.timestamp < NAVIGATION_WINDOW
      );
    }, 30000);

    // Monitor for suspicious URLs
    window.addEventListener('beforeunload', (event) => {
      // Log navigation for security analysis
      addLog('Page unload detected', 'info');
    });
  }

  function handleNewTab() {
    try {
      const tabId = tabStore.createTab();
      addLog(`New tab created: ${tabId}`, 'info');
    } catch (error) {
      addLog(`Error creating tab: ${error.message}`, 'error');
      securityStore.addWarning('Tab creation failed', 'medium');
    }
  }

  function handleTabClose(tabId) {
    try {
      tabStore.closeTab(tabId);
      addLog(`Tab closed: ${tabId}`, 'info');
    } catch (error) {
      addLog(`Error closing tab: ${error.message}`, 'error');
    }
  }

  function handleTabSelect(tabId) {
    try {
      tabStore.setActiveTab(tabId);
      
      // Security: Log tab switching for monitoring
      addLog(`Switched to tab: ${tabId}`, 'info');
    } catch (error) {
      addLog(`Error selecting tab: ${error.message}`, 'error');
    }
  }

  async function handleAddressSubmit(event) {
    const { url, action } = event.detail;
    
    try {
      // Security: Validate and sanitize URL
      const sanitizedUrl = sanitizeInput(url);
      const validatedUrl = validateUrl(sanitizedUrl);
      
      if (!validatedUrl) {
        throw new Error('Invalid or potentially dangerous URL');
      }

      // Security: Check navigation rate limiting
      const now = Date.now();
      navigationAttempts.push({ timestamp: now, url: validatedUrl });
      
      if (navigationAttempts.length > MAX_NAVIGATION_ATTEMPTS) {
        securityStore.addWarning('Suspicious navigation pattern detected', 'high');
        addLog('Navigation rate limit exceeded', 'warn');
        return;
      }

      if (activeTabId) {
        // Security: Log navigation attempt
        addLog(`Navigation attempt: ${validatedUrl}`, 'info');
        
        // Handle different URL types securely
        if (validatedUrl.startsWith('magnet:')) {
          await handleMagnetLink(validatedUrl);
        } else {
          await handleWebNavigation(validatedUrl, action);
        }
      }
    } catch (error) {
      addLog(`Navigation error: ${error.message}`, 'error');
      securityStore.addWarning(`Navigation failed: ${error.message}`, 'medium');
      
      // Show security modal for dangerous URLs
      if (error.message.includes('dangerous')) {
        showSecurityModal('Potentially dangerous URL blocked', error.message);
      }
    }
  }

  async function handleWebNavigation(url, action) {
    try {
      tabStore.updateTab(activeTabId, { url, loading: true });
      
      // Security: Create isolated browser view for web content
      if (window.electronAPI) {
        const viewId = await window.electronAPI.createTabView(url);
        if (viewId) {
          tabStore.updateTab(activeTabId, { viewId, loading: false });
          await window.electronAPI.setActiveTabView(viewId);
          addLog(`Web content loaded in isolated view: ${viewId}`, 'success');
        } else {
          throw new Error('Failed to create secure browser view');
        }
      } else {
        // Fallback for non-Electron environments
        tabStore.updateTab(activeTabId, { loading: false });
      }
    } catch (error) {
      tabStore.updateTab(activeTabId, { loading: false });
      throw error;
    }
  }

  async function handleMagnetLink(magnetUri) {
    try {
      // Security: Validate magnet URI
      if (!window.electronAPI?.validateMagnetUri(magnetUri)) {
        throw new Error('Invalid magnet URI format');
      }

      // Create new tab for torrent or use existing
      let targetTabId = activeTabId;
      if (!targetTabId) {
        targetTabId = tabStore.createTab();
      }

      tabStore.updateTab(targetTabId, { 
        url: magnetUri, 
        loading: true,
        title: 'Loading Torrent...'
      });

      addLog(`Loading magnet link: ${magnetUri.substring(0, 50)}...`, 'info');
      
      // The torrent will be handled by TabContent component
      tabStore.updateTab(targetTabId, { loading: false });
      
    } catch (error) {
      addLog(`Magnet link error: ${error.message}`, 'error');
      securityStore.addWarning('Invalid magnet link blocked', 'medium');
    }
  }

  async function handleSendAction() {
    try {
      if (!window.electronAPI) {
        throw new Error('File operations require Electron environment');
      }

      // Security: Show file selection dialog
      const filePath = await window.electronAPI.selectFile();
      if (filePath) {
        addLog(`File selected for seeding: ${filePath}`, 'info');
        
        // Seed file and get magnet link
        await seedSelectedFile(filePath);
      }
    } catch (error) {
      addLog(`Send action error: ${error.message}`, 'error');
      securityStore.addWarning('File seeding failed', 'medium');
    }
  }

  async function seedSelectedFile(filePath) {
    try {
      // This will be handled by WebTorrentHandler
      addLog(`Preparing to seed: ${filePath}`, 'info');
      
      // Create new tab for seeding status
      const tabId = tabStore.createTab('', 'Seeding File...');
      tabStore.updateTab(tabId, { 
        seedingFile: filePath,
        loading: true 
      });
      
    } catch (error) {
      addLog(`Seeding error: ${error.message}`, 'error');
      throw error;
    }
  }

  function showSecurityModal(title, message) {
    securityModal = { title, message, visible: true };
  }

  function closeSecurityModal() {
    securityModal = null;
  }

  function handleSecurityWarning(warning) {
    addLog(`Security warning: ${warning.message}`, 'warn');
    showSecurityModal('Security Warning', warning.message);
  }

  // Security: Handle keyboard shortcuts securely
  function handleKeydown(event) {
    // Disable dangerous shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'I': // DevTools
        case 'J': // Console
        case 'U': // View Source
          if (!process.env.NODE_ENV === 'development') {
            event.preventDefault();
            addLog('Developer shortcut blocked in production', 'warn');
          }
          break;
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="browser-container flex flex-col h-full bg-chrome-bg">
  <!-- Security Warnings Banner -->
  {#if securityWarnings.length > 0}
    <div class="security-banner bg-red-100 border-b border-red-300 px-4 py-2">
      <div class="flex items-center justify-between">
        <span class="text-red-800 text-sm font-medium">
          {securityWarnings.length} security warning(s) detected
        </span>
        <button 
          class="text-red-600 hover:text-red-800 text-sm"
          on:click={() => securityStore.clearWarnings()}
        >
          Dismiss All
        </button>
      </div>
    </div>
  {/if}

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

  <!-- Main Content Area -->
  <div class="content-area flex flex-1 overflow-hidden">
    <!-- Tab Content -->
    <div 
      class="tab-content flex-1" 
      style="width: {sidebarVisible ? `calc(100% - ${sidebarWidth}px)` : '100%'}"
    >
      {#each tabs as tab (tab.id)}
        <TabContent 
          {tab} 
          active={tab.id === activeTabId}
          bind:logs={logs}
          {addLog}
          on:securityWarning={handleSecurityWarning}
        />
      {/each}
    </div>

    <!-- Developer Sidebar -->
    {#if sidebarVisible}
      <DevSidebar 
        {logs} 
        {securityWarnings}
        bind:width={sidebarWidth} 
      />
    {/if}
  </div>
</div>

<!-- Security Modal -->
{#if securityModal}
  <SecurityModal
    title={securityModal.title}
    message={securityModal.message}
    on:close={closeSecurityModal}
  />
{/if}

<style>
  .browser-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }

  .security-banner {
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>