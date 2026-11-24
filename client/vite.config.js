import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development, any request to /api is forwarded to the Node.js
// server on port 5000, so the React code can simply call fetch("/api/...").
// (The browser never talks to the Python AI service directly.)
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
