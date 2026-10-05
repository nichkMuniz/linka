/**
 * Envio APNs compartilhado por `send-push-notification` e `reengagement-push`.
 *
 * TOKEN DE PROVEDOR (JWT): a Apple exige que ele seja REAPROVEITADO — renovar
 * no máximo a cada 20 min e no mínimo a cada 60 min. Antes cada invocação
 * gerava um JWT novo; numa rajada (8 incentivos em 20 s) isso são 8 tokens
 * diferentes em segundos, e a Apple responde 429 TooManyProviderTokenUpdates —
 * o push some sem aviso. Agora o JWT vive 40 min, guardado em memória (isolate
 * quente) e em `apns_provider_token` (compartilhado entre isolates frios).
 *
 * REGISTRO: cada tentativa vai para `push_delivery_log` (status da Apple,
 * motivo e atraso desde a criação da notificação). Sem acesso aos logs do
 * painel, é a única forma de saber se o push saiu.
 *
 * As duas tabelas vêm de `docs/migrations/20261005-push-delivery-reliability.sql`;
 * sem ela tudo continua funcionando (só sem o cache compartilhado e sem o log).
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Meio do intervalo que a Apple aceita (20–60 min). */
const JWT_TTL_MS = 40 * 60 * 1000;

let memo: { jwt: string; issuedAt: number } | null = null;

async function importP8Key(p8: string): Promise<CryptoKey> {
  const base64 = p8
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

function b64url(input: string | Uint8Array): string {
  const str = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mintJwt(issuedAtSec: number): Promise<string> {
  const key = await importP8Key(Deno.env.get("APNS_KEY_P8")!);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID")! }));
  const payload = b64url(JSON.stringify({ iss: Deno.env.get("APNS_TEAM_ID")!, iat: issuedAtSec }));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

/**
 * JWT válido e reaproveitado. `forceNew` só depois de a Apple recusar o atual
 * (ExpiredProviderToken / InvalidProviderToken).
 */
export async function getApnsJwt(supabase: SupabaseClient, forceNew = false): Promise<string> {
  const now = Date.now();
  if (!forceNew && memo && now - memo.issuedAt < JWT_TTL_MS) return memo.jwt;

  if (!forceNew) {
    const { data } = await supabase
      .from("apns_provider_token")
      .select("jwt, issued_at")
      .eq("id", 1)
      .maybeSingle();
    const issuedAt = data?.issued_at ? Date.parse(String(data.issued_at)) : NaN;
    if (data?.jwt && now - issuedAt < JWT_TTL_MS) {
      memo = { jwt: String(data.jwt), issuedAt };
      return memo.jwt;
    }
  }

  const issuedAtSec = Math.floor(now / 1000);
  const jwt = await mintJwt(issuedAtSec);
  memo = { jwt, issuedAt: issuedAtSec * 1000 };
  // Tabela ausente (migração não rodada) → erro ignorado, fica só a memória.
  await supabase
    .from("apns_provider_token")
    .upsert({ id: 1, jwt, issued_at: new Date(issuedAtSec * 1000).toISOString() });
  return jwt;
}

export type ApnsResult = { token: string; status: number; reason?: string };

/**
 * Envia o mesmo payload para cada token. Token morto (BadDeviceToken /
 * Unregistered) sai de `push_tokens`; JWT recusado é renovado e a tentativa
 * repetida uma vez.
 */
export async function sendApns(
  supabase: SupabaseClient,
  tokens: string[],
  payload: string,
  priority: "10" | "5",
): Promise<ApnsResult[]> {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID")!;

  const post = (token: string, jwt: string) =>
    fetch(`https://api.push.apple.com/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": priority,
        "content-type": "application/json",
      },
      body: payload,
    });

  const one = async (token: string): Promise<ApnsResult> => {
    try {
      let res = await post(token, await getApnsJwt(supabase));
      let reason: string | undefined;
      if (!res.ok) {
        reason = (await res.json().catch(() => ({})))?.reason;
        if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken") {
          res = await post(token, await getApnsJwt(supabase, true));
          reason = res.ok ? undefined : (await res.json().catch(() => ({})))?.reason;
        }
      }
      if (!res.ok) {
        console.error(`APNs ${res.status} ${reason ?? ""} token=${token.slice(0, 8)}…`);
        if (reason === "BadDeviceToken" || reason === "Unregistered") {
          await supabase.from("push_tokens").delete().eq("token", token);
        }
        return { token, status: res.status, reason };
      }
      return { token, status: 200 };
    } catch (err) {
      console.error(`APNs fetch falhou token=${token.slice(0, 8)}…`, err);
      return { token, status: 0, reason: err instanceof Error ? err.message : String(err) };
    }
  };

  return Promise.all(tokens.map(one));
}

/**
 * Grava as tentativas em `push_delivery_log` (melhor esforço: erro aqui nunca
 * derruba o envio). `createdAt` = criação da notificação, para medir o atraso.
 */
export async function logDeliveries(
  supabase: SupabaseClient,
  info: { userId: string; type: number; notificationId?: string | number | null; createdAt?: string | null; source: string },
  results: ApnsResult[],
): Promise<void> {
  const created = info.createdAt ? Date.parse(info.createdAt) : NaN;
  const delayMs = Number.isFinite(created) ? Math.max(0, Date.now() - created) : null;
  const rows = (results.length ? results : [{ token: "", status: 0, reason: "no_tokens" }]).map((r) => ({
    source: info.source,
    notification_id: info.notificationId != null ? String(info.notificationId) : null,
    user_id: info.userId,
    type: info.type,
    token_prefix: r.token ? r.token.slice(0, 8) : null,
    status: r.status,
    reason: r.reason ?? null,
    delay_ms: delayMs,
  }));
  try {
    await supabase.from("push_delivery_log").insert(rows);
    // Retenção de 30 dias sem cron: ~1 a cada 50 envios faz a faxina.
    if (Math.random() < 0.02) {
      await supabase
        .from("push_delivery_log")
        .delete()
        .lt("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
    }
  } catch (err) {
    console.error("push_delivery_log:", err);
  }
}
