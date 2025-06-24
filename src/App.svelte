<script>
  import Browser from './components/Browser.svelte';
  import './app.css';

  let logs = [];

  function addLog(message, type = 'info') {
    logs = [...logs, { 
      message, 
      type, 
      timestamp: new Date().toLocaleTimeString() 
    }];
    
    // Optional: Log to console for debugging
    if (window.electronConsole) {
      window.electronConsole.log(`[${type.toUpperCase()}] ${message}`);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // Initialize WebTorrent logging
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      addLog('WebTorrent Browser initialized', 'info');
    });
  }
</script>

<div class="app">
  <Browser {addLog} />
</div>

<style>
  .app {
    height: 100vh;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>