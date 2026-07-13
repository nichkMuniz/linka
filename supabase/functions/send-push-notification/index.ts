/**
 * Supabase Edge Function: send-push-notification
 *
 * Triggered by a Supabase Database Webhook on INSERT into public.notifications.
 * Fetches the target user's APNs device tokens and sends a push via APNs HTTP/2.
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL               — your project URL (auto-injected)
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (auto-injected)
 *   APNS_KEY_P8                — contents of your .p8 file (multi-line, keep \n)
 *   APNS_KEY_ID                — 10-char Key ID from Apple Developer Portal
 *   APNS_TEAM_ID               — 10-char Team ID from Apple Developer Portal
 *   APNS_BUNDLE_ID             — e.g. com.linka.meuapp
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── APNs JWT ─────────────────────────────────────────────────────────────────

async function importP8Key(p8: string): Promise<CryptoKey> {
  // Strip PEM headers and newlines → raw base64
  const base64 = p8
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function makeApnsJwt(keyId: string, teamId: string, p8: string): Promise<string> {
  const key = await importP8Key(p8);
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "ES256", kid: keyId }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = btoa(JSON.stringify({ iss: teamId, iat: now }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const sigBuffer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, sigInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${header}.${payload}.${sig}`;
}

// ─── Notification content by type ────────────────────────────────────────────

const NOTIF_CONTENT: Record<number, { title: string; body: string }> = {
  1: { title: "Novo seguidor 👤", body: "Alguém começou a te seguir." },
  2: { title: "Novo incentivo 🔥", body: "Alguém reagiu à sua postagem." },
  3: { title: "Novo comentário 💬", body: "Alguém comentou na sua postagem." },
  4: { title: "Convite para duelo ⚔️", body: "Você recebeu um convite para duelo." },
  5: { title: "Pedido de entrada 👊", body: "Alguém quer entrar no seu grupo." },
  6: { title: "Reação no comentário ❤️", body: "Alguém reagiu ao seu comentário." },
  7: { title: "Reação no check-in 🏆", body: "Alguém reagiu ao seu check-in." },
  8: { title: "Comentário na promoção 🛍️", body: "Alguém comentou na sua promoção." },
  9: { title: "Você foi marcado 📸", body: "Alguém marcou você em uma publicação." },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Supabase DB Webhook sends a POST with the new row as JSON
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { record?: { user_id?: string; type?: number } };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const userId = body?.record?.user_id;
  const notifType = body?.record?.type ?? 0;

  if (!userId) {
    return new Response("No user_id in payload", { status: 200 });
  }

  // Load secrets
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apnsKeyP8 = Deno.env.get("APNS_KEY_P8")!;
  const apnsKeyId = Deno.env.get("APNS_KEY_ID")!;
  const apnsTeamId = Deno.env.get("APNS_TEAM_ID")!;
  const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID")!;

  // Fetch device tokens for this user
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: tokens, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .eq("platform", "ios");

  if (error || !tokens?.length) {
    return new Response("No tokens found", { status: 200 });
  }

  // Build APNs JWT (valid for ~55 min — generate fresh each invocation for simplicity)
  const jwt = await makeApnsJwt(apnsKeyId, apnsTeamId, apnsKeyP8);

  const content = NOTIF_CONTENT[notifType] ?? {
    title: "Nova notificação 🔔",
    body: "Você tem uma nova notificação no LinKa.",
  };

  const apnsPayload = JSON.stringify({
    aps: {
      alert: { title: content.title, body: content.body },
      sound: "default",
      badge: 1,
    },
    url: "/notificacoes",
  });

  // Send to each registered device (production APNs endpoint)
  const results = await Promise.allSettled(
    tokens.map(({ token }) =>
      fetch(`https://api.push.apple.com/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": apnsBundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: apnsPayload,
      }).then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          // Remove invalid/expired tokens automatically
          if (errBody.reason === "BadDeviceToken" || errBody.reason === "Unregistered") {
            await supabase.from("push_tokens").delete().eq("token", token);
          }
          return { token, status: res.status, reason: errBody.reason };
        }
        return { token, status: 200 };
      })
    )
  );

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { "content-type": "application/json" },
  });
});
