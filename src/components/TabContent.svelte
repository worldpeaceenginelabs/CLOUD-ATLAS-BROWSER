<script>
  import { RefreshCw, X } from 'lucide-svelte';
  
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
      {#if tab.processStatus === 'crashed'}
        <!-- Crashed Tab Recovery -->
        <div class="error-state crashed-state">
          <div class="error-icon">💥</div>
          <h2 class="error-title">Tab Crashed</h2>
          <p class="error-description">This tab has stopped working unexpectedly</p>
          <div class="error-actions">
            <button 
              class="action-btn primary"
              on:click={handleReloadCrashedTab}
            >
              <RefreshCw size={18} />
              Reload Tab
            </button>
            <button 
              class="action-btn secondary"
              on:click={handleCloseTab}
            >
              <X size={18} />
              Close Tab
            </button>
          </div>
          {#if tab.processId}
            <div class="error-details">
              <div class="detail-title">Process Information</div>
              <div class="detail-content">
                <div class="detail-item">
                  <span class="detail-label">Process ID:</span>
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
      {:else if tab.processStatus === 'unresponsive'}
        <!-- Unresponsive Tab -->
        <div class="error-state unresponsive-state">
          <div class="error-icon">⏳</div>
          <h2 class="error-title">Tab Not Responding</h2>
          <p class="error-description">This tab is taking too long to respond</p>
          <div class="error-actions">
            <button 
              class="action-btn warning"
              on:click={handleTerminateTab}
            >
              <X size={18} />
              Force Close
            </button>
            <button 
              class="action-btn primary"
              on:click={handleReloadCrashedTab}
            >
              <RefreshCw size={18} />
              Reload
            </button>
          </div>
          {#if tab.processId}
            <div class="error-details">
              <div class="detail-title">Process Information</div>
              <div class="detail-content">
                <div class="detail-item">
                  <span class="detail-label">Process ID:</span>
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
      {:else if tab.processStatus === 'terminated'}
        <!-- Terminated Process -->
        <div class="error-state terminated-state">
          <div class="error-icon">❌</div>
          <h2 class="error-title">Process Terminated</h2>
          <p class="error-description">The tab process was terminated</p>
          <div class="error-actions">
            <button 
              class="action-btn primary"
              on:click={handleReloadCrashedTab}
            >
              <RefreshCw size={18} />
              Restart Tab
            </button>
            <button 
              class="action-btn secondary"
              on:click={handleCloseTab}
            >
              <X size={18} />
              Close Tab
            </button>
          </div>
          {#if tab.processId}
            <div class="error-details">
              <div class="detail-title">Process Information</div>
              <div class="detail-content">
                <div class="detail-item">
                  <span class="detail-label">Previous Process ID:</span>
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
      {:else if tab.loading}
        <!-- Loading State -->
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
      {:else}
        <!-- Normal Web Content (BrowserView renders here) -->
        <div class="web-content-active h-full w-full relative">
          <!-- BrowserView renders here -->
          
          <!-- Process Information Overlay -->
          {#if tab.processId && tab.processStatus}
            <div class="process-info absolute top-4 right-4 bg-black bg-opacity-80 text-white text-sm px-4 py-3 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 z-10 backdrop-blur-sm">
              <div class="flex items-center gap-3 mb-2">
                <span class={getProcessStatusColor(tab.processStatus)}>
                  {getProcessStatusIcon(tab.processStatus)}
                </span>
                <span class="font-medium">PID: {tab.processId}</span>
              </div>
              {#if tab.memoryInfo}
                <div class="text-gray-300 text-xs space-y-1">
                  <div>Memory: {Math.round(tab.memoryInfo.workingSetSize / 1024 / 1024)}MB</div>
                  {#if tab.memoryInfo.privateBytes}
                    <div>Private: {Math.round(tab.memoryInfo.privateBytes / 1024 / 1024)}MB</div>
                  {/if}
                </div>
              {/if}
              {#if tab.statusMessage}
                <div class="text-gray-300 mt-2 text-xs">
                  {tab.statusMessage}
                </div>
              {/if}
              <div class="text-gray-400 mt-2 text-xs">
                Status: {tab.processStatus}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

  {:else if tab.seedingFile}
    <!-- File Seeding Content -->
    <div class="seeding-container h-full flex items-center justify-center p-6">
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

  {:else}
    <!-- Default/Empty Tab Content -->
    <div class="default-content h-full flex items-center justify-center p-6">
      <div class="text-center max-w-2xl">
        
        <!-- Hero Section -->
        <div class="hero-section mb-12">
          <div class="hero-icon mb-6">
            <div class="icon-container">
              <span class="hero-emoji">🌐</span>
            </div>
          </div>
          <h1 class="hero-title">CLOUD-ATLAS-BROWSER</h1>
          <p class="hero-subtitle">Your gateway to the decentralized web</p>
        </div>
        
        <!-- Feature Cards -->
        <div class="features-grid mb-12">
          <div class="feature-card">
            <div class="feature-icon">🌍</div>
            <h3 class="feature-title">Browse Web</h3>
            <p class="feature-description">Navigate the internet with privacy and speed</p>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">📡</div>
            <h3 class="feature-title">Torrent Network</h3>
            <p class="feature-description">Access decentralized content via WebTorrent</p>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">📤</div>
            <h3 class="feature-title">Share Files</h3>
            <p class="feature-description">Seed your files to the network</p>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3 class="feature-title">Secure</h3>
            <p class="feature-description">Built with privacy and security in mind</p>
          </div>
        </div>

        <!-- Quick Start Guide -->
        <div class="quick-start-section mb-8">
          <h3 class="section-title">Quick Start</h3>
          <div class="steps-container">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Enter URLs</h4>
                <p>Type any website address in the address bar</p>
              </div>
            </div>
            
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>Add Torrents</h4>
                <p>Paste magnet links to download content</p>
              </div>
            </div>
            
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>Share Files</h4>
                <p>Click "Send" to seed your own files</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Example Section -->
        <div class="example-section">
          <div class="example-card">
            <div class="example-header">
              <span class="example-icon">🧪</span>
              <h4 class="example-title">Try This Example</h4>
            </div>
            <p class="example-description">Test with Big Buck Bunny (open source video)</p>
            <div class="magnet-container">
              <code class="magnet-link">
                magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny
              </code>
              <button class="copy-btn" on:click={() => {
                navigator.clipboard.writeText('magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny');
                addLog('Example magnet link copied', 'success');
              }}>
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tab-content {
    transition: opacity 0.2s ease-in-out;
    /* Clean centering */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  
  .tab-content.hidden {
    display: none;
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

  .web-content-active {
    position: relative;
  }

  .loading-state {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  .process-info {
    backdrop-filter: blur(8px);
    max-width: 250px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .select-all {
    user-select: all;
  }
  
  code {
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  /* Clean centering for all content containers */
  .default-content,
  .seeding-container,
  .web-content-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  /* Modern Minimalistic Design Styles */
  
  /* Hero Section */
  .hero-section {
    animation: slideUp 0.6s ease-out;
  }

  .hero-icon {
    display: flex;
    justify-content: center;
  }

  .icon-container {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    transition: transform 0.3s ease;
  }

  .icon-container:hover {
    transform: scale(1.05);
  }

  .hero-emoji {
    font-size: 2.5rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }

  .hero-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
    font-weight: 400;
    margin: 0;
  }

  /* Feature Cards */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    animation: slideUp 0.6s ease-out 0.1s both;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    border-color: rgba(102, 126, 234, 0.3);
  }

  .feature-icon {
    font-size: 2rem;
    margin-bottom: 1rem;
    display: block;
  }

  .feature-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .feature-description {
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
  }

  /* Quick Start Section */
  .quick-start-section {
    animation: slideUp 0.6s ease-out 0.2s both;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    transition: all 0.3s ease;
    width: 100%;
    max-width: 400px;
    justify-content: center;
  }

  .step:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: translateX(4px);
  }

  .step-number {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .step-content {
    text-align: center;
    flex: 1;
  }

  .step-content h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .step-content p {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.4;
  }

  /* Example Section */
  .example-section {
    animation: slideUp 0.6s ease-out 0.3s both;
  }

  .example-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .example-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .example-icon {
    font-size: 1.25rem;
  }

  .example-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .example-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  .magnet-container {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .magnet-link {
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

  .copy-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

  .copy-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .copy-btn:active {
    transform: translateY(0);
  }

  /* Animations */
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

  /* Responsive Design */
  @media (max-width: 768px) {
    .hero-title {
      font-size: 2rem;
    }
    
    .features-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    .magnet-container {
      flex-direction: column;
      align-items: stretch;
    }
    
    .copy-btn {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .features-grid {
      grid-template-columns: 1fr;
    }
    
    .hero-title {
      font-size: 1.75rem;
    }
  }

  /* Ensure all text is properly centered */
  .text-center {
    text-align: center;
  }

  /* Clean typography */
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.2;
    margin: 0;
  }

  p {
    line-height: 1.6;
    margin: 0;
  }

  /* Smooth transitions */
  * {
    transition: all 0.2s ease-in-out;
  }

  /* Error States */
  .error-state {
    text-align: center;
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem;
    animation: slideUp 0.6s ease-out;
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

  /* Loading State */
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

  .loading-details {
    margin-bottom: 1rem;
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

  /* Seeding Section */
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
    color: #1f2937;
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
</style>