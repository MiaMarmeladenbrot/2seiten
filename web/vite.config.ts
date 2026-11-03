import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [".."] },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        impressum: resolve(import.meta.dirname, "impressum/index.html"),
        datenschutz: resolve(import.meta.dirname, "datenschutz/index.html"),
      },
    },
  },
});
