import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { BACKEND_URL } from "./src/config.js";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"],
      manifest: {
        name: "HDVault: Exam Photo and Document Resizer",
        short_name: "HDVault",
        description: "Resize exam photos, signatures, and marksheets to portal limits. An independent tool.",
        start_url: "/vault",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f8fafc",
        theme_color: "#1e3a8a",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Only the app shell is saved for offline use. API responses and files are never saved.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
      devOptions: { enabled: false },
    }),
  ],
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
