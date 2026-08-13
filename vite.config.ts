import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";
import type { Plugin, PluginOption } from "vite";

// Versão exibida no Sentry e no relato de problema. Lida direto do projeto
// Xcode para não existir um segundo lugar a manter em sincronia: o número que
// vale é sempre o que foi para a App Store.
function marketingVersion(): string {
  try {
    const pbxproj = fs.readFileSync(
      path.resolve(__dirname, "ios/App/App.xcodeproj/project.pbxproj"),
      "utf8",
    );
    return pbxproj.match(/MARKETING_VERSION = ([\d.]+);/)?.[1] ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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

// Upload de source maps: só acontece quando as três variáveis estão presentes
// (localmente elas não estão, e o build segue idêntico ao de hoje). Sem isto o
// stack trace no Sentry vem minificado — `index-B3xK.js:48:12933` em vez do
// arquivo e da linha de verdade.
const SENTRY_UPLOAD = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default defineConfig(async () => {
  const define: Record<string, string> = {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    // Chave PÚBLICA do SDK do RevenueCat (iOS) — nasce para ser embutida no
    // binário. O Vite não lê variáveis do ambiente do processo sozinho, só de
    // arquivos .env; por isso a injeção explícita, igual às do Supabase.
    'import.meta.env.VITE_REVENUECAT_IOS_KEY': JSON.stringify(process.env.VITE_REVENUECAT_IOS_KEY),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(marketingVersion()),
  };
  // Só sobrescreve quando veio do ambiente do processo (Appflow/Vercel). Se
  // ficasse sempre definido, um `define` vazio venceria o valor do `.env` local.
  if (process.env.VITE_SENTRY_DSN) {
    define['import.meta.env.VITE_SENTRY_DSN'] = JSON.stringify(process.env.VITE_SENTRY_DSN);
  }

  const plugins: PluginOption[] = [
    expressDevMiddleware(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Sem esta lista, o NavigationRoute do Workbox responde TODA navegação
        // com o index.html do cache. /termos e /privacidade são páginas
        // estáticas (public/*.html) servidas por rewrite na Vercel — o SPA não
        // tem rota para elas, então caíam no NotFound e daí no login.
        // A Apple clica nesses dois links ao revisar a assinatura (3.1.2).
        navigateFallbackDenylist: [/^\/termos$/, /^\/privacidade$/, /^\/api\//],
      },
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
  ];

  if (SENTRY_UPLOAD) {
    const { sentryVitePlugin } = await import("@sentry/vite-plugin");
    plugins.push(
      ...(sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: { name: `linka@${marketingVersion()}` },
        sourcemaps: {
          // Os .map são gerados só para subir e apagados em seguida — senão
          // viajariam dentro do binário e entregariam o código-fonte inteiro.
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
        // Falha de upload (token vencido, rede) não pode reprovar o build no
        // Appflow — o app funciona igual, só sem stack trace legível.
        errorHandler: (err) => console.warn("[sentry] upload de source maps falhou:", err.message),
      }) as PluginOption[]),
    );
  }

  return {
    cacheDir: "/tmp/vite-cache",
    define,
    build: {
      sourcemap: SENTRY_UPLOAD ? ("hidden" as const) : false,
      rollupOptions: {
        output: {
          // Separa as dependências grandes em chunks próprios.
          //
          // Sem isto, tudo que a entrada alcançava virava um único arquivo de
          // 1,34 MB — o Rollup avisava literalmente sobre isso a cada build.
          // Dois ganhos: o parse do arquivo de entrada deixa de carregar o que
          // só uma tela usa, e cada chunk passa a ter hash próprio, então uma
          // mudança no nosso código não invalida o cache das bibliotecas.
          //
          // React e Supabase continuam sendo buscados na abertura (a árvore e
          // a sessão dependem deles) — mas agora em paralelo, e não como um
          // bloco monolítico a ser parseado antes de qualquer outra coisa.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
              return "vendor-react";
            }
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
              return "vendor-motion";
            }
            // Já chega por import dinâmico (ver client/lib/monitoring.ts); o
            // chunk nomeado só o mantém fora dos chunks de tela.
            if (id.includes("@sentry")) return "vendor-sentry";
            if (id.includes("lucide-react")) return "vendor-icons";
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client"),
        // Código sem dependência de plataforma, compartilhado entre client/,
        // server/ e as funções serverless em api/. Já declarado em tsconfig.json.
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    plugins,
  };
});