/**
 * delete-user.mjs
 *
 * Exclui UMA conta por inteiro, num comando só: mídia no Storage, todas as
 * linhas nas tabelas e o registro em `auth.users`.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  DRY-RUN POR PADRÃO. Sem `--apply` nada é apagado: o script só lista   │
 * │  o que apagaria.                                                      │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 *   node scripts/delete-user.mjs <uuid>            # relatório, não apaga
 *   node scripts/delete-user.mjs <uuid> --apply    # APAGA de verdade
 *
 * POR QUE EXISTE, se o app já faz isso sozinho:
 *   O app cobre o caminho do usuário ("Excluir minha conta"). Este script é o
 *   do admin — remoção a pedido de suporte, LGPD/GDPR, conta de teste. Pelo
 *   painel do Supabase seriam dois lugares diferentes (Storage e SQL Editor) e
 *   é fácil parar no meio, deixando a conta viva e vazia.
 *
 * A ORDEM É OBRIGATÓRIA e é a mesma do app:
 *   1. Storage  — precisa vir antes; ver abaixo.
 *   2. `delete_user_data(uuid)` — linhas + `auth.users` numa transação.
 *
 * Por que o Storage vem primeiro: apagar mídia exige a API do Storage (apagar
 * as linhas de `storage.objects` no SQL deixaria o arquivo físico no S3 —
 * lixo pago e invisível, que nem o `sweep-orphan-media.mjs` acha depois). E a
 * API precisa que a conta ainda exista para resolver os caminhos do usuário.
 *
 * Usa a service role key: ignora RLS de propósito, e é ela que dá à RPC o
 * direito de apagar dados de outra pessoa.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SUPABASE_SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Faltando VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const USER_ID = args.find((a) => !a.startsWith("--"));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!USER_ID || !UUID_RE.test(USER_ID)) {
  console.error("Uso: node scripts/delete-user.mjs <uuid> [--apply]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const POSTS_BUCKET = "posts";
const CHAT_BUCKET = "chat-media";

/** Lista recursivamente os caminhos de um prefixo (o `list` do Storage não recursa). */
async function listPaths(bucket, prefix) {
  const PAGE = 100;
  const found = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error) {
      // Falhar fechado: um prefixo ilegível não pode virar "não tem nada".
      throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // `id === null` marca pasta, não arquivo.
      if (entry.id === null) found.push(...(await listPaths(bucket, full)));
      else found.push(full);
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return found;
}

/** Mesmas regras de `purgeUserStorageDb` em client/lib/ritmofit-db.ts. */
async function collectUserMedia(userId) {
  const paths = { [POSTS_BUCKET]: [], [CHAT_BUCKET]: [] };

  // Pastas cujo caminho já isola o usuário.
  for (const prefix of [
    userId,
    `checkins/${userId}`,
    `workout-summary/${userId}`,
    `exercise-photos/${userId}`,
  ]) {
    paths[POSTS_BUCKET].push(...(await listPaths(POSTS_BUCKET, prefix)));
  }

  // `covers/` é comum a todo mundo: o uid está no NOME do arquivo.
  const covers = await listPaths(POSTS_BUCKET, "covers");
  paths[POSTS_BUCKET].push(...covers.filter((p) => p.startsWith(`covers/${userId}-`)));

  // Conversas privadas: a pasta é `{uidA}_{uidB}` (ordenados).
  const { data: folders, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .list("", { limit: 1000 });
  if (error) throw new Error(`list ${CHAT_BUCKET}: ${error.message}`);
  for (const entry of folders ?? []) {
    if (entry.id !== null) continue;
    if (!String(entry.name).split("_").includes(userId)) continue;
    paths[CHAT_BUCKET].push(...(await listPaths(CHAT_BUCKET, String(entry.name))));
  }

  return paths;
}

async function main() {
  console.log(`\nConta: ${USER_ID}`);
  console.log(APPLY ? "Modo: APLICAR (apaga de verdade)\n" : "Modo: dry-run (nada será apagado)\n");

  // ── 1. Storage ────────────────────────────────────────────────────────────
  const media = await collectUserMedia(USER_ID);
  const total = media[POSTS_BUCKET].length + media[CHAT_BUCKET].length;
  console.log(`Storage: ${media[POSTS_BUCKET].length} arquivo(s) em "${POSTS_BUCKET}", ${media[CHAT_BUCKET].length} em "${CHAT_BUCKET}"`);
  for (const p of [...media[POSTS_BUCKET], ...media[CHAT_BUCKET]].slice(0, 20)) {
    console.log(`   ${p}`);
  }
  if (total > 20) console.log(`   … e mais ${total - 20}`);

  if (APPLY) {
    for (const bucket of [POSTS_BUCKET, CHAT_BUCKET]) {
      // O `remove` tem teto por chamada; 100 por lote é folgado e seguro.
      for (let i = 0; i < media[bucket].length; i += 100) {
        const lote = media[bucket].slice(i, i + 100);
        const { error } = await supabase.storage.from(bucket).remove(lote);
        if (error) throw new Error(`remove ${bucket}: ${error.message}`);
      }
    }
    console.log(`   ✓ ${total} arquivo(s) apagado(s)\n`);
  } else {
    console.log("");
  }

  // ── 2. Linhas + auth.users ───────────────────────────────────────────────
  if (!APPLY) {
    console.log("Linhas: rode com --apply para executar delete_user_data().\n");
    console.log("Nada foi apagado. Repita com --apply para valer.\n");
    return;
  }

  const { data, error } = await supabase.rpc("delete_user_data", {
    p_user_id: USER_ID,
  });
  if (error) {
    console.error("\nFalha em delete_user_data:", error.message);
    console.error("A mídia JÁ foi apagada. Rode o comando de novo — a função é idempotente.");
    process.exit(1);
  }

  const rows = data ?? {};
  const entries = Object.entries(rows).filter(([k]) => k !== "auth.users");
  console.log(`Linhas: ${entries.length} tabela(s) afetada(s)`);
  for (const [k, v] of entries.sort()) console.log(`   ${k}: ${v}`);

  if (rows["auth.users"] > 0) {
    console.log("\n   ✓ auth.users encerrado\n");
  } else {
    // Acontece quando o dono da função não alcança o schema `auth` — ver o
    // cabeçalho de docs/migrations/20260915-delete-user-data.sql.
    console.log(
      "\n   ⚠ auth.users NÃO foi apagado (a função não tem privilégio no schema auth).",
    );
    console.log("     Apague pelo painel: Authentication → Users → Delete user.\n");
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
