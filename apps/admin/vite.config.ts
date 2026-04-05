import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Default API origin for local dev; override with VITE_API_BASE_URL (e.g. http://localhost:3000)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
  },
});
