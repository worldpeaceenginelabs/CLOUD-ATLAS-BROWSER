import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      external: [
        'electron'
      ]
    },
    target: 'esnext',
    minify: false
  },

  // Handle Node.js modules for WebTorrent
  define: {
    global: 'globalThis',
    process: {
      env: {},
      browser: true,
      version: '"v18.0.0"'
    },
    // Fix Buffer undefined error
    Buffer: 'Buffer'
  },

  resolve: {
    alias: {
      // Use browser-compatible versions
      events: 'events',
      path: 'path-browserify',
      crypto: 'crypto-browserify', 
      stream: 'readable-stream',
      buffer: 'buffer',
      util: 'util',
      url: 'url',
      querystring: 'querystring-es3',
      os: 'os-browserify/browser',
      // Disable Node.js modules that don't work in browser
      fs: resolve(__dirname, 'src/utils/empty.js'),
      net: resolve(__dirname, 'src/utils/empty.js'),
      tls: resolve(__dirname, 'src/utils/empty.js')
    }
  },

  optimizeDeps: {
    include: [
      'buffer',
      'events',
      'util',
      'path-browserify',
      'crypto-browserify',
      'readable-stream',
      'os-browserify/browser',
      'url',
      'querystring-es3',
      'webtorrent',
      'parse-torrent',
      'magnet-uri'
    ]
  },

  // Development server
  server: {
    port: 5173,
    host: true
  },

  // CSS processing
  css: {
    postcss: './postcss.config.js'
  }
});