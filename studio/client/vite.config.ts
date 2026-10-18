// Build der Oberfläche von UntPlan Studio. `npm run build` schreibt nach ../src/UntPlanStudio/wwwroot,
// das der Server statisch ausliefert. `npm run dev` startet einen Entwicklungsserver mit Weiterleitung der API.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const server = process.env.STUDIO_URL || 'http://127.0.0.1:5501';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5173,
    fs: { allow: ['..', '../../design'] },
    proxy: { '/api': { target: server, changeOrigin: true }, '/gesundheit': server },
  },
  build: {
    outDir: '../src/UntPlanStudio/wwwroot',
    emptyOutDir: true,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@fluentui/react-icons')) return 'symbole';
          if (id.includes('node_modules/@fluentui') || id.includes('node_modules/@griffel') || id.includes('node_modules/tabster')) return 'fluent';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/@tanstack') || id.includes('node_modules/@dnd-kit')) return 'werkzeuge';
          return undefined;
        },
      },
    },
  },
});
