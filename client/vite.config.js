import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  server: {
    port: 5173,
    host: true
  },
  define: {
    // Add these global definitions
    global: {},
    'process.env': {}
  },
  optimizeDeps: {
    // Add these to properly bundle simple-peer
    include: [
      'simple-peer',
      'randombytes',
      'buffer'
    ],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      }
    }
  }
});