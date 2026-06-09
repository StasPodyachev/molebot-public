import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  define: {
    global: "globalThis",
    "process.env": "{}",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
