/**
 * Supabase Edge Function: reengagement-push
 *
 * Push proativo de RE-ENGAJAMENTO (retenção). Diferente de `send-push-notification`
 * (que reage a eventos sociais via webhook), esta função é AGENDADA (pg_cron, 1x/dia)
 * e calcula quem merece um empurrão:
 *   - Sequência em risco: fez check-in ONTEM mas ainda não HOJE (streak >= 3).
 *   - Inatividade: último check-in foi há exatamente 3 ou 7 dias.
 *
 * Envia APNs direto (não insere em `notifications`) — é um lembrete efêmero, não
 * precisa virar card na tela de Notificações nem inflar o badge de não lidas.
 *
 * Datas de referência são calculadas em America/Sao_Paulo (público majoritariamente
 * BR; mesma premissa do restante do app). Copy em PT, igual a `send-push-notification`.
 *
 * Env (Supabase → Edge Functions → Secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID e (opcional) REENGAGEMENT_CRON_SECRET.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── APNs JWT (idêntico a send-push-notification) ────────────────────────────

async function importP8Key(p8: string): Promise<CryptoKey> {
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
    ["sign"],
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

// ─── Datas em America/Sao_Paulo ──────────────────────────────────────────────

function ymdInSaoPaulo(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  // en-CA → formato YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function daysBetween(a: string, b: string): number {
  // a, b = YYYY-MM-DD → diferença em dias (a - b)
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round((da - db) / 86400000);
}

// Streak = dias consecutivos terminando na data mais recente (datas únicas desc).
function computeStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < datesDesc.length; i++) {
    if (daysBetween(datesDesc[i - 1], datesDesc[i]) === 1) streak++;
    else break;
  }
  return streak;
}

// ─── Copy dos nudges (PT — igual a send-push-notification) ────────────────────

type Nudge = { title: string; body: string; url: string };

function streakRiskNudge(streak: number): Nudge {
  return {
    title: "🔥 Sua sequência está em risco!",
    body: `Você está há ${streak} dias seguidos. Faça seu check-in de hoje para não zerar.`,
    url: "/metas",
  };
}

function inactivityNudge(days: number): Nudge {
  return {
    title: "Sentimos sua falta 💪",
    body: `Faz ${days} dias que você não treina. Que tal voltar hoje?`,
    url: "/metas",
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Proteção opcional contra chamadas externas — se o segredo estiver setado,
  // exige o header x-cron-secret (o pg_cron envia esse header).
  const cronSecret = Deno.env.get("REENGAGEMENT_CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apnsKeyP8 = Deno.env.get("APNS_KEY_P8")!;
  const apnsKeyId = Deno.env.get("APNS_KEY_ID")!;
  const apnsTeamId = Deno.env.get("APNS_TEAM_ID")!;
  const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const today = ymdInSaoPaulo(0);
  const yesterday = ymdInSaoPaulo(-1);
  const since = ymdInSaoPaulo(-32);

  // 1. Tokens iOS por usuário (só usuários com push ativo entram no cálculo).
  const { data: tokenRows, error: tokErr } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .eq("platform", "ios");
  if (tokErr) return new Response(`token query error: ${tokErr.message}`, { status: 500 });

  const tokensByUser = new Map<string, string[]>();
  for (const r of tokenRows ?? []) {
    const arr = tokensByUser.get(r.user_id) ?? [];
    arr.push(r.token);
    tokensByUser.set(r.user_id, arr);
  }
  if (tokensByUser.size === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no tokens" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // 2. Check-ins recentes só dos usuários com token.
  const userIds = [...tokensByUser.keys()];
  const { data: ciRows, error: ciErr } = await supabase
    .from("check_ins")
    .select("user_id, check_in_date")
    .in("user_id", userIds)
    .gte("check_in_date", since);
  if (ciErr) return new Response(`checkin query error: ${ciErr.message}`, { status: 500 });

  // 3. Agrupa datas únicas por usuário (desc).
  const datesByUser = new Map<string, string[]>();
  for (const r of ciRows ?? []) {
    const arr = datesByUser.get(r.user_id) ?? [];
    arr.push(String(r.check_in_date));
    datesByUser.set(r.user_id, arr);
  }

  // 4. Decide o nudge de cada usuário.
  const targets: { userId: string; nudge: Nudge }[] = [];
  for (const userId of userIds) {
    const dates = [...new Set(datesByUser.get(userId) ?? [])].sort().reverse();
    if (dates.length === 0) continue; // sem histórico recente — nada a nudge (evita spam a quem nunca usou)
    const last = dates[0];
    if (last === today) continue; // já treinou hoje

    const gap = daysBetween(today, last); // dias desde o último check-in
    if (last === yesterday) {
      const streak = computeStreak(dates);
      if (streak >= 3) targets.push({ userId, nudge: streakRiskNudge(streak) });
    } else if (gap === 3 || gap === 7) {
      targets.push({ userId, nudge: inactivityNudge(gap) });
    }
  }

  if (targets.length === 0) {
    return new Response(JSON.stringify({ sent: 0, evaluated: userIds.length }), {
      headers: { "content-type": "application/json" },
    });
  }

  // 5. Envia APNs (um JWT reutilizado para toda a rodada).
  const jwt = await makeApnsJwt(apnsKeyId, apnsTeamId, apnsKeyP8);
  let sent = 0;

  await Promise.allSettled(
    targets.flatMap(({ userId, nudge }) => {
      const payload = JSON.stringify({
        aps: { alert: { title: nudge.title, body: nudge.body }, sound: "default", badge: 1 },
        url: nudge.url,
      });
      return (tokensByUser.get(userId) ?? []).map((token) =>
        fetch(`https://api.push.apple.com/3/device/${token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${jwt}`,
            "apns-topic": apnsBundleId,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: payload,
        }).then(async (res) => {
          if (res.ok) { sent++; return; }
          const errBody = await res.json().catch(() => ({}));
          if (errBody.reason === "BadDeviceToken" || errBody.reason === "Unregistered") {
            await supabase.from("push_tokens").delete().eq("token", token);
          }
        }),
      );
    }),
  );

  return new Response(
    JSON.stringify({ sent, targets: targets.length, evaluated: userIds.length }),
    { headers: { "content-type": "application/json" } },
  );
});
