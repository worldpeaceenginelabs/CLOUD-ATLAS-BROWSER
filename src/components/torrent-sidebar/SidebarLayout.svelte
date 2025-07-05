<script>
  import { onMount, onDestroy } from 'svelte';
  import { torrentStore } from '../../stores/torrentStore.js';
  import { persistenceStore } from '../../stores/persistenceStore.js';

  export let addLog = () => {};

  let sidebarOpen = false;
  let sidebarWidth = 500;
  let resizing = false;
  let sidebarElement;

  // Subscribe to torrent store
  const unsubscribe = torrentStore.subscribe(state => {
    sidebarOpen = state.sidebarOpen;
    sidebarWidth = state.sidebarWidth;
  });

  onMount(async () => {
    try {
      const savedSidebarOpen = await persistenceStore.loadUIState('sidebarOpen', false);
      const savedSidebarWidth = await persistenceStore.loadUIState('sidebarWidth', 600);
      
      torrentStore.setSidebarOpen(savedSidebarOpen);
      torrentStore.setSidebarWidth(savedSidebarWidth);
      
      // Notify main process about initial sidebar state
      if (window.electronAPI) {
        window.electronAPI.updateSidebarState(savedSidebarOpen, savedSidebarWidth);
      }
      
      setupResizeHandlers();
    } catch (error) {
      console.error('Failed to load persisted data:', error);
      addLog('Failed to restore previous session data', 'warning');
    }
  });

  onDestroy(() => {
    unsubscribe();
    if (persistenceStore) {
      persistenceStore.saveUIState('sidebarOpen', sidebarOpen);
      persistenceStore.saveUIState('sidebarWidth', sidebarWidth);
    }
  });

  function setupResizeHandlers() {
    let startX = 0;
    let startWidth = 0;

    function handleMouseDown(e) {
      resizing = true;
      startX = e.clientX;
      startWidth = sidebarWidth;
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    function handleMouseMove(e) {
      if (!resizing) return;
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(250, Math.min(600, startWidth + deltaX));
      torrentStore.setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      resizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistenceStore.saveUIState('sidebarWidth', sidebarWidth);
    }

    const resizeHandle = sidebarElement?.querySelector('.resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }
  }
</script>

{#if sidebarOpen}
  <div class="sidebar" style="width: {sidebarWidth}px;" bind:this={sidebarElement}>
    <div class="resize-handle"></div>
    
    <div class="header">
      <h2>Torrent Manager</h2>
      <div class="stats">
        <span>Active: {$torrentStore.torrents.filter(t => t.status === 'downloading').length}</span>
        <span>Total: {$torrentStore.torrents.length}</span>
      </div>
    </div>

    <slot />
  </div>
{/if}

<style>
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    background: var(--chrome-bg);
    border-left: 1px solid var(--chrome-border);
    z-index: 50;
    display: flex;
    flex-direction: column;
    margin-top: 84px; /* Tab + Address bar height */
    backdrop-filter: blur(10px);
  }

  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    background: transparent;
    cursor: col-resize;
    z-index: 10;
  }

  .resize-handle:hover {
    background: var(--chrome-blue);
  }

  .header {
    padding: 16px;
    border-bottom: 1px solid var(--chrome-border);
    background: rgba(255, 255, 255, 0.05);
    text-align: center;
    backdrop-filter: blur(10px);
  }

  .header h2 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--chrome-text);
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
  }

  .stats span {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--chrome-border);
    color: var(--chrome-text-secondary);
    backdrop-filter: blur(10px);
  }
</style> 