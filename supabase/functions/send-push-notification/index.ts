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
 *   PUSH_WEBHOOK_SECRET        — segredo compartilhado com o Database Webhook
 *
 * SEGURANÇA: esta função roda com `verify_jwt` desligado (o Database Webhook não
 * manda JWT de usuário). Sem o segredo abaixo, qualquer pessoa na internet
 * poderia POSTar `{"record":{"user_id":"<vítima>","type":9,...}}` e disparar um
 * push forjado no iPhone de qualquer usuário. O webhook deve ser configurado com
 * o header `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.
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

type NotifRecord = {
  user_id?: string;
  type?: number;
  follower_id?: string;
  post_id?: string;
  shots_id?: string;
  flow_id?: number | string;
  duel_check_in_id?: string;
  incentive_type?: number;
};

const TITLE_BY_TYPE: Record<number, string> = {
  1: "Novo seguidor 👤",
  2: "Novo incentivo 🔥",
  3: "Novo comentário 💬",
  4: "Convite para duelo ⚔️",
  5: "Pedido de entrada 👊",
  6: "Reação no comentário ❤️",
  7: "Reação no check-in 🏆",
  8: "Comentário na promoção 🛍️",
  9: "Você foi marcado 📸",
  10: "Nova mensagem 💌",
  11: "Check-in no duelo 💪",
  12: "Curtida na promoção ❤️",
  13: "Promoção expirada ⏳",
  14: "Check-in classificado ✅",
  15: "Check-in desclassificado ⛔",
  16: "Você foi marcado 📸",
  17: "Resposta ao seu flow 🎞️",
};

// Mesmos nomes exibidos no app (INCENTIVE_CONFIG / i18n)
const INCENTIVE_NAMES: Record<number, string> = {
  1: "Apoio",
  2: "Continua",
  3: "Vencedor",
  4: "Consegue Mais",
  5: "Limite Maior",
  6: "Mais Algum",
};

/** Encurta nomes livres (apelido, grupo, título) para o push não virar um parágrafo. */
function short(value: string, max = 40): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

/**
 * Monta o corpo do push com os dados reais da notificação: quem originou, em qual
 * grupo de duelo ou promoção. Sem isso todo push cai no texto genérico
 * ("Você tem uma nova notificação"), que não diz ao usuário o que aconteceu.
 *
 * `post_id` guarda o id do grupo de duelo nos tipos 4/5/11 e o id da promoção nos
 * tipos 8/12/13 — por isso os lookups dependem do tipo.
 */
async function buildBody(
  supabase: ReturnType<typeof createClient>,
  type: number,
  record: NotifRecord,
): Promise<string> {
  // Quem originou a notificação
  let name = "Alguém";
  if (record.follower_id) {
    const { data: sender } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", record.follower_id)
      .maybeSingle();
    if (sender?.nickname) name = short(String(sender.nickname), 24);
  }

  // Nome do grupo de duelo (tipos 4, 5 e 11)
  const groupName = async (): Promise<string | null> => {
    if (!record.post_id) return null;
    const { data } = await supabase
      .from("duel_groups")
      .select("name")
      .eq("id", record.post_id)
      .maybeSingle();
    return data?.name ? short(String(data.name)) : null;
  };

  // Título da promoção (tipos 8, 12 e 13)
  const promoTitle = async (): Promise<string | null> => {
    if (!record.post_id) return null;
    const { data } = await supabase
      .from("promotions")
      .select("title")
      .eq("id", record.post_id)
      .maybeSingle();
    return data?.title ? short(String(data.title)) : null;
  };

  // Onde a interação aconteceu (check-in de duelo / shot / flow / post)
  const context = record.duel_check_in_id || record.shots_id?.startsWith("checkin:")
    ? "no seu check-in"
    : record.shots_id
      ? "no seu shot"
      : record.flow_id
        ? "no seu flow"
        : "na sua publicação";

  switch (type) {
    case 1:
      return `${name} começou a te seguir.`;
    case 2: {
      const incentive = INCENTIVE_NAMES[Number(record.incentive_type ?? 0)];
      return incentive
        ? `${name} te deu "${incentive}" ${context}.`
        : `${name} reagiu ${context}.`;
    }
    case 3:
      return `${name} comentou ${context}.`;
    case 4: {
      const group = await groupName();
      return group
        ? `${name} te convidou para o duelo "${group}".`
        : `${name} te convidou para um duelo.`;
    }
    case 5: {
      const group = await groupName();
      return group
        ? `${name} quer entrar no grupo "${group}".`
        : `${name} quer entrar no seu grupo.`;
    }
    case 6:
      return `${name} reagiu ao seu comentário.`;
    case 7:
      return `${name} reagiu ao seu check-in.`;
    case 8: {
      const promo = await promoTitle();
      return promo
        ? `${name} comentou na sua promoção "${promo}".`
        : `${name} comentou na sua promoção.`;
    }
    case 9:
      return `${name} marcou você em uma publicação.`;
    case 10:
      return `${name} te enviou uma mensagem.`;
    case 11: {
      const group = await groupName();
      return group
        ? `${name} postou um check-in no duelo "${group}".`
        : `${name} postou um check-in no seu duelo.`;
    }
    case 12: {
      const promo = await promoTitle();
      return promo
        ? `${name} curtiu sua promoção "${promo}".`
        : `${name} curtiu sua promoção.`;
    }
    case 13: {
      const promo = await promoTitle();
      return promo
        ? `${name} marcou sua promoção "${promo}" como expirada.`
        : `${name} marcou sua promoção como expirada.`;
    }
    case 14:
      return `${name} classificou seu check-in no duelo.`;
    case 15:
      return `${name} desclassificou seu check-in no duelo.`;
    case 16:
      return `${name} marcou você em um flow.`;
    // Resposta privada a um flow: é uma mensagem direta como o tipo 10, mas o texto
    // diz de onde veio — sem isso o autor recebia "te enviou uma mensagem" e só
    // descobria o contexto abrindo a conversa.
    case 17:
      return `${name} respondeu ao seu flow.`;
    default:
      return "Você tem uma nova notificação no LinKa.";
  }
}

/**
 * Tela que o app abre quando o usuário toca no push.
 * O `post_id` guarda o id do grupo de duelo (tipo 11) ou da promoção (8, 12, 13).
 */
function deepLinkFor(type: number, record: NotifRecord): string {
  // Comentário (3), reações (6/7), check-in de membro do duelo (11) e avaliação
  // do check-in (14/15) abrem o próprio check-in — mesmo destino do card na
  // tela de Notificações.
  if (
    record.duel_check_in_id &&
    (type === 3 || type === 6 || type === 7 || type === 11 || type === 14 || type === 15)
  ) {
    return `/comunidade?checkin=${record.duel_check_in_id}`;
  }
  switch (type) {
    // 10 = mensagem privada, 17 = resposta a um flow. Nos dois o destino é a
    // conversa com quem enviou — a resposta ao flow VIVE no chat, não no flow.
    case 10:
    case 17:
      return record.follower_id ? `/comunidade?user=${record.follower_id}` : "/comunidade";
    case 11:
      return record.post_id ? `/comunidade?group=${record.post_id}` : "/comunidade?tab=duels";
    case 8:
    case 12:
    case 13:
      return "/vitrine";
    default:
      return "/notificacoes";
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/** Comparação em tempo constante — evita vazar o segredo por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  // Supabase DB Webhook sends a POST with the new row as JSON
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Só o Database Webhook (que carrega o segredo) pode disparar pushes.
  const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("PUSH_WEBHOOK_SECRET não configurado — recusando a requisição.");
    return new Response("Server misconfigured", { status: 500 });
  }
  if (!safeEqual(req.headers.get("x-webhook-secret") ?? "", webhookSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { record?: NotifRecord };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = body?.record ?? {};
  const userId = record.user_id;
  const notifType = Number(record.type ?? 0);

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

  const title = TITLE_BY_TYPE[notifType] ?? "Nova notificação 🔔";
  // Um lookup falho (perfil/grupo/promoção apagados) não pode derrubar o push
  const alertBody = await buildBody(supabase, notifType, record).catch((err) => {
    console.error("Error building push body:", err);
    return "Você tem uma nova notificação no LinKa.";
  });

  const apnsPayload = JSON.stringify({
    aps: {
      alert: { title, body: alertBody },
      sound: "default",
      badge: 1,
    },
    url: deepLinkFor(notifType, record),
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
