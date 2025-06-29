<script>
  import Browser from './components/Browser.svelte';
  import { Minus, Square, X } from 'lucide-svelte';
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

  // Window control functions
  function minimizeWindow() {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  }

  function maximizeWindow() {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  }

  function closeWindow() {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
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
  <!-- Draggable Region -->
  <div class="draggable-region"></div>
  
  <!-- Custom Window Controls -->
  <div class="window-controls">
    <button class="window-control minimize" on:click={minimizeWindow} title="Minimize">
      <Minus size={12} />
    </button>
    <button class="window-control maximize" on:click={maximizeWindow} title="Maximize">
      <Square size={12} />
    </button>
    <button class="window-control close" on:click={closeWindow} title="Close">
      <X size={12} />
    </button>
  </div>

  <Browser {addLog} />
</div>

<style>
  .app {
    height: 100vh;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    position: relative;
  }

  .draggable-region {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 32px;
    z-index: 999;
    -webkit-app-region: drag;
    background: transparent;
  }

  .window-controls {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-bottom-left-radius: 8px;
  }

  .window-control {
    width: 46px;
    height: 32px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    -webkit-app-region: no-drag;
  }

  .window-control:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }

  .window-control.close:hover {
    background: #e81123;
    color: white;
  }

  .window-control.minimize:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .window-control.maximize:hover {
    background: rgba(0, 0, 0, 0.1);
  }
</style>