/**
 * Supabase Edge Function: reengagement-push
 *
 * Lembretes de VOLTA AO APP (retenção). Diferente de `send-push-notification`
 * (que reage a eventos via webhook), esta função é AGENDADA (pg_cron, 1x/dia,
 * 19:00 de Brasília) e decide quem merece UM lembrete hoje:
 *
 *   1. Sequência em risco — treinou ontem, ainda não hoje, sequência ≥ 3 dias.
 *   2. Novidades de quem você segue — não abriu o app hoje e há posts novos de
 *      quem a pessoa segue desde a última abertura (ou o último lembrete).
 *   3. Saudade — sem abrir o app há 1, 3, 7, 14 ou 30 dias, sem posts novos.
 *
 * Regras anti-spam (o lembrete em excesso vira desinstalação):
 *   - no máximo 1 lembrete por pessoa por dia (`last_reengagement_at`);
 *   - quem sumiu só recebe nos dias 1, 2, 3, 5, 7, 14 e 30 — depois do 30º,
 *     nada (nos dias 2 e 5 só se houver post novo de amigo);
 *   - o mesmo post nunca motiva dois lembretes (a contagem começa no último);
 *   - quem desligou "Lembretes e novidades" em Configurações não entra.
 *
 * Envia APNs direto (não insere em `notifications`): é um lembrete efêmero —
 * não vira card na tela de Notificações nem mexe no badge.
 *
 * Idioma: `user_activity.app_language` (o app grava o idioma do aparelho).
 * Datas de "hoje/ontem" em America/Sao_Paulo (público majoritariamente BR).
 *
 * Teste sem enviar: POST com body `{"dryRun": true}` devolve as decisões.
 * Teste com UMA pessoa: `{"onlyUserId": "<uuid>"}` — as mesmas regras, mas só
 * esse usuário é avaliado (combina com `dryRun`). Sem isso, uma chamada manual
 * envia para todo mundo que se qualifica no dia.
 *
 * Env (Supabase → Edge Functions → Secrets): SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID,
 * APNS_BUNDLE_ID e REENGAGEMENT_CRON_SECRET (obrigatório).
 *
 * Requer a migração `docs/migrations/20261002-reengagement-activity.sql`.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { logDeliveries, sendApns } from "../_shared/apns.ts";

// ─── Datas em America/Sao_Paulo ──────────────────────────────────────────────

const SP_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD em São Paulo (en-CA formata assim). */
function ymdInSaoPaulo(date: Date): string {
  return SP_DATE.format(date);
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

// ─── Regras ──────────────────────────────────────────────────────────────────

/** Dias sem abrir o app em que um lembrete PODE sair. Depois do 30º, nada. */
const SEND_DAYS = new Set([1, 2, 3, 5, 7, 14, 30]);
/** Dias em que sai o lembrete de saudade mesmo sem post novo de amigo. */
const MILESTONE_DAYS = new Set([1, 3, 7, 14, 30]);
/** Ids por consulta `.in()` (limite prático de URL do PostgREST). */
const ID_BATCH = 200;

type Lang = "pt" | "en";
type Kind = "streak" | "social" | `inactive_${number}`;
type Nudge = { kind: Kind; title: string; body: string; url: string };

// ─── Textos (PT/EN) ──────────────────────────────────────────────────────────

function streakNudge(lang: Lang, streak: number): Nudge {
  return lang === "en"
    ? {
        kind: "streak",
        title: "🔥 Your streak is at risk!",
        body: `${streak} days in a row. Check in today so it doesn't reset.`,
        url: "/metas",
      }
    : {
        kind: "streak",
        title: "🔥 Sua sequência está em risco!",
        body: `Você está há ${streak} dias seguidos. Faça seu check-in de hoje para não zerar.`,
        url: "/metas",
      };
}

function socialNudge(lang: Lang, authors: string[], count: number): Nudge {
  const first = authors[0];
  const others = authors.length - 1;
  const url = "/?feed=following";
  if (lang === "en") {
    if (!first) {
      return { kind: "social", title: "New posts in your feed 📸", body: `${count} new posts from people you follow.`, url };
    }
    return others <= 0
      ? {
          kind: "social",
          title: `${first} posted something new 📸`,
          body: count > 1 ? `${count} new posts waiting for you. Come take a look!` : "Come see what they shared.",
          url,
        }
      : {
          kind: "social",
          title: `${first} and ${others} ${others === 1 ? "other" : "others"} posted 📸`,
          body: "Your feed is full of new workouts. Come take a look!",
          url,
        };
  }
  if (!first) {
    return { kind: "social", title: "Novidades no seu feed 📸", body: `${count} posts novos de quem você segue.`, url };
  }
  return others <= 0
    ? {
        kind: "social",
        title: `${first} postou algo novo 📸`,
        body: count > 1 ? `São ${count} posts novos te esperando. Bora ver?` : "Vem ver o que rolou no seu feed.",
        url,
      }
    : {
        kind: "social",
        title: `${first} e mais ${others} ${others === 1 ? "pessoa postaram" : "pessoas postaram"} 📸`,
        body: "Seu feed está cheio de treino novo. Bora ver?",
        url,
      };
}

function inactivityNudge(lang: Lang, days: number): Nudge {
  const kind = `inactive_${days}` as Kind;
  const pt: Record<number, [string, string]> = {
    1: ["Seu treino de hoje te espera 💪", "Passa no LinKa e veja as novidades de quem você segue."],
    3: ["Sentimos sua falta 💪", "Faz 3 dias que você não aparece. Que tal voltar hoje?"],
    7: ["Uma semana sem você por aqui 👀", "A galera continua treinando. Volta e retoma o ritmo!"],
    14: ["Bora recomeçar? 🔄", "Duas semanas passam rápido. Um treino hoje já muda tudo."],
    30: ["A porta continua aberta 🚪", "Seu progresso está salvo no LinKa. Quando quiser, é só voltar."],
  };
  const en: Record<number, [string, string]> = {
    1: ["Today's workout is waiting 💪", "Stop by LinKa and see what the people you follow are up to."],
    3: ["We miss you 💪", "It's been 3 days. How about coming back today?"],
    7: ["A week without you 👀", "Everyone's still training. Come back and get your rhythm back!"],
    14: ["Ready to restart? 🔄", "Two weeks go by fast. One workout today changes everything."],
    30: ["The door is still open 🚪", "Your progress is saved on LinKa. Come back whenever you want."],
  };
  const [title, body] = (lang === "en" ? en : pt)[days];
  return { kind, title, body, url: "/" };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

type Candidate = {
  user_id: string;
  last_active_at: string;
  app_language: string;
  last_reengagement_at: string | null;
  new_posts_count: number;
  new_post_authors: string[] | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Proteção contra chamadas externas: só o pg_cron (que envia o header
  // x-cron-secret) pode disparar a leva de pushes. O segredo é OBRIGATÓRIO —
  // sem ele, qualquer um na internet dispararia push para toda a base.
  const cronSecret = Deno.env.get("REENGAGEMENT_CRON_SECRET");
  if (!cronSecret) {
    console.error("REENGAGEMENT_CRON_SECRET não configurado — recusando a requisição.");
    return new Response("Server misconfigured", { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const onlyUserId = typeof body?.onlyUserId === "string" ? body.onlyUserId : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const today = ymdInSaoPaulo(now);
  const yesterday = ymdInSaoPaulo(new Date(now.getTime() - 86400000));
  const since = ymdInSaoPaulo(new Date(now.getTime() - 32 * 86400000));

  // 1. Candidatos: push iOS + lembretes ligados + não banido (a RPC filtra).
  const { data: candRows, error: candErr } = await supabase.rpc("get_reengagement_candidates");
  if (candErr) return new Response(`candidates error: ${candErr.message}`, { status: 500 });
  const candidates = ((candRows ?? []) as Candidate[])
    .filter((c) => !onlyUserId || c.user_id === onlyUserId);
  if (candidates.length === 0) {
    return Response.json({ sent: 0, reason: "no candidates" });
  }
  const userIds = candidates.map((c) => c.user_id);

  // 2. Tokens e check-ins recentes só dos candidatos — em lotes: um `.in()`
  // com milhares de ids vira uma URL longa demais para o PostgREST.
  const tokenRows: { user_id: string; token: string }[] = [];
  const ciRows: { user_id: string; check_in_date: string }[] = [];
  for (let i = 0; i < userIds.length; i += ID_BATCH) {
    const batch = userIds.slice(i, i + ID_BATCH);
    const [tok, ci] = await Promise.all([
      supabase.from("push_tokens").select("user_id, token").eq("platform", "ios").in("user_id", batch),
      supabase.from("check_ins").select("user_id, check_in_date").in("user_id", batch).gte("check_in_date", since),
    ]);
    if (tok.error) return new Response(`token query error: ${tok.error.message}`, { status: 500 });
    if (ci.error) return new Response(`checkin query error: ${ci.error.message}`, { status: 500 });
    tokenRows.push(...(tok.data ?? []));
    ciRows.push(...(ci.data ?? []));
  }

  const tokensByUser = new Map<string, string[]>();
  for (const r of tokenRows) {
    const arr = tokensByUser.get(r.user_id) ?? [];
    arr.push(r.token);
    tokensByUser.set(r.user_id, arr);
  }
  const datesByUser = new Map<string, string[]>();
  for (const r of ciRows) {
    const arr = datesByUser.get(r.user_id) ?? [];
    arr.push(String(r.check_in_date));
    datesByUser.set(r.user_id, arr);
  }

  // 3. Um lembrete (no máximo) por pessoa.
  const targets: { userId: string; lastActiveAt: string; nudge: Nudge }[] = [];
  for (const c of candidates) {
    if (!tokensByUser.has(c.user_id)) continue;
    // Limite de 1 por dia — protege também de uma 2ª execução manual.
    if (c.last_reengagement_at && ymdInSaoPaulo(new Date(c.last_reengagement_at)) === today) continue;

    const lang: Lang = c.app_language === "en" ? "en" : "pt";
    const daysInactive = daysBetween(today, ymdInSaoPaulo(new Date(c.last_active_at)));

    // a) Sequência em risco — vale mesmo para quem abriu o app hoje.
    const dates = [...new Set(datesByUser.get(c.user_id) ?? [])].sort().reverse();
    if (dates[0] === yesterday) {
      const streak = computeStreak(dates);
      if (streak >= 3) {
        targets.push({ userId: c.user_id, lastActiveAt: c.last_active_at, nudge: streakNudge(lang, streak) });
        continue;
      }
    }

    // Quem abriu o app hoje não precisa de lembrete; quem sumiu há mais de 30
    // dias (ou fora dos dias da escala) também não recebe.
    if (daysInactive < 1 || !SEND_DAYS.has(daysInactive)) continue;

    // b) Novidades de quem a pessoa segue.
    if (c.new_posts_count > 0) {
      const authors = [...new Set(c.new_post_authors ?? [])];
      targets.push({
        userId: c.user_id,
        lastActiveAt: c.last_active_at,
        nudge: socialNudge(lang, authors, c.new_posts_count),
      });
      continue;
    }

    // c) Saudade — só nos marcos.
    if (MILESTONE_DAYS.has(daysInactive)) {
      targets.push({ userId: c.user_id, lastActiveAt: c.last_active_at, nudge: inactivityNudge(lang, daysInactive) });
    }
  }

  if (dryRun) {
    return Response.json({
      dryRun: true,
      evaluated: candidates.length,
      targets: targets.map((tg) => ({ userId: tg.userId, kind: tg.nudge.kind, title: tg.nudge.title, body: tg.nudge.body })),
    });
  }
  if (targets.length === 0) {
    return Response.json({ sent: 0, evaluated: candidates.length });
  }

  // 4. Envia APNs (JWT compartilhado e reaproveitado — ver _shared/apns.ts).
  let sent = 0;
  const delivered = new Set<string>();

  await Promise.all(
    targets.map(async ({ userId, nudge }) => {
      const payload = JSON.stringify({
        // Sem `badge`: o lembrete não é uma notificação não lida, e fixar 1
        // apagaria a contagem real do ícone.
        aps: {
          alert: { title: nudge.title, body: nudge.body },
          sound: "default",
          "thread-id": "reengagement",
        },
        url: nudge.url,
      });
      // 5 = entrega quando for conveniente para o aparelho (lembrete não é
      // urgente; a Apple recomenda 5 para esse tipo).
      const results = await sendApns(supabase, tokensByUser.get(userId) ?? [], payload, "5");
      const ok = results.filter((r) => r.status === 200).length;
      sent += ok;
      if (ok > 0) delivered.add(userId);
      await logDeliveries(supabase, { source: `reengagement:${nudge.kind}`, userId, type: 0 }, results);
    }),
  );

  // 5. Registra o envio (limite diário + "o mesmo post não motiva dois lembretes").
  if (delivered.size > 0) {
    const rows = targets
      .filter((tg) => delivered.has(tg.userId))
      .map((tg) => ({ user_id: tg.userId, kind: tg.nudge.kind, last_active_at: tg.lastActiveAt }));
    const { error: markErr } = await supabase.rpc("mark_reengagement_sent", { p_rows: rows });
    if (markErr) console.error("mark_reengagement_sent:", markErr.message);
  }

  const byKind: Record<string, number> = {};
  for (const tg of targets) byKind[tg.nudge.kind] = (byKind[tg.nudge.kind] ?? 0) + 1;

  return Response.json({ sent, users: delivered.size, targets: targets.length, evaluated: candidates.length, byKind });
});
