import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { rmSync } from 'node:fs';

// Build direkt nach wwwroot von UntPlanWeb (wird von ASP.NET Core als statische Dateien ausgeliefert).
// Entwicklung: `npm run dev` (Port 5173) leitet API-Aufrufe an das Backend weiter (UNTPLANWEB_BACKEND, Standard http://127.0.0.1:5000).
const backend = process.env.UNTPLANWEB_BACKEND ?? 'http://127.0.0.1:5000';
// wwwroot enthält feste Dateien aus dem Repository (fonts/, img/, manifest.webmanifest, neuigkeiten.json) – sie bleiben erhalten.
// Der Build ersetzt nur index.html, monitor.html und assets/ (nicht im Repository, siehe .gitignore).
const wwwroot = resolve(__dirname, '../src/UntPlanWeb/wwwroot');

const aufraeumen = {
  name: 'untplan-wwwroot-aufraeumen',
  apply: 'build' as const,
  buildStart() {
    for (const x of ['assets', 'index.html', 'monitor.html']) rmSync(resolve(wwwroot, x), { recursive: true, force: true });
  },
};

export default defineConfig(({ command }) => ({
  plugins: [react(), aufraeumen],
  base: '/',
  // Entwicklung: Schriften, Bilder und Neuigkeiten direkt aus wwwroot
  publicDir: command === 'serve' ? wwwroot : false,
  build: {
    outDir: wwwroot,
    emptyOutDir: false,
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
}));
