<script>
  export let tab;

  function getProcessStatusIcon(status) {
    switch (status) {
      case 'running': return '✅';
      case 'crashed': return '💥';
      case 'unresponsive': return '⏳';
      case 'terminated': return '❌';
      case 'pending': return '⚪';
      default: return '❓';
    }
  }

  function getProcessStatusColor(status) {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'crashed': return 'text-red-600';
      case 'unresponsive': return 'text-orange-600';
      case 'terminated': return 'text-gray-600';
      case 'pending': return 'text-blue-600';
      default: return 'text-gray-400';
    }
  }
</script>

{#if tab.processId && tab.processStatus}
  <div class="process-info">
    <div class="process-header">
      <span class={getProcessStatusColor(tab.processStatus)}>
        {getProcessStatusIcon(tab.processStatus)}
      </span>
      <span class="font-medium">PID: {tab.processId}</span>
    </div>
    {#if tab.memoryInfo}
      <div class="memory-info">
        <div>Memory: {Math.round(tab.memoryInfo.workingSetSize / 1024 / 1024)}MB</div>
        {#if tab.memoryInfo.privateBytes}
          <div>Private: {Math.round(tab.memoryInfo.privateBytes / 1024 / 1024)}MB</div>
        {/if}
      </div>
    {/if}
    {#if tab.statusMessage}
      <div class="status-message">
        {tab.statusMessage}
      </div>
    {/if}
    <div class="status-text">
      Status: {tab.processStatus}
    </div>
  </div>
{/if}

<style>
  .process-info {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 10;
    backdrop-filter: blur(4px);
  }

  .process-info:hover {
    opacity: 1;
  }

  .process-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .memory-info {
    color: #d1d5db;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .status-message {
    color: #d1d5db;
    margin-top: 0.5rem;
    font-size: 0.75rem;
  }

  .status-text {
    color: #9ca3af;
    margin-top: 0.5rem;
    font-size: 0.75rem;
  }

  .text-green-600 { color: #16a34a; }
  .text-red-600 { color: #dc2626; }
  .text-orange-600 { color: #ea580c; }
  .text-gray-600 { color: #4b5563; }
  .text-blue-600 { color: #2563eb; }
  .text-gray-400 { color: #9ca3af; }
</style> 