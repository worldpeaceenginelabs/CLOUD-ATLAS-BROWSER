<script>
  import { Terminal, AlertTriangle, Info, CheckCircle, XCircle, Settings, Trash2, Filter } from 'lucide-svelte';
  
  export let logs = [];
  export let securityWarnings = [];
  export let width = 400;

  let selectedLogType = 'all';
  let autoScroll = true;
  let maxLogs = 1000;
  let logsContainer;

  // Filter logs based on selected type
  $: filteredLogs = selectedLogType === 'all' 
    ? logs 
    : logs.filter(log => log.type === selectedLogType);

  // Auto-scroll to bottom when new logs arrive
  $: if (autoScroll && logsContainer && filteredLogs.length > 0) {
    setTimeout(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }, 10);
  }

  function getLogIcon(type) {
    switch(type) {
      case 'error': return XCircle;
      case 'warn': return AlertTriangle;
      case 'success': return CheckCircle;
      default: return Info;
    }
  }

  function getLogColor(type) {
    switch(type) {
      case 'error': return 'text-red-500 bg-red-50 border-red-200';
      case 'warn': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  }

  function getLogTypeCount(type) {
    if (type === 'all') return logs.length;
    return logs.filter(log => log.type === type).length;
  }

  function clearLogs() {
    logs.length = 0;
    logs = [...logs]; // Trigger reactivity
  }

  function clearSecurityWarnings() {
    securityWarnings.length = 0;
    securityWarnings = [...securityWarnings]; // Trigger reactivity
  }

  function exportLogs() {
    const logData = logs.map(log => ({
      timestamp: log.timestamp,
      type: log.type,
      message: log.message
    }));
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  function getSecurityWarningIcon(severity) {
    switch(severity) {
      case 'high': return XCircle;
      case 'medium': return AlertTriangle;
      default: return Info;
    }
  }

  function getSecurityWarningColor(severity) {
    switch(severity) {
      case 'high': return 'text-red-600 bg-red-100 border-red-300';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      default: return 'text-blue-600 bg-blue-100 border-blue-300';
    }
  }

  // Handle resize
  function handleResize(event) {
    const newWidth = Math.max(300, Math.min(800, width + event.movementX));
    width = newWidth;
  }

  let isResizing = false;

  function startResize() {
    isResizing = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
</script>

<div class="dev-sidebar bg-gray-900 text-white flex flex-col" style="width: {width}px">
  <!-- Resize Handle -->
  <div 
    class="resize-handle absolute left-0 top-0 w-1 h-full bg-gray-600 hover:bg-gray-500 cursor-col-resize"
    on:mousedown={startResize}
    role="separator"
    aria-label="Resize sidebar"
  ></div>

  <!-- Header -->
  <div class="sidebar-header bg-gray-800 p-4 border-b border-gray-700">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center">
        <Terminal size={18} class="text-gray-400 mr-2" />
        <h2 class="text-lg font-semibold">Developer Tools</h2>
      </div>
      <button 
        class="text-gray-400 hover:text-white p-1 rounded"
        on:click={clearLogs}
        title="Clear all logs"
      >
        <Trash2 size={16} />
      </button>
    </div>

    <!-- Log Type Filters -->
    <div class="filter-tabs flex flex-wrap gap-1">
      {#each ['all', 'info', 'warn', 'error', 'success'] as type}
        <button 
          class="px-3 py-1 text-xs rounded transition-colors flex items-center gap-1
                 {selectedLogType === type 
                   ? 'bg-blue-600 text-white' 
                   : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
          on:click={() => selectedLogType = type}
        >
          <Filter size={10} />
          {type} ({getLogTypeCount(type)})
        </button>
      {/each}
    </div>
  </div>

  <!-- Security Warnings Section -->
  {#if securityWarnings.length > 0}
    <div class="security-warnings bg-red-900 border-b border-red-700">
      <div class="p-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-red-200">Security Warnings</h3>
          <button 
            class="text-red-300 hover:text-red-100 text-xs"
            on:click={clearSecurityWarnings}
          >
            Clear
          </button>
        </div>
        
        <div class="space-y-2 max-h-32 overflow-y-auto">
          {#each securityWarnings as warning}
            <div class="security-warning p-2 rounded text-xs {getSecurityWarningColor(warning.severity)}">
              <div class="flex items-start">
                <svelte:component 
                  this={getSecurityWarningIcon(warning.severity)} 
                  size={12} 
                  class="mr-2 mt-0.5 flex-shrink-0" 
                />
                <div class="flex-1">
                  <div class="font-medium">{warning.message}</div>
                  <div class="text-xs opacity-75 mt-1">{formatTimestamp(warning.timestamp)}</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Controls -->
  <div class="controls bg-gray-800 p-3 border-b border-gray-700">
    <div class="flex items-center justify-between text-xs">
      <label class="flex items-center gap-2">
        <input 
          type="checkbox" 
          bind:checked={autoScroll}
          class="rounded"
        />
        Auto-scroll
      </label>
      
      <button 
        class="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs transition-colors"
        on:click={exportLogs}
        title="Export logs as JSON"
      >
        Export
      </button>
    </div>
  </div>

  <!-- Logs Container -->
  <div 
    class="logs-container flex-1 overflow-y-auto p-2" 
    bind:this={logsContainer}
  >
    {#each filteredLogs as log (log.id)}
      <div class="log-entry mb-2 p-3 rounded-lg border {getLogColor(log.type)}">
        <div class="flex items-start">
          <svelte:component 
            this={getLogIcon(log.type)} 
            size={14} 
            class="mr-2 mt-0.5 flex-shrink-0" 
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm leading-relaxed break-words">{log.message}</div>
            <div class="text-xs opacity-75 mt-1">{formatTimestamp(log.timestamp)}</div>
          </div>
        </div>
      </div>
    {:else}
      <div class="empty-state text-center py-8 text-gray-500">
        <Terminal size={24} class="mx-auto mb-2 opacity-50" />
        <p class="text-sm">No {selectedLogType === 'all' ? '' : selectedLogType} logs</p>
      </div>
    {/each}
  </div>

  <!-- Footer Stats -->
  <div class="sidebar-footer bg-gray-800 p-3 border-t border-gray-700">
    <div class="text-xs text-gray-400 space-y-1">
      <div class="flex justify-between">
        <span>Total logs:</span>
        <span>{logs.length}</span>
      </div>
      <div class="flex justify-between">
        <span>Filtered:</span>
        <span>{filteredLogs.length}</span>
      </div>
      {#if securityWarnings.length > 0}
        <div class="flex justify-between text-red-400">
          <span>Warnings:</span>
          <span>{securityWarnings.length}</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dev-sidebar {
    position: relative;
    min-width: 300px;
    max-width: 800px;
    resize: horizontal;
    overflow: hidden;
  }

  .resize-handle {
    z-index: 10;
  }

  .resize-handle:hover {
    transition: background-color 0.2s ease;
  }

  .logs-container {
    scrollbar-width: thin;
    scrollbar-color: #4b5563 #1f2937;
  }

  .logs-container::-webkit-scrollbar {
    width: 6px;
  }

  .logs-container::-webkit-scrollbar-track {
    background: #1f2937;
  }

  .logs-container::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }

  .logs-container::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }

  .log-entry {
    word-wrap: break-word;
    word-break: break-word;
  }

  .filter-tabs {
    max-height: 60px;
    overflow-y: auto;
  }

  .security-warnings {
    max-height: 200px;
    overflow-y: auto;
  }
</style>