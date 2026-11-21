import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Built into Django's static files: served at /static/app/ (see kizuna/views.py).
export default defineConfig({
  base: "/static/app/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    outDir: "../assets/app", emptyOutDir: true, manifest: true, chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react-router", "@tanstack/react-query"], charts: ["recharts"], motion: ["motion"], radix: ["@radix-ui/react-dialog", "@radix-ui/react-tooltip", "@radix-ui/react-tabs", "@radix-ui/react-switch", "@radix-ui/react-dropdown-menu"] } } },
  },
  server: { proxy: { "/api": "http://127.0.0.1:8000", "/static": "http://127.0.0.1:8000" } },
});
