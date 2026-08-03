import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { handleLinkPreview } from "./routes/link-preview";
import { SHARE_ORIGINS } from "../shared/share-config";

export function createServer() {
  const app = express();

  // CORS restrito: o app iOS (Capacitor) chama a API a partir de capacitor://
  // ou de um WebView sem Origin. Um `cors()` sem opções refletia qualquer
  // origem, o que permitia a qualquer site usar esta API como proxy.
  const allowedOrigins = new Set([
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    ...SHARE_ORIGINS,
  ]);

  const isDev = process.env.NODE_ENV !== "production";

  function isAllowedOrigin(origin: string): boolean {
    if (allowedOrigins.has(origin)) return true;
    // Em dev o Vite escolhe a porta livre (5173, 5174, 8080…) — aceita qualquer
    // porta local em vez de fixar uma que muda a cada `pnpm dev`.
    return isDev && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }

  const corsMiddleware = cors({
    origin: (origin, callback) => {
      // Sem Origin (WebView nativo, curl, health check) → liberado.
      // Origem não permitida → responde SEM o header CORS (o navegador é quem
      // bloqueia). Nunca com `new Error()`: isso vira 500 no Express, e como
      // este app é montado como middleware do Vite em dev, derrubava até o
      // carregamento da página.
      callback(null, !origin || isAllowedOrigin(origin));
    },
  });

  // CORS só nas rotas de API — o resto do tráfego é o Vite/SPA servindo a
  // própria página, que não precisa (nem deve) passar por este middleware.
  app.use("/api", corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Link preview proxy — fetches Open Graph / meta tags server-side to avoid CORS
  app.get("/api/link-preview", handleLinkPreview);

  // Apple Universal Links — deve ser servido sem extensão com Content-Type correto
  app.get("/.well-known/apple-app-site-association", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.sendFile(
      path.join(__dirname, "../public/.well-known/apple-app-site-association"),
    );
  });

  return app;
}
