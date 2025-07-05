<script>
  import ErrorState from './tab-content/ErrorState.svelte';
  import LoadingState from './tab-content/LoadingState.svelte';
  import SeedingInterface from './tab-content/SeedingInterface.svelte';
  import DefaultContent from './tab-content/DefaultContent.svelte';
  import WebContent from './tab-content/WebContent.svelte';
  
  export let tab;
  export let active = false;
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

<div class="tab-content {active ? 'active' : 'hidden'} h-full bg-white">
  {#if tab.viewId}
    <!-- Web Content (handled by BrowserView in main process) -->
    <div class="web-content-placeholder h-full flex items-center justify-center bg-white relative">
      {#if tab.processStatus === 'crashed' || tab.processStatus === 'unresponsive' || tab.processStatus === 'terminated'}
        <!-- Error States -->
        <ErrorState {tab} {addLog} />
      {:else if tab.loading}
        <!-- Loading State -->
        <LoadingState {tab} />
      {:else}
        <!-- Normal Web Content (BrowserView renders here) -->
        <WebContent {tab} />
      {/if}
    </div>

  {:else if tab.seedingFile}
    <!-- File Seeding Content -->
    <SeedingInterface {tab} {addLog} />

  {:else}
    <!-- Default/Empty Tab Content -->
    <DefaultContent {addLog} />
  {/if}
</div>

<style>
  .tab-content {
    transition: opacity 0.2s ease-in-out;
    /* Flexible layout instead of fixed centering */
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  
  .tab-content.hidden {
    display: none;
  }

  .web-content-placeholder {
    position: relative;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .web-content-placeholder {
      padding: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .web-content-placeholder {
      padding: 0.5rem;
    }
  }

  @media (max-height: 600px) {
    .web-content-placeholder {
      padding: 0.5rem;
    }
  }

  @media (max-height: 500px) {
    .web-content-placeholder {
      padding: 0.25rem;
    }
  }
</style>