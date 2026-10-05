/**
 * Sign in with Apple — guardar e REVOGAR o token do usuário.
 *
 * A Apple exige (guideline 5.1.1(v)) que, ao excluir uma conta criada com Sign
 * in with Apple, o app revogue a autorização pela REST API. Para revogar é
 * preciso um token da Apple — e o login nativo só entrega um `authorizationCode`
 * de uso único, válido por 5 minutos. Por isso:
 *
 *   login   → app manda o code → `exchangeAuthorizationCode` → refresh_token
 *             guardado em `apple_auth_tokens` (só service role lê);
 *   exclusão → `revokeStoredAppleToken` → POST /auth/revoke → linha apagada.
 *
 * Secrets (Edge Functions → Secrets):
 *   APPLE_SIGNIN_KEY_P8 — conteúdo do .p8 de uma chave com "Sign in with Apple"
 *                         habilitado (Apple Developer → Keys). NÃO é a de APNs,
 *                         a menos que essa chave tenha os dois serviços.
 *   APPLE_SIGNIN_KEY_ID — Key ID dessa chave (10 caracteres).
 *   APPLE_TEAM_ID       — opcional; cai em APNS_TEAM_ID.
 *   APPLE_CLIENT_ID     — opcional; cai em APNS_BUNDLE_ID (com.linka.meuapp).
 *                         No login nativo o client_id é o bundle id do app.
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const APPLE_AUTH = "https://appleid.apple.com";

function b64url(input: string | Uint8Array): string {
  const str = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function config() {
  const p8 = Deno.env.get("APPLE_SIGNIN_KEY_P8");
  const keyId = Deno.env.get("APPLE_SIGNIN_KEY_ID");
  const teamId = Deno.env.get("APPLE_TEAM_ID") ?? Deno.env.get("APNS_TEAM_ID");
  const clientId = Deno.env.get("APPLE_CLIENT_ID") ?? Deno.env.get("APNS_BUNDLE_ID");
  if (!p8 || !keyId || !teamId || !clientId) return null;
  return { p8, keyId, teamId, clientId };
}

/** true quando os secrets da Apple estão configurados. */
export function appleSignInConfigured(): boolean {
  return config() !== null;
}

/**
 * client_secret da REST API da Apple: JWT ES256 assinado com a chave de Sign
 * in with Apple. Vale 1 hora (a Apple aceita até 6 meses; curto é mais seguro
 * e gerar é barato).
 */
async function makeClientSecret(): Promise<{ clientId: string; secret: string }> {
  const cfg = config();
  if (!cfg) throw new Error("APPLE_SIGNIN_NOT_CONFIGURED");
  const base64 = cfg.p8
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const payload = b64url(JSON.stringify({
    iss: cfg.teamId,
    iat: now,
    exp: now + 3600,
    aud: APPLE_AUTH,
    sub: cfg.clientId,
  }));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return { clientId: cfg.clientId, secret: `${header}.${payload}.${b64url(new Uint8Array(sig))}` };
}

/** Troca o authorizationCode (uso único, 5 min) pelo refresh_token. */
export async function exchangeAuthorizationCode(code: string): Promise<string> {
  const { clientId, secret } = await makeClientSecret();
  const res = await fetch(`${APPLE_AUTH}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.refresh_token) {
    throw new Error(`apple /auth/token ${res.status}: ${body?.error ?? "sem refresh_token"}`);
  }
  return String(body.refresh_token);
}

/** Revoga um refresh_token. A Apple responde 200 também para token já revogado. */
async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const { clientId, secret } = await makeClientSecret();
  const res = await fetch(`${APPLE_AUTH}/auth/revoke`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`apple /auth/revoke ${res.status}: ${body?.error ?? ""}`);
  }
}

export async function storeAppleRefreshToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string,
): Promise<void> {
  const { error } = await supabase
    .from("apple_auth_tokens")
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() });
  if (error) throw new Error(`apple_auth_tokens: ${error.message}`);
}

/**
 * Revoga e apaga o token guardado do usuário.
 * `"revoked"` | `"no_token"` (nunca entrou com Apple depois desta mudança, ou
 * já foi revogado) | `"not_configured"` (secrets ausentes).
 */
export async function revokeStoredAppleToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<"revoked" | "no_token" | "not_configured"> {
  const { data, error } = await supabase
    .from("apple_auth_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`apple_auth_tokens: ${error.message}`);
  if (!data?.refresh_token) return "no_token";
  if (!appleSignInConfigured()) return "not_configured";

  await revokeRefreshToken(String(data.refresh_token));
  await supabase.from("apple_auth_tokens").delete().eq("user_id", userId);
  return "revoked";
}
