import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

/** GitHub Pages 子路径 /builder/；百度 BOS 等根目录托管用 './' */
export default defineConfig({
  root,
  plugins: [react()],
  base: process.env.GITHUB_PAGES === "true" ? "/builder/" : "./",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/llm-proxy": {
        target: "https://api.deepseek.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/llm-proxy/, ""),
        secure: true,
      },
    },
  },
});
