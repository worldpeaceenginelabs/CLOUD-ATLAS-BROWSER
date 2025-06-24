<script>
  import { Settings, X } from 'lucide-svelte';
  import { sidebarStore } from '../stores/sidebarStore.js';

  export let logs = [];
  export let width = 400;

  let activeTab = 'console';
  let resizing = false;
  let startX = 0;
  let startWidth = 0;

  const tabs = [
    { id: 'console', label: 'Console', icon: '📋' },
    { id: 'network', label: 'Network', icon: '🌐' },
    { id: 'elements', label: 'Elements', icon: '🏗️' },
    { id: 'sources', label: 'Sources', icon: '📁' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'application', label: 'Application', icon: '⚙️' }
  ];

  function startResize(event) {
    resizing = true;
    startX = event.clientX;
    startWidth = width;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }

  function handleResize(event) {
    if (!resizing) return;
    const deltaX = startX - event.clientX;
    const newWidth = Math.max(200, Math.min(800, startWidth + deltaX));
    width = newWidth;
    sidebarStore.setWidth(newWidth);
  }

  function stopResize() {
    resizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }

  function closeSidebar() {
    sidebarStore.toggle();
  }

  function clearConsole() {
    logs = [];
  }

  function getLogIcon(type) {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'success': return '✅';
      case 'info': 
      default: return 'ℹ️';
    }
  }

  function getLogClass(type) {
    switch (type) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'info':
      default: return 'text-blue-600';
    }
  }
</script>

<div class="dev-sidebar bg-chrome-sidebar-dark text-gray-200 flex flex-col" style="width: {width}px;">
  <!-- Resize handle -->
  <div 
    class="resize-handle absolute left-0 top-0 w-1 h-full cursor-ew-resize bg-chrome-border hover:bg-blue-500 transition-colors"
    on:mousedown={startResize}
  ></div>

  <!-- Sidebar header -->
  <div class="sidebar-header flex items-center justify-between p-3 border-b border-gray-700">
    <h3 class="font-medium text-sm">Developer Tools</h3>
    <button 
      class="close-btn p-1 rounded hover:bg-gray-700"
      on:click={closeSidebar}
      aria-label="Close Developer Tools"
    >
      <X size={16} />
    </button>
  </div>

  <!-- Tab navigation -->
  <div class="tab-nav flex border-b border-gray-700 overflow-x-auto">
    {#each tabs as tab}
      <button 
        class="tab-btn flex items-center px-3 py-2 text-xs font-medium whitespace-nowrap
               {activeTab === tab.id ? 'bg-gray-800 border-b-2 border-blue-500 text-blue-400' : 'hover:bg-gray-700'}"
        on:click={() => activeTab = tab.id}
      >
        <span class="mr-1">{tab.icon}</span>
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div class="tab-content flex-1 overflow-hidden">
    {#if activeTab === 'console'}
      <div class="console-panel h-full flex flex-col">
        <!-- Console toolbar -->
        <div class="console-toolbar flex items-center justify-between p-2 border-b border-gray-700">
          <div class="console-filters flex items-center space-x-2">
            <button class="filter-btn px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">
              All
            </button>
            <button class="filter-btn px-2 py-1 text-xs rounded hover:bg-gray-700">
              Errors
            </button>
            <button class="filter-btn px-2 py-1 text-xs rounded hover:bg-gray-700">
              Warnings
            </button>
            <button class="filter-btn px-2 py-1 text-xs rounded hover:bg-gray-700">
              Info
            </button>
          </div>
          <div class="console-actions flex items-center space-x-2">
            <button 
              class="action-btn p-1 rounded hover:bg-gray-700"
              on:click={clearConsole}
              aria-label="Clear console"
            >
              🗑️
            </button>
            <button class="action-btn p-1 rounded hover:bg-gray-700" aria-label="Settings">
              <Settings size={14} />
            </button>
          </div>
        </div>

        <!-- Console output -->
        <div class="console-output flex-1 overflow-y-auto p-2 font-mono text-xs">
          {#each logs as log, index (index)}
            <div class="console-entry flex items-start space-x-2 py-1 border-b border-gray-800 hover:bg-gray-800">
              <span class="log-icon flex-shrink-0">{getLogIcon(log.type)}</span>
              <span class="timestamp text-gray-500 flex-shrink-0 w-20">{log.timestamp}</span>
              <span class="log-message flex-1 {getLogClass(log.type)}">{log.message}</span>
            </div>
          {/each}
          
          {#if logs.length === 0}
            <div class="empty-console text-center text-gray-500 py-8">
              <div class="text-2xl mb-2">📋</div>
              <p>Console is empty</p>
              <p class="text-xs">Messages will appear here</p>
            </div>
          {/if}
        </div>

        <!-- Console input -->
        <div class="console-input border-t border-gray-700 p-2">
          <div class="input-container flex items-center bg-gray-800 rounded px-2 py-1">
            <span class="prompt text-blue-400 mr-2">></span>
            <input 
              class="flex-1 bg-transparent outline-none text-sm font-mono"
              placeholder="Enter JavaScript..."
            />
          </div>
        </div>
      </div>
    {:else}
      <div class="placeholder-panel flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <div class="text-4xl mb-4">{tabs.find(t => t.id === activeTab)?.icon}</div>
          <h3 class="font-medium mb-2">{tabs.find(t => t.id === activeTab)?.label}</h3>
          <p class="text-xs">This panel is not implemented yet</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .dev-sidebar {
    position: relative;
    border-left: 1px solid #3f3f46;
  }

  .resize-handle {
    z-index: 10;
  }

  .tab-btn {
    transition: all 0.1s ease;
  }

  .console-entry:hover {
    background-color: rgba(55, 65, 81, 0.5);
  }

  .filter-btn, .action-btn {
    transition: background-color 0.1s ease;
  }

  .input-container {
    border: 1px solid #4b5563;
  }

  .input-container:focus-within {
    border-color: #3b82f6;
  }
</style>