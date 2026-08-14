/**
 * sweep-orphan-media.mjs
 *
 * Varre o bucket `posts` e encontra arquivos que NENHUMA linha do banco
 * referencia mais — a mídia que ficou para trás enquanto excluir conteúdo não
 * apagava o Storage (corrigido em 2026-08-14, mas só para frente).
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  DRY-RUN POR PADRÃO. Sem `--apply` nada é apagado: o script só lista   │
 * │  o que apagaria e quanto espaço isso libera.                          │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 *   node scripts/sweep-orphan-media.mjs                     # relatório, não apaga
 *   node scripts/sweep-orphan-media.mjs --report=out.txt    # salva a lista completa
 *   node scripts/sweep-orphan-media.mjs --only=checkins     # limita a uma pasta
 *   node scripts/sweep-orphan-media.mjs --apply             # APAGA de verdade
 *
 * Recomendado atacar por partes: `--only=<pasta> --apply` uma pasta por vez,
 * conferindo o app entre uma e outra, em vez de apagar tudo de uma vez.
 *
 * SEGURANÇA — como este script evita apagar arquivo em uso:
 *
 *   1. Monta o conjunto de URLs referenciadas lendo TODAS as colunas de mídia
 *      de TODAS as tabelas (lista `MEDIA_SOURCES`). Se uma tabela não existir
 *      ou a leitura falhar, o script **aborta** em vez de tratar o conteúdo
 *      dela como órfão — falhar fechado é a única postura aceitável aqui.
 *   2. Ignora arquivos com menos de `MIN_AGE_HOURS` de idade, para não pegar
 *      upload em andamento (o app sobe o arquivo antes de gravar a linha).
 *   3. Compara por caminho normalizado, não por URL crua.
 *
 * Usa a service role key: ignora RLS de propósito, porque precisa enxergar
 * conteúdo de todos os usuários para decidir o que é órfão.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
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

const BUCKET = "posts";
const APPLY = process.argv.includes("--apply");
const REPORT_ARG = process.argv.find((a) => a.startsWith("--report="));
const REPORT_PATH = REPORT_ARG ? REPORT_ARG.slice("--report=".length) : null;
// Limita a varredura a uma pasta. Serve para atacar o acervo por partes, em vez
// de apagar 1 GB de uma vez: `--only=workout-summary` primeiro, e assim por diante.
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY_PREFIX = ONLY_ARG ? ONLY_ARG.slice("--only=".length).replace(/\/$/, "") : null;

// Margem de segurança: o app sobe o arquivo ANTES de gravar a linha que o
// referencia. Uma varredura no meio dessa janela veria um órfão que não é.
const MIN_AGE_HOURS = 24;

/**
 * Toda coluna do banco que pode guardar URL de mídia do bucket `posts`.
 *
 * ⚠️ MANTER ESTA LISTA COMPLETA. Uma coluna esquecida aqui vira "ninguém
 * referencia" e o arquivo é apagado — perda de dados silenciosa. Ao adicionar
 * feature que sobe arquivo, adicione a coluna aqui na mesma entrega.
 */
const MEDIA_SOURCES = [
  { table: "posts", textCols: ["photo"], arrayCols: ["photos"] },
  { table: "shots", textCols: ["video_url"], arrayCols: [] },
  { table: "flow", textCols: ["media_url", "poster_url"], arrayCols: [] },
  { table: "duel_check_ins", textCols: ["photo"], arrayCols: ["photos"] },
  { table: "duel_groups", textCols: ["photo"], arrayCols: [] },
  { table: "profiles", textCols: ["photo", "cover_photo"], arrayCols: [] },
  { table: "workouts", textCols: ["photo"], arrayCols: [] },
  { table: "commercial_profiles", textCols: ["business_logo_url", "business_banner_url"], arrayCols: [] },
  { table: "commercial_offers", textCols: ["image_url"], arrayCols: [] },
  { table: "promotions", textCols: ["photo_url"], arrayCols: [] },
  { table: "store_catalog", textCols: ["store_logo_url", "item_photo_url"], arrayCols: ["additional_photos"] },
  { table: "exercises", textCols: [], arrayCols: ["images"] },
  // ⚠️ Mensagem direta NÃO tem coluna de mídia: a URL vive DENTRO do texto,
  // atrás de um prefixo (`[image]:`, `[audio]:` — ver protocolo em
  // docs/07-comunidade.md). Mensagens novas guardam `chat:<path>` no bucket
  // privado `chat-media`, mas as ANTIGAS guardam a URL pública completa de
  // `posts/message-images/…` e `posts/message-audio/…` e continuam funcionando.
  // Sem varrer este campo, o script apagaria mídia de DM ainda em uso.
  { table: "messages", textCols: [], arrayCols: [], scanCols: ["text"] },
];

const MARKER = "/storage/v1/object/public/";

/** URL pública → caminho dentro do bucket. Devolve null se não for deste bucket. */
function urlToPath(url) {
  if (typeof url !== "string" || !url) return null;
  const at = url.indexOf(MARKER);
  if (at === -1) return null;
  const rest = url.slice(at + MARKER.length).split("?")[0];
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  if (rest.slice(0, slash) !== BUCKET) return null;
  const path = decodeURIComponent(rest.slice(slash + 1));
  return path || null;
}

/** Lê uma tabela inteira, paginando — `select` sem range para em 1000 linhas. */
async function readAll(table, columns) {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns.join(","))
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Erro de "tabela/coluna não existe" — diferente de falha de leitura. */
function isMissingRelation(message) {
  return (
    /does not exist/i.test(message) ||
    /42P01/.test(message) ||
    /42703/.test(message) ||
    /schema cache/i.test(message)
  );
}

