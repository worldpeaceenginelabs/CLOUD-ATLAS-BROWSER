<script>
  import { onMount, onDestroy } from 'svelte';
  import { WebContainer } from '@webcontainer/api';
  export let infoHash;
  export let addLog;

  let iframeEl;
  let loading = true;
  let error = null;
  let output = '';

  async function fetchTorrentFiles() {
    // Fetch file list from the local server
    const res = await fetch(`http://127.0.0.1:18080/website/${infoHash}/index.html`);
    if (!res.ok) throw new Error('Could not fetch index.html');
    // For demo: just mount index.html as root
    const indexHtml = await res.text();
    return {
      'index.html': {
        file: { contents: indexHtml }
      }
    };
  }

  async function bootWebContainer() {
    try {
      loading = true;
      error = null;
      output = '';
      addLog && addLog('Booting WebContainer...', 'info');
      const files = await fetchTorrentFiles();
      const webcontainer = await WebContainer.boot();
      await webcontainer.mount(files);
      addLog && addLog('Mounted files in WebContainer', 'info');
      // Try npm install (if package.json exists)
      if (files['package.json']) {
        const install = await webcontainer.spawn('npm', ['install']);
        await install.exit;
        addLog && addLog('npm install complete', 'info');
        const dev = await webcontainer.spawn('npm', ['run', 'dev']);
        dev.output.pipeTo(new WritableStream({
          write(data) { output += data; }
        }));
      }
      // Listen for server-ready
      webcontainer.on('server-ready', (port, url) => {
        if (iframeEl) iframeEl.src = url;
        addLog && addLog('WebContainer server ready: ' + url, 'success');
        loading = false;
      });
    } catch (e) {
      error = e.message;
      addLog && addLog('WebContainer error: ' + e.message, 'error');
      loading = false;
    }
  }

  onMount(() => {
    bootWebContainer();
    return () => {};
  });
</script>

<div class="webcontainer-tab h-full w-full flex flex-col">
  {#if loading}
    <div class="loading">Booting WebContainer...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <iframe bind:this={iframeEl} class="webcontainer-iframe" style="width:100%;height:100%;border:none;"></iframe>
    <pre class="output">{output}</pre>
  {/if}
</div>

<style>
.webcontainer-tab { height: 100%; width: 100%; }
.webcontainer-iframe { flex: 1; }
.loading, .error { padding: 2rem; text-align: center; }
.output { background: #111; color: #0f0; font-size: 0.9em; padding: 1em; max-height: 200px; overflow: auto; }
</style> 