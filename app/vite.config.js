import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Use root path for Vercel, /mero-docs/ for other deployments
  base: process.env.VERCEL ? '/' : '/mero-docs/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        404: resolve(__dirname, 'public/404.html'),
      },
    },
  },
  plugins: [nodePolyfills(), react(), tailwindcss()],
});
