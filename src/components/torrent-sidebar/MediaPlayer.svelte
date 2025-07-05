<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { Pause, Play, Volume2, VolumeX, Maximize2, Minimize2, X } from 'lucide-svelte';

  export let addLog = () => {};

  // Media Player State
  let mediaPlayerOpen = false;
  let currentMediaFile = null;
  let currentTorrent = null;
  let videoElement;
  let audioElement;
  let isPlaying = false;
  let isMuted = false;
  let volume = 1.0;
  let currentTime = 0;
  let duration = 0;
  let isFullscreen = false;

  // Reactive statement to ensure fullscreen state is always current
  $: {
    // This will run whenever the component updates, ensuring fullscreen state is current
    if (typeof document !== 'undefined') {
      const fullscreenElement = document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement;
      isFullscreen = !!fullscreenElement;
    }
  }

  onMount(() => {
    setupFullscreenDetection();
  });

  onDestroy(() => {
    // Cleanup fullscreen detection
    document.removeEventListener('fullscreenchange', updateFullscreenState);
    document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    document.removeEventListener('mozfullscreenchange', updateFullscreenState);
    document.removeEventListener('MSFullscreenChange', updateFullscreenState);
  });

  function setupFullscreenDetection() {
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener('mozfullscreenchange', updateFullscreenState);
    document.addEventListener('MSFullscreenChange', updateFullscreenState);
  }

  function updateFullscreenState() {
    if (typeof document !== 'undefined') {
      const fullscreenElement = document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement;
      isFullscreen = !!fullscreenElement;
    }
  }

  function toggleMediaPlayer() {
    mediaPlayerOpen = !mediaPlayerOpen;
    if (!mediaPlayerOpen) {
      stopMedia();
    }
  }

  function stopMedia() {
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
    }
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    isPlaying = false;
    currentMediaFile = null;
    currentTorrent = null;
  }

  async function streamMediaFile(torrent, file) {
    try {
      // Check if file has any progress
      if (torrent.progress === 0) {
        addLog(`Cannot stream: ${file.name} - not yet downloaded`, 'warning');
        return;
      }
      
      stopMedia();
      currentTorrent = torrent;
      currentMediaFile = file;
      mediaPlayerOpen = true;
      
      // Wait for the next tick to ensure DOM elements are rendered
      await tick();
      
      addLog(`Starting stream: ${file.name}`, 'info');
      // Use local HTTP server URL
      const url = `http://127.0.0.1:18080/stream/${torrent.infoHash}/${encodeURIComponent(file.name)}`;
      const isVideo = file.name.match(/\.(mp4|webm|avi|mkv|mov|flv)$/i);
      const isAudio = file.name.match(/\.(mp3|wav|flac|ogg|m4a|aac)$/i);
      
      if (isVideo) {
        if (videoElement) {
          videoElement.src = url;
          videoElement.style.display = 'block';
          if (audioElement) audioElement.style.display = 'none';
          addLog(`Video streaming: ${file.name}`, 'success');
        } else {
          addLog(`Video element not available`, 'error');
        }
      } else if (isAudio) {
        if (audioElement) {
          audioElement.src = url;
          audioElement.style.display = 'block';
          if (videoElement) videoElement.style.display = 'none';
          addLog(`Audio streaming: ${file.name}`, 'success');
        } else {
          addLog(`Audio element not available`, 'error');
        }
      } else {
        addLog(`Unsupported media format: ${file.name}`, 'warning');
      }
    } catch (error) {
      console.error('Streaming error:', error);
      addLog(`Streaming error: ${error.message}`, 'error');
    }
  }

  function togglePlayPause() {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      if (isPlaying) {
        mediaElement.pause();
      } else {
        mediaElement.play();
      }
      isPlaying = !isPlaying;
    }
  }

  function toggleMute() {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      mediaElement.muted = !isMuted;
      isMuted = !isMuted;
    }
  }

  function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      mediaElement.volume = volume;
    }
  }

  function toggleFullscreen() {
    const mediaElement = videoElement || audioElement;
    if (!mediaElement) return;

    if (!isFullscreen) {
      if (mediaElement.requestFullscreen) {
        mediaElement.requestFullscreen();
      } else if (mediaElement.webkitRequestFullscreen) {
        mediaElement.webkitRequestFullscreen();
      } else if (mediaElement.mozRequestFullScreen) {
        mediaElement.mozRequestFullScreen();
      } else if (mediaElement.msRequestFullscreen) {
        mediaElement.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  function updateProgress() {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      currentTime = mediaElement.currentTime;
      duration = mediaElement.duration;
      isPlaying = !mediaElement.paused;
    }
  }

  function seekTo(time) {
    const mediaElement = videoElement?.style.display !== 'none' ? videoElement : audioElement;
    if (mediaElement) {
      mediaElement.currentTime = time;
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Expose methods for parent component
  export { streamMediaFile, stopMedia };
</script>

<div class="media-player-section">
  <div class="media-player-header" on:click={toggleMediaPlayer}>
    <div class="media-player-title">
      <span class="media-icon">🎬</span>
      <span class="media-name">Media Player</span>
    </div>
    <button class="media-toggle-btn">
      {#if mediaPlayerOpen}
        <Minimize2 size={16} />
      {:else}
        <Maximize2 size={16} />
      {/if}
    </button>
  </div>

  {#if mediaPlayerOpen}
    <div class="media-player-content">
      <!-- Video Element -->
      <video 
        bind:this={videoElement}
        style="display: none;"
        on:timeupdate={updateProgress}
        on:loadedmetadata={updateProgress}
        on:ended={() => isPlaying = false}
        controls={false}
      ></video>

      <!-- Audio Element -->
      <audio 
        bind:this={audioElement}
        style="display: none;"
        on:timeupdate={updateProgress}
        on:loadedmetadata={updateProgress}
        on:ended={() => isPlaying = false}
        controls={false}
      ></audio>

      <!-- Media Controls -->
      {#if currentMediaFile}
        <div class="media-controls">
          <!-- Progress Bar -->
          <div class="progress-bar-container">
            <input 
              type="range" 
              class="progress-slider"
              min="0" 
              max={duration || 0} 
              value={currentTime}
              on:input={(e) => seekTo(parseFloat(e.target.value))}
            />
            <div class="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <!-- Control Buttons -->
          <div class="control-buttons">
            <button class="control-btn" on:click={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
              {#if isPlaying}
                <Pause size={16} />
              {:else}
                <Play size={16} />
              {/if}
            </button>

            <button class="control-btn" on:click={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              {#if isMuted}
                <VolumeX size={16} />
              {:else}
                <Volume2 size={16} />
              {/if}
            </button>

            <input 
              type="range" 
              class="volume-slider"
              min="0" 
              max="1" 
              step="0.1"
              value={volume}
              on:input={(e) => setVolume(parseFloat(e.target.value))}
              title="Volume"
            />

            <button class="control-btn" on:click={toggleFullscreen} title="Fullscreen">
              {#if isFullscreen}
                <Minimize2 size={16} />
              {:else}
                <Maximize2 size={16} />
              {/if}
            </button>

            <button class="control-btn close-btn" on:click={stopMedia} title="Stop">
              <X size={16} />
            </button>
          </div>
        </div>
      {:else}
        <div class="media-placeholder">
          <div class="placeholder-icon">🎬</div>
          <p>Select a media file to stream</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Media Player Section */
  .media-player-section {
    padding: 16px;
    border-bottom: 1px solid var(--chrome-border);
    background: rgba(255, 255, 255, 0.02);
  }

  .media-player-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .media-player-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .media-icon {
    font-size: 16px;
    color: var(--chrome-text-secondary);
  }

  .media-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--chrome-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .media-toggle-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--chrome-text-secondary);
    border-radius: 4px;
    transition: all 0.1s;
  }

  .media-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
  }

  .media-player-content {
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-top: 8px;
    backdrop-filter: blur(10px);
    border: 1px solid var(--chrome-border);
  }

  .media-video, .media-audio {
    width: 100%;
    max-height: 200px;
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .media-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .progress-bar-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-slider {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    cursor: pointer;
  }

  .progress-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--chrome-blue);
    cursor: pointer;
  }

  .progress-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--chrome-blue);
    cursor: pointer;
    border: none;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--chrome-text-secondary);
  }

  .control-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--chrome-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.1s;
    backdrop-filter: blur(10px);
    border: 1px solid var(--chrome-border);
  }

  .control-btn:hover {
    background: rgba(171, 214, 255, 0.2);
    color: var(--chrome-blue);
    border-color: rgba(171, 214, 255, 0.3);
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .volume-slider {
    width: 60px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--chrome-text-secondary);
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--chrome-text-secondary);
    cursor: pointer;
    border: none;
  }

  .media-placeholder {
    text-align: center;
    padding: 32px 16px;
    color: var(--chrome-text-secondary);
  }

  .placeholder-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .media-placeholder p {
    margin: 0;
    font-size: 14px;
  }

  /* Responsive adjustments */
  @media (max-width: 400px) {
    .media-name {
      max-width: 150px;
    }
  }
</style> 