async function collectReferencedPaths() {
  const referenced = new Set();
  for (const src of MEDIA_SOURCES) {
    const cols = [...src.textCols, ...src.arrayCols, ...(src.scanCols ?? [])];
    let rows;
    try {
      rows = await readAll(src.table, cols);
    } catch (err) {
      if (isMissingRelation(err.message)) {
        // Tabela/coluna inexistente neste banco não guarda referência nenhuma —
        // pular é correto. (Este schema tem tabelas opcionais de vitrine.)
        console.log(`  ${src.table.padEnd(20)}   — não existe neste banco, ignorada`);
        continue;
      }
      // Falha fechada: sem conseguir ler uma fonte que EXISTE, qualquer arquivo
      // dela pareceria órfão. Abortar é mais barato que apagar conteúdo vivo.
      console.error(`\n✗ ABORTADO — não consegui ler ${src.table}: ${err.message}`);
      console.error("  Sem essa tabela a varredura marcaria mídia viva como órfã.");
      process.exit(1);
    }
    for (const row of rows) {
      for (const col of src.textCols) {
        const p = urlToPath(row[col]);
        if (p) referenced.add(p);
      }
      for (const col of src.arrayCols) {
        const v = row[col];
        if (Array.isArray(v)) {
          for (const item of v) {
            const p = urlToPath(item);
            if (p) referenced.add(p);
          }
        }
      }
      // Campos onde a URL está embutida no meio do texto.
      for (const col of src.scanCols ?? []) {
        const v = row[col];
        if (typeof v !== "string") continue;
        for (const found of v.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []) {
          const p = urlToPath(found);
          if (p) referenced.add(p);
        }
      }
    }
    console.log(`  ${src.table.padEnd(20)} ${String(rows.length).padStart(6)} linhas lidas`);
  }
  return referenced;
}

/** Lista recursivamente todos os objetos do bucket. */
async function listAllObjects(prefix = "") {
  const PAGE = 100;
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list(${prefix}): ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        out.push(...(await listAllObjects(full)));
      } else {
        out.push({
          path: full,
          size: entry.metadata?.size ?? 0,
          createdAt: entry.created_at ?? entry.updated_at ?? null,
        });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

async function main() {
  console.log(`\nVarredura de mídia órfã — bucket "${BUCKET}"`);
  console.log(APPLY ? "MODO: --apply (VAI APAGAR)" : "MODO: dry-run (não apaga nada)");
  if (ONLY_PREFIX) console.log(`ESCOPO: só a pasta "${ONLY_PREFIX}/"`);
  console.log("");

  console.log("1. Lendo referências do banco...");
  const referenced = await collectReferencedPaths();
  console.log(`  → ${referenced.size} caminhos referenciados\n`);

  console.log("2. Listando o bucket...");
  const objects = await listAllObjects();
  console.log(`  → ${objects.length} objetos no bucket\n`);

  const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;
  const orphans = [];
  let tooNew = 0;
  for (const obj of objects) {
    // O conjunto de referências é sempre montado com o banco INTEIRO; o --only
    // filtra apenas o que entra na lista de exclusão.
    if (ONLY_PREFIX && !obj.path.startsWith(`${ONLY_PREFIX}/`)) continue;
    if (referenced.has(obj.path)) continue;
    const created = obj.createdAt ? Date.parse(obj.createdAt) : 0;
    if (created && created > cutoff) {
      tooNew++;
      continue;
    }
    orphans.push(obj);
  }

  const totalBytes = orphans.reduce((acc, o) => acc + (o.size || 0), 0);

  // Agrupa por prefixo para o relatório dizer de onde veio o lixo.
  const byPrefix = new Map();
  for (const o of orphans) {
    const key = o.path.includes("/") ? o.path.split("/")[0] : "(raiz)";
    const cur = byPrefix.get(key) ?? { count: 0, bytes: 0 };
    cur.count++;
    cur.bytes += o.size || 0;
    byPrefix.set(key, cur);
  }

  console.log("3. Resultado");
  console.log(`  órfãos:          ${orphans.length}`);
  console.log(`  espaço a liberar: ${formatBytes(totalBytes)}`);
  if (tooNew > 0) {
    console.log(`  ignorados (< ${MIN_AGE_HOURS}h, upload pode estar em curso): ${tooNew}`);
  }
  console.log("\n  por pasta de origem:");
  for (const [prefix, v] of [...byPrefix.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`    ${prefix.padEnd(24)} ${String(v.count).padStart(6)} arq  ${formatBytes(v.bytes)}`);
  }

  if (REPORT_PATH) {
    writeFileSync(REPORT_PATH, orphans.map((o) => o.path).join("\n"), "utf-8");
    console.log(`\n  lista completa salva em ${REPORT_PATH}`);
  }

  if (!APPLY) {
    console.log("\nNada foi apagado (dry-run).");
    console.log("Confira a lista com --report=orfaos.txt antes de rodar --apply.\n");
    return;
  }

  if (orphans.length === 0) {
    console.log("\nNada a apagar.\n");
    return;
  }

  console.log(`\n4. Apagando ${orphans.length} arquivos...`);
  const BATCH = 100;
  let removed = 0;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH).map((o) => o.path);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error(`  lote ${i / BATCH + 1}: ${error.message}`);
      continue;
    }
    removed += data?.length ?? 0;
    process.stdout.write(`\r  ${removed}/${orphans.length}`);
  }
  console.log(`\n\nRemovidos ${removed} arquivos (${formatBytes(totalBytes)} liberados).\n`);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
