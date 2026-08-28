import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** 百度 BOS / 任意静态托管：base 用 './' */
export default defineConfig({
  plugins: [react()],
  base: "./",
});
