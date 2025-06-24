<script>
  import { createEventDispatcher } from 'svelte';
  import { X, AlertTriangle, Shield } from 'lucide-svelte';

  export let title = 'Security Warning';
  export let message = '';
  export let type = 'warning'; // 'warning', 'error', 'info'
  export let actions = []; // Array of action objects: { label, action, primary }

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleAction(action) {
    if (action.callback) {
      action.callback();
    }
    dispatch('action', { action: action.id });
    handleClose();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function getIcon() {
    switch (type) {
      case 'error':
        return AlertTriangle;
      case 'info':
        return Shield;
      default:
        return AlertTriangle;
    }
  }

  function getIconColor() {
    switch (type) {
      case 'error':
        return 'text-red-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-yellow-500';
    }
  }
</script>

<!-- Modal Backdrop -->
<div 
  class="security-modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  on:click={handleBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <!-- Modal Content -->
  <div class="security-modal bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 overflow-hidden">
    <!-- Header -->
    <div class="modal-header flex items-center justify-between p-4 border-b border-gray-200">
      <div class="flex items-center">
        <svelte:component 
          this={getIcon()} 
          size={20} 
          class="{getIconColor()} mr-3" 
        />
        <h2 id="modal-title" class="text-lg font-semibold text-gray-900">
          {title}
        </h2>
      </div>
      <button 
        class="close-button p-1 rounded hover:bg-gray-100 transition-colors"
        on:click={handleClose}
        aria-label="Close modal"
      >
        <X size={20} class="text-gray-500" />
      </button>
    </div>

    <!-- Body -->
    <div class="modal-body p-4">
      <p id="modal-description" class="text-gray-700 leading-relaxed">
        {message}
      </p>
    </div>

    <!-- Footer -->
    <div class="modal-footer flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
      {#if actions.length > 0}
        {#each actions as action}
          <button 
            class="px-4 py-2 rounded font-medium transition-colors
                   {action.primary 
                     ? 'bg-blue-600 text-white hover:bg-blue-700' 
                     : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}"
            on:click={() => handleAction(action)}
          >
            {action.label}
          </button>
        {/each}
      {:else}
        <button 
          class="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
          on:click={handleClose}
        >
          OK
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .security-modal-backdrop {
    animation: fadeIn 0.2s ease-out;
  }

  .security-modal {
    animation: slideIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>