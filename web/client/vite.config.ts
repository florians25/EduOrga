import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Build direkt nach wwwroot von UntPlanWeb (wird von ASP.NET Core als statische Dateien ausgeliefert).
// Entwicklung: `npm run dev` (Port 5173) leitet API-Aufrufe an das Backend weiter (UNTPLANWEB_BACKEND, Standard http://127.0.0.1:5000).
const backend = process.env.UNTPLANWEB_BACKEND ?? 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: resolve(__dirname, '../src/UntPlanWeb/wwwroot'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        monitor: resolve(__dirname, 'monitor.html'),
      },
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/rss': backend,
      '/ical': backend,
      '/sso': backend,
      '/gesundheit': backend,
    },
  },
});
