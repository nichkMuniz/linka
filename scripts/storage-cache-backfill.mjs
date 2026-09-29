/**
 * storage-cache-backfill.mjs
 *
 * Regrava o `Cache-Control` dos arquivos que JÁ ESTÃO no Storage.
 *
 * Contexto (2026-09-29): nenhum upload do app definia `cacheControl`, então
 * tudo subiu com o padrão da Supabase (`max-age=3600`) — e as imagens do
 * catálogo de exercícios com `no-cache`. Passada 1 hora (ou sempre, no caso do
 * catálogo), o WebView pergunta ao servidor se cada imagem mudou antes de
 * mostrá-la: ~300–600ms por imagem ao abrir perfil, metas ou conversas. O app
 * passou a gravar o cabeçalho certo nos uploads NOVOS (`client/lib/storage-cache.ts`);
 * este script corrige o acervo antigo.
 *
 * O cabeçalho é gravado junto com o arquivo, e a API do Storage não tem
 * "atualizar só metadados" — por isso cada arquivo é BAIXADO e REENVIADO no
 * MESMO caminho (`upsert`), com os mesmos bytes e o mesmo content-type. As URLs
 * não mudam; nada no banco precisa ser tocado.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  DRY-RUN POR PADRÃO. Sem `--apply` nada é reenviado: o script só conta │
 * │  quantos arquivos e quantos bytes seriam regravados.                  │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 *   node scripts/storage-cache-backfill.mjs                          # relatório dos 3 buckets
 *   node scripts/storage-cache-backfill.mjs --bucket=exercises       # só um bucket
 *   node scripts/storage-cache-backfill.mjs --bucket=posts --only=workout-summary
 *   node scripts/storage-cache-backfill.mjs --bucket=posts --apply   # regrava de verdade
 *
 * Recomendado: rodar por partes (`--bucket` / `--only`), conferindo o app entre
 * uma e outra. Pode ser interrompido e rodado de novo — o que já está com o
 * cabeçalho certo é pulado.
 *
 * O que NÃO é tocado:
 *   - pastas `stories/` do bucket `posts` — flows vivem 24h e já sobem com
 *     `max-age=86400`.
 *   - buckets privados (mídia do chat): servidos por URL assinada que muda a
 *     cada hora, então o cache por URL não se aproveita de qualquer forma.
 *
 * Usa a service role key (ignora RLS): precisa regravar arquivos de todos os
 * usuários.
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Cabeçalho alvo por bucket, em segundos (o mesmo formato do `cacheControl`
// do upload). `posts`/`promotions`: arquivos imutáveis (nome com timestamp ou
// UUID) → 1 ano. `exercises`: caminho fixo sobrescrito pelos scripts do
// catálogo → 7 dias (ver CATALOG_CACHE_CONTROL nos scripts de upload).
const TARGETS = {
  posts: "31536000",
  promotions: "31536000",
  exercises: "604800",
};

const APPLY = process.argv.includes("--apply");
const BUCKET_ARG = process.argv.find((a) => a.startsWith("--bucket="));
const ONLY_BUCKET = BUCKET_ARG ? BUCKET_ARG.slice("--bucket=".length) : null;
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY_PREFIX = ONLY_ARG ? ONLY_ARG.slice("--only=".length).replace(/\/$/, "") : "";
// Uploads em paralelo — baixo de propósito, para não disputar banda/limite
// com o app em produção.
const CONCURRENCY = 4;

if (ONLY_BUCKET && !TARGETS[ONLY_BUCKET]) {
  console.error(`Bucket desconhecido: ${ONLY_BUCKET}. Use um de: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

async function listAllObjects(bucket, prefix = "") {
  const PAGE = 100;
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list(${bucket}/${prefix}): ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        out.push(...(await listAllObjects(bucket, full)));
      } else {
        out.push({
          path: full,
          size: entry.metadata?.size ?? 0,
          mimetype: entry.metadata?.mimetype ?? null,
          cacheControl: entry.metadata?.cacheControl ?? null,
        });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/** "max-age=31536000" (formato do metadata) → "31536000". */
function maxAgeOf(cacheControl) {
  const m = /max-age=(\d+)/.exec(String(cacheControl ?? ""));
  return m ? m[1] : null;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

async function rewrite(bucket, obj, target) {
  const { data: blob, error: dlError } = await supabase.storage.from(bucket).download(obj.path);
  if (dlError || !blob) throw new Error(`download: ${dlError?.message ?? "vazio"}`);
  const { error: upError } = await supabase.storage.from(bucket).upload(obj.path, blob, {
    upsert: true,
    cacheControl: target,
    contentType: obj.mimetype || blob.type || undefined,
  });
  if (upError) throw new Error(`upload: ${upError.message}`);
}

async function runBucket(bucket) {
  const target = TARGETS[bucket];
  console.log(`\n── bucket "${bucket}" → max-age=${target}${ONLY_PREFIX ? ` (só "${ONLY_PREFIX}/")` : ""}`);
  const all = await listAllObjects(bucket, ONLY_PREFIX);
  const todo = all.filter(
    (o) => !/(^|\/)stories\//.test(o.path) && maxAgeOf(o.cacheControl) !== target,
  );
  const bytes = todo.reduce((acc, o) => acc + o.size, 0);
  console.log(`   ${all.length} arquivos, ${todo.length} a regravar (${formatBytes(bytes)})`);
  if (!APPLY || todo.length === 0) return { done: 0, failed: 0 };

  let done = 0;
  let failed = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const obj = todo[cursor++];
      try {
        await rewrite(bucket, obj, target);
        done++;
      } catch (err) {
        failed++;
        console.error(`   ✗ ${obj.path}: ${err.message}`);
      }
      if ((done + failed) % 50 === 0) console.log(`   … ${done + failed}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`   ✓ ${done} regravados, ${failed} falharam`);
  return { done, failed };
}

async function main() {
  console.log(`\nRegravação de Cache-Control — ${APPLY ? "MODO: --apply (VAI REENVIAR)" : "MODO: dry-run (não altera nada)"}`);
  const buckets = ONLY_BUCKET ? [ONLY_BUCKET] : Object.keys(TARGETS);
  let failed = 0;
  for (const bucket of buckets) failed += (await runBucket(bucket)).failed;
  if (!APPLY) console.log("\nNada foi alterado. Rode com --apply para regravar.");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
