<script>
  export let tab;
  export let addLog;
</script>

<div class="seeding-container">
  <div class="seeding-content">
    <!-- Header -->
    <div class="seeding-header">
      <div class="seeding-icon">📤</div>
      <h2 class="seeding-title">File Seeding</h2>
      <p class="seeding-subtitle">Share your files with the network</p>
    </div>
    
    <!-- File Info -->
    <div class="file-info-card">
      <div class="file-header">
        <span class="file-icon">📁</span>
        <div class="file-details">
          <h3 class="file-name">{tab.seedingFile.split('/').pop() || tab.seedingFile.split('\\').pop()}</h3>
          <p class="file-status">Active • Seeding to network</p>
        </div>
      </div>
      
      {#if tab.generatedMagnet}
        <div class="magnet-section">
          <label class="magnet-label">Magnet Link</label>
          <div class="magnet-input-group">
            <input 
              type="text" 
              value={tab.generatedMagnet} 
              readonly 
              class="magnet-input"
              on:click={(e) => e.target.select()}
            />
            <button 
              class="copy-magnet-btn"
              on:click={() => {
                navigator.clipboard.writeText(tab.generatedMagnet);
                addLog('Magnet link copied to clipboard', 'success');
              }}
            >
              Copy
            </button>
          </div>
          <p class="magnet-help">Share this link with others to let them download your file</p>
        </div>
      {:else}
        <div class="generating-state">
          <div class="generating-spinner"></div>
          <span class="generating-text">Generating magnet link...</span>
        </div>
      {/if}
    </div>

    <!-- Stats -->
    <div class="stats-card">
      <h4 class="stats-title">Seeding Statistics</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">Active</div>
          <div class="stat-label">Status</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">Calculating...</div>
          <div class="stat-label">File Size</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0 B</div>
          <div class="stat-label">Uploaded</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">Peers</div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .seeding-container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .seeding-content {
    max-width: 600px;
    width: 100%;
    animation: slideUp 0.6s ease-out;
  }

  .seeding-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .seeding-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
  }

  .seeding-title {
    font-size: 2rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 0.5rem;
  }

  .seeding-subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0;
  }

  .file-info-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .file-icon {
    font-size: 2rem;
  }

  .file-details {
    flex: 1;
  }

  .file-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .file-status {
    font-size: 0.875rem;
    color: #10b981;
    font-weight: 500;
    margin: 0;
  }

  .magnet-section {
    border-top: 1px solid rgba(107, 114, 128, 0.1);
    padding-top: 1.5rem;
  }

  .magnet-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .magnet-input-group {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .magnet-input {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 0.75rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: #374151;
    word-break: break-all;
    line-height: 1.4;
  }

  .copy-magnet-btn {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
  }

  .copy-magnet-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .magnet-help {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .generating-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 8px;
  }

  .generating-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(16, 185, 129, 0.2);
    border-top: 2px solid #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .generating-text {
    font-size: 0.875rem;
    color: #10b981;
    font-weight: 500;
  }

  .stats-card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .stats-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .stat-item {
    text-align: center;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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