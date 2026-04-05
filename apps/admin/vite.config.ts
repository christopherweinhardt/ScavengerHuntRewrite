import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages project sites live under /<repo>/; set VITE_BASE_PATH in CI (e.g. /ScavengerHuntRewrite/).
const baseRaw = process.env.VITE_BASE_PATH?.trim() || "/";
const base = baseRaw === "/" ? "/" : `${baseRaw.replace(/\/$/, "")}/`;

// Default API origin for local dev; override with VITE_API_BASE_URL (e.g. https://api.example.com)
export default defineConfig({
  base,
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
