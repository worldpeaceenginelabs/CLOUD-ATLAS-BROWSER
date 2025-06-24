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