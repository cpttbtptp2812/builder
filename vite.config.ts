import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

function skipHeavyModules() {
  return {
    name: "skip-heavy-modules",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (id === "@huggingface/transformers" || id.startsWith("@huggingface/transformers/")) {
        return { id, external: true };
      }
      return null;
    },
  };
}

/** GitHub Pages 子路径 /builder/；百度 BOS 等根目录托管用 './' */
export default defineConfig(({ command }) => ({
  root,
  plugins: [skipHeavyModules(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(root, "src") },
      {
        find: /^lucide-react\/dynamicIconImports(?:\.mjs|\.js)?$/,
        replacement: path.resolve(root, "src/shims/lucide-dynamic-empty.ts"),
      },
      {
        find: /^lucide-react$/,
        replacement: path.resolve(root, "node_modules/lucide-react/dist/cjs/lucide-react.js"),
      },
      ...(command === "build"
        ? [
            {
              find: /^@openuidev\/react-ui(?:\/.*)?$/,
              replacement: path.resolve(root, "src/shims/openui-react-ui-empty.ts"),
            },
            {
              find: /^@openuidev\/assistant-ui(?:\/.*)?$/,
              replacement: path.resolve(root, "src/shims/openui-assistant-empty.ts"),
            },
          ]
        : []),
    ],
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
  build: {
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:8080",
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
}));
