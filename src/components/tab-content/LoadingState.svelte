<script>
  export let tab;
</script>

<div class="loading-state">
  <div class="loading-spinner"></div>
  <h3 class="loading-title">Loading...</h3>
  <p class="loading-url">{tab.url}</p>
  {#if tab.processId}
    <div class="loading-details">
      <span class="detail-badge">PID: {tab.processId}</span>
    </div>
  {/if}
  {#if tab.statusMessage}
    <p class="loading-status">{tab.statusMessage}</p>
  {/if}
</div>

<style>
  .loading-state {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
    padding: 2rem;
    animation: slideUp 0.6s ease-out;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(102, 126, 234, 0.2);
    border-top: 3px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
  }

  .loading-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .loading-url {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
    word-break: break-all;
    line-height: 1.4;
  }

  .detail-badge {
    display: inline-block;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .loading-status {
    font-size: 0.875rem;
    color: #6b7280;
    font-style: italic;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style> 