<script>
  export let addLog;
</script>

<div class="default-content">
  <div class="text-center max-w-2xl">
    
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="logo-container">
        <img src="./cloudatlaslogo.png" alt="Cloud Atlas Logo" width="150" height="150" class="logo">
      </div>
      <h1 class="hero-title">CLOUD-ATLAS-BROWSER</h1>
      <p class="hero-subtitle">Your gateway to the decentralized web</p>
    </div>
    
    <!-- Feature Cards -->
    <div class="features-grid">
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
    <div class="quick-start-section">
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

<style>
  .default-content {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .text-center {
    text-align: center;
  }

  .max-w-2xl {
    max-width: 42rem;
  }

  /* Hero Section */
  .hero-section {
    margin-bottom: 3rem;
    animation: slideUp 0.6s ease-out;
  }

  .logo-container {
    margin-bottom: 1.5rem;
  }

  .logo {
    max-width: 150px;
    max-height: 150px;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.1));
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
    letter-spacing: -0.025em;
  }

  .hero-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
    font-weight: 500;
  }

  /* Feature Cards */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin-bottom: 3rem;
    animation: slideUp 0.6s ease-out 0.1s both;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  .feature-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    display: block;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
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
    margin-bottom: 2rem;
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
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
    justify-content: center;
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
    .default-content {
      padding: 0.75rem;
    }
    
    .features-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
    
    .magnet-container {
      flex-direction: column;
      align-items: stretch;
    }
    
    .copy-btn {
      width: 100%;
    }

    .step {
      max-width: 300px;
      padding: 0.5rem;
    }

    .feature-card {
      padding: 1rem;
    }
  }

  @media (max-width: 480px) {
    .default-content {
      padding: 0.5rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
    
    .hero-title {
      font-size: 1.75rem;
    }

    .step {
      max-width: 280px;
    }

    .example-card {
      padding: 1rem;
    }
  }
</style> 