import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import type { Plugin } from "vite";

// Injects the Express server as Vite middleware in dev mode so /api/* routes work without a separate process.
function expressDevMiddleware(): Plugin {
  return {
    name: "express-dev-middleware",
    apply: "serve",
    async configureServer(server) {
      const { createServer: createExpressServer } = await import("./server/index");
      const app = createExpressServer();
      server.middlewares.use(app);
    },
  };
}

export default defineConfig({
  cacheDir: "/tmp/vite-cache",
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client"),
      // Código sem dependência de plataforma, compartilhado entre client/,
      // server/ e as funções serverless em api/. Já declarado em tsconfig.json.
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  plugins: [
    expressDevMiddleware(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Linka",
        short_name: "Linka",
        theme_color: "#111827",
        background_color: "#111827",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});