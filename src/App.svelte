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
  }

  // Initialize WebTorrent logging
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      addLog('WebTorrent Browser initialized', 'info');
    });
  }
</script>

<div class="app font-chrome">
  <Browser bind:logs={logs} {addLog} />
</div>

<style>
  .app {
    height: 100vh;
    overflow: hidden;
  }
</style>