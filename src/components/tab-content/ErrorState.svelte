<script>
  import { RefreshCw, X } from 'lucide-svelte';
  
  export let tab;
  export let addLog;

  // Handle process-related actions
  async function handleReloadCrashedTab() {
    if (tab.viewId && tab.url && window.electronAPI) {
      try {
        const success = await window.electronAPI.reloadCrashedTab(tab.viewId, tab.url);
        if (success) {
          addLog(`Reloading crashed tab: ${tab.title || tab.url}`, 'info');
        } else {
          addLog(`Failed to reload crashed tab`, 'error');
        }
      } catch (error) {
        addLog(`Error reloading crashed tab: ${error.message}`, 'error');
      }
    }
  }

  async function handleTerminateTab() {
    if (tab.viewId && window.electronAPI) {
      try {
        const success = await window.electronAPI.terminateTabProcess(tab.viewId);
        if (success) {
          addLog(`Terminated tab process: ${tab.title || tab.url}`, 'info');
        } else {
          addLog(`Failed to terminate tab process`, 'error');
        }
      } catch (error) {
        addLog(`Error terminating tab process: ${error.message}`, 'error');
      }
    }
  }

  function handleCloseTab() {
    // Dispatch close event to parent
    window.dispatchEvent(new CustomEvent('close-tab', { detail: tab.id }));
  }

  function getErrorConfig(status) {
    switch (status) {
      case 'crashed':
        return {
          icon: '💥',
          title: 'Tab Crashed',
          description: 'This tab has stopped working unexpectedly',
          primaryAction: { label: 'Reload Tab', handler: handleReloadCrashedTab, type: 'primary' },
          secondaryAction: { label: 'Close Tab', handler: handleCloseTab, type: 'secondary' }
        };
      case 'unresponsive':
        return {
          icon: '⏳',
          title: 'Tab Not Responding',
          description: 'This tab is taking too long to respond',
          primaryAction: { label: 'Force Close', handler: handleTerminateTab, type: 'warning' },
          secondaryAction: { label: 'Reload', handler: handleReloadCrashedTab, type: 'primary' }
        };
      case 'terminated':
        return {
          icon: '❌',
          title: 'Process Terminated',
          description: 'The tab process was terminated',
          primaryAction: { label: 'Restart Tab', handler: handleReloadCrashedTab, type: 'primary' },
          secondaryAction: { label: 'Close Tab', handler: handleCloseTab, type: 'secondary' }
        };
      default:
        return {
          icon: '❓',
          title: 'Unknown Error',
          description: 'An unknown error occurred',
          primaryAction: { label: 'Reload Tab', handler: handleReloadCrashedTab, type: 'primary' },
          secondaryAction: { label: 'Close Tab', handler: handleCloseTab, type: 'secondary' }
        };
    }
  }

  $: errorConfig = getErrorConfig(tab.processStatus);
</script>

<div class="error-state {tab.processStatus}-state">
  <div class="error-icon">{errorConfig.icon}</div>
  <h2 class="error-title">{errorConfig.title}</h2>
  <p class="error-description">{errorConfig.description}</p>
  <div class="error-actions">
    <button 
      class="action-btn {errorConfig.primaryAction.type}"
      on:click={errorConfig.primaryAction.handler}
    >
      {#if errorConfig.primaryAction.type === 'primary' || errorConfig.primaryAction.type === 'warning'}
        <RefreshCw size={18} />
      {:else}
        <X size={18} />
      {/if}
      {errorConfig.primaryAction.label}
    </button>
    <button 
      class="action-btn {errorConfig.secondaryAction.type}"
      on:click={errorConfig.secondaryAction.handler}
    >
      {#if errorConfig.secondaryAction.type === 'primary'}
        <RefreshCw size={18} />
      {:else}
        <X size={18} />
      {/if}
      {errorConfig.secondaryAction.label}
    </button>
  </div>
  {#if tab.processId}
    <div class="error-details">
      <div class="detail-title">Process Information</div>
      <div class="detail-content">
        <div class="detail-item">
          <span class="detail-label">
            {tab.processStatus === 'terminated' ? 'Previous Process ID:' : 'Process ID:'}
          </span>
          <span class="detail-value">{tab.processId}</span>
        </div>
        {#if tab.statusMessage}
          <div class="detail-item">
            <span class="detail-label">Status:</span>
            <span class="detail-value">{tab.statusMessage}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .error-state {
    text-align: center;
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem;
    animation: slideUp 0.6s ease-out;
  }

  .crashed-state,
  .unresponsive-state,
  .terminated-state {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .error-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    display: block;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
  }

  .error-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .error-description {
    font-size: 1rem;
    color: #6b7280;
    margin-bottom: 2rem;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  @media (min-width: 640px) {
    .error-actions {
      flex-direction: row;
      justify-content: center;
    }
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 140px;
  }

  .action-btn.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  .action-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }

  .action-btn.secondary {
    background: rgba(255, 255, 255, 0.9);
    color: #6b7280;
    border: 1px solid rgba(107, 114, 128, 0.2);
    backdrop-filter: blur(10px);
  }

  .action-btn.secondary:hover {
    background: rgba(255, 255, 255, 1);
    color: #374151;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }

  .action-btn.warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .action-btn.warning:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);
  }

  .error-details {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    text-align: left;
  }

  .detail-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .detail-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(107, 114, 128, 0.1);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .detail-value {
    font-size: 0.875rem;
    color: #1f2937;
    font-weight: 600;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  /* Responsive Design */
  @media (max-height: 600px) {
    .error-state {
      padding: 1rem;
    }
  }
</style> 