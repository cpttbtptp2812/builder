import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

/** GitHub Pages 子路径 /builder/；百度 BOS 等根目录托管用 './' */
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(root, "src") },
  },
  base: process.env.GITHUB_PAGES === "true" ? "/builder/" : "./",
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: [
      "@perspective-dev/client",
      "@perspective-dev/viewer",
      "@perspective-dev/viewer-datagrid",
      "@perspective-dev/server",
      "regular-table",
    ],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true,
      },
      "/clip-api": {
        target: "http://127.0.0.1:38472",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/clip-api/, ""),
      },
      "/llm-proxy": {
        target: "https://api.deepseek.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/llm-proxy/, ""),
        secure: true,
      },
      "/ollama-cloud-proxy": {
        target: "https://ollama.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ollama-cloud-proxy/, ""),
        secure: true,
      },
    },
  },
});
