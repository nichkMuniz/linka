/**
 * Supabase Edge Function: purge-scheduled-deletions
 *
 * Executa as exclusões de conta cujo prazo de 30 dias venceu
 * (`docs/migrations/20261005-scheduled-account-deletion.sql`). Chamada 1x/dia
 * pelo pg_cron, com o header `x-cron-secret`.
 *
 * Para cada pedido vencido, NESTA ORDEM (a mesma de `scripts/delete-user.mjs`):
 *   0. Revoga o Sign in with Apple, se ainda houver token guardado (o app já
 *      revoga no pedido; isto cobre falha de rede naquele momento). Melhor
 *      esforço — a linha de `apple_auth_tokens` cai junto com a conta;
 *   1. Mídia pela API do Storage — nunca pelo SQL (apagar `storage.objects`
 *      deixa o arquivo físico no S3, lixo pago e invisível);
 *   2. `delete_user_data(uuid)` — linhas + `auth.users` numa transação;
 *   3. se o retorno não trouxer `auth.users`, `auth.admin.deleteUser`;
 *   4. pedido → `completed`, `user_id = null` (fica só motivo e datas).
 *
 * Um pedido que falhar continua `pending` e é tentado de novo no dia seguinte
 * (os três passos são idempotentes).
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (automáticos),
 * ACCOUNT_PURGE_CRON_SECRET (obrigatório) e os de Sign in with Apple
 * (`_shared/apple-signin.ts`; sem eles o passo 0 é pulado).
 *
 * Body opcional: `{ "dryRun": true }` — lista os vencidos e o tamanho da mídia
 * sem apagar nada.
 */

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { revokeStoredAppleToken } from "../_shared/apple-signin.ts";

const POSTS_BUCKET = "posts";
const CHAT_BUCKET = "chat-media";

/** Lista recursivamente (o `list` do Storage não recursa). */
async function listPaths(supabase: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const PAGE = 100;
  const found: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // `id: null` = prefixo (pasta), não objeto — desce nele.
      if (entry.id === null) found.push(...(await listPaths(supabase, bucket, full)));
      else found.push(full);
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return found;
}

/** Mesmas regras de `purgeUserStorageDb` (client/lib/ritmofit-db.ts). */
async function collectUserMedia(supabase: SupabaseClient, userId: string): Promise<Record<string, string[]>> {
  const paths: Record<string, string[]> = { [POSTS_BUCKET]: [], [CHAT_BUCKET]: [] };

  for (const prefix of [userId, `checkins/${userId}`, `workout-summary/${userId}`, `exercise-photos/${userId}`]) {
    paths[POSTS_BUCKET].push(...(await listPaths(supabase, POSTS_BUCKET, prefix)));
  }

  // `covers/` é comum a todos: o uid está no NOME do arquivo.
  const covers = await listPaths(supabase, POSTS_BUCKET, "covers");
  paths[POSTS_BUCKET].push(...covers.filter((p) => p.startsWith(`covers/${userId}-`)));

  // Conversas: pasta `{uidA}_{uidB}`.
  const { data: folders, error } = await supabase.storage.from(CHAT_BUCKET).list("", { limit: 1000 });
  if (error) throw new Error(`list ${CHAT_BUCKET}: ${error.message}`);
  for (const entry of folders ?? []) {
    if (entry.id !== null) continue;
    if (!String(entry.name).split("_").includes(userId)) continue;
    paths[CHAT_BUCKET].push(...(await listPaths(supabase, CHAT_BUCKET, String(entry.name))));
  }
  return paths;
}

async function purgeOne(supabase: SupabaseClient, requestId: number, userId: string): Promise<string> {
  // Conta já apagada por outro caminho (admin, script): só fecha o pedido.
  const { data: authUser, error: getErr } = await supabase.auth.admin.getUserById(userId);
  const exists = !getErr && !!authUser?.user;

  if (exists) {
    await revokeStoredAppleToken(supabase, userId).catch((err) => {
      console.error(`purge ${requestId}: revogar Apple:`, err instanceof Error ? err.message : err);
    });

    const media = await collectUserMedia(supabase, userId);
    for (const bucket of [POSTS_BUCKET, CHAT_BUCKET]) {
      for (let i = 0; i < media[bucket].length; i += 100) {
        const { error } = await supabase.storage.from(bucket).remove(media[bucket].slice(i, i + 100));
        if (error) throw new Error(`remove ${bucket}: ${error.message}`);
      }
    }

    const { data: removed, error: rpcErr } = await supabase.rpc("delete_user_data", { p_user_id: userId });
    if (rpcErr) throw new Error(`delete_user_data: ${rpcErr.message}`);

    const authRemoved = (removed as Record<string, number> | null)?.["auth.users"] ?? 0;
    if (authRemoved <= 0) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) throw new Error(`auth.admin.deleteUser: ${delErr.message}`);
    }
  }

  const { error: updErr } = await supabase
    .from("account_deletion_requests")
    .update({ status: "completed", completed_at: new Date().toISOString(), user_id: null })
    .eq("id", requestId);
  if (updErr) throw new Error(`fechar pedido: ${updErr.message}`);

  return exists ? "deleted" : "already_gone";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const cronSecret = Deno.env.get("ACCOUNT_PURGE_CRON_SECRET");
  if (!cronSecret) {
    console.error("ACCOUNT_PURGE_CRON_SECRET não configurado — recusando a requisição.");
    return new Response("Server misconfigured", { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: due, error } = await supabase.rpc("due_account_deletions", { p_limit: 25 });
  if (error) {
    console.error("due_account_deletions:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  const rows = (due ?? []) as Array<{ id: number; user_id: string; scheduled_for: string }>;

  if (dryRun) {
    const preview = [];
    for (const r of rows) {
      const media = await collectUserMedia(supabase, r.user_id).catch((e) => ({ error: String(e) }));
      preview.push({
        requestId: r.id,
        userId: r.user_id,
        scheduledFor: r.scheduled_for,
        media: "error" in media ? media.error : { posts: media[POSTS_BUCKET].length, chat: media[CHAT_BUCKET].length },
      });
    }
    return Response.json({ dryRun: true, due: preview });
  }

  // Um por vez: cada conta pode ter centenas de arquivos, e o Storage tem limite.
  const results = [];
  for (const r of rows) {
    try {
      results.push({ requestId: r.id, result: await purgeOne(supabase, r.id, r.user_id) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`purge ${r.id}:`, message);
      results.push({ requestId: r.id, error: message });
    }
  }
  return Response.json({ processed: results.length, results });
});
