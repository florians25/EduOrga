import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build nach ../src/EduOrgaWebsite/wwwroot (wird vom kleinen ASP.NET-Core-Server ausgeliefert).
// Entwicklung: npm run dev – /api (Gesundheit, Betreiberangaben) geht an WEBSITE_URL (Standard http://127.0.0.1:5520).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../src/EduOrgaWebsite/wwwroot",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": process.env.WEBSITE_URL ?? "http://127.0.0.1:5520" },
  },
});
