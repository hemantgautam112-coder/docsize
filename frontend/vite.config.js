import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { BACKEND_URL } from "./src/config.js";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: BACKEND_URL,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    globals: false,
  },
});
