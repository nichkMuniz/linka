import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { handleDemo } from "./routes/demo";
import { handleGetUser, handleSignOut, handleRefreshSession, handleDeleteAuthUser } from "./routes/auth";
import { handleLinkPreview } from "./routes/link-preview";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes - proxy Supabase auth to avoid CORS issues
  app.post("/api/auth/user", handleGetUser);
  app.post("/api/auth/sign-out", handleSignOut);
  app.post("/api/auth/refresh", handleRefreshSession);
  app.post("/api/auth/delete-account", handleDeleteAuthUser);

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
