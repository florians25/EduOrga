import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build nach ../src/EduOrgaWebsite/wwwroot (wird vom ASP.NET-Core-Server ausgeliefert).
// Entwicklung: npm run dev – /api geht an WEBSITE_URL (Standard http://127.0.0.1:5520).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../src/EduOrgaWebsite/wwwroot",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { fluent: ["@fluentui/react-components"], dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"] },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": process.env.WEBSITE_URL ?? "http://127.0.0.1:5520" },
  },
});
