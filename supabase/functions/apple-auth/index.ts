/**
 * Supabase Edge Function: apple-auth
 *
 * Chamada pelo app (com a sessão do usuário — verify_jwt ligado, o padrão):
 *
 *   { "action": "store", "authorizationCode": "<code>" }
 *     Logo depois do Sign in with Apple nativo: troca o code (uso único, 5 min)
 *     pelo refresh_token e guarda em `apple_auth_tokens`.
 *
 *   { "action": "revoke" }
 *     Ao pedir a exclusão da conta: revoga a autorização na Apple (guideline
 *     5.1.1(v)) e apaga o token guardado.
 *
 * O usuário vem SEMPRE do JWT, nunca do body — ninguém revoga/grava por outro.
 * Secrets: ver `_shared/apple-signin.ts`.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  appleSignInConfigured,
  exchangeAuthorizationCode,
  revokeStoredAppleToken,
  storeAppleRefreshToken,
} from "../_shared/apple-signin.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  const userId = userData?.user?.id;
  if (userErr || !userId) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));

  try {
    if (body?.action === "store") {
      const code = String(body?.authorizationCode ?? "").trim();
      if (!code) return json({ error: "missing_code" }, 400);
      if (!appleSignInConfigured()) {
        console.error("apple-auth: secrets de Sign in with Apple ausentes — token não guardado");
        return json({ stored: false, reason: "not_configured" });
      }
      const refreshToken = await exchangeAuthorizationCode(code);
      await storeAppleRefreshToken(supabase, userId, refreshToken);
      return json({ stored: true });
    }

    if (body?.action === "revoke") {
      const result = await revokeStoredAppleToken(supabase, userId);
      if (result === "not_configured") {
        console.error("apple-auth: secrets de Sign in with Apple ausentes — token NÃO revogado");
      }
      return json({ result });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`apple-auth ${body?.action}:`, message);
    return json({ error: message }, 502);
  }
});
