import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["safety360-icon.svg"],
      manifest: {
        name: "Safety360",
        short_name: "Safety360",
        description: "Integrated HSE, environment, energy, quality, information security and data-center management system.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#0f172a",
        lang: "de",
        categories: ["business", "productivity", "utilities"],
        icons: [
          {
            src: "/safety360-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,json}"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
