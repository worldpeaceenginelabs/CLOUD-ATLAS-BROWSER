<script>
  import ProcessInfo from './ProcessInfo.svelte';
  
  export let tab;
</script>

<div class="web-content-active">
  <!-- BrowserView renders here -->
  
  <!-- Process Information Overlay -->
  <ProcessInfo {tab} />
</div>

<style>
  .web-content-active {
    height: 100%;
    width: 100%;
    position: relative;
  }
</style> 