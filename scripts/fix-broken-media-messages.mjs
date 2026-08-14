/**
 * fix-broken-media-messages.mjs
 *
 * Encontra mensagens de conversa privada cuja mídia **não existe mais** no
 * Storage e remove essas linhas.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  DRY-RUN POR PADRÃO. Sem `--apply` nada é apagado.                    │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 *   node scripts/fix-broken-media-messages.mjs           # relatório
 *   node scripts/fix-broken-media-messages.mjs --apply   # APAGA as linhas
 *
 * POR QUE APAGAR E NÃO CONSERTAR
 *
 *   Uma mensagem de áudio/imagem cujo arquivo sumiu não tem conteúdo
 *   recuperável: o texto é só o ponteiro (`[audio]:<url>`). Na tela ela vira um
 *   player quebrado que nunca vai tocar. Apagar a linha é a única correção
 *   possível — não há o que restaurar.
 *
 * COMO A MÍDIA É LOCALIZADA (ver protocolo em docs/07-comunidade.md)
 *
 *   A tabela `messages` NÃO tem coluna de mídia: o ponteiro mora dentro de
 *   `text`, atrás de um prefixo, em dois formatos que convivem:
 *
 *     [audio]:chat:{idA}_{idB}/{uuid}.webm   → bucket privado `chat-media`
 *     [audio]:https://…/public/posts/…       → bucket público `posts` (legado,
 *                                              anterior à 20260713)
 *
 *   `[post]:` e `[shot]:` carregam ID, não mídia — são ignorados.
 *
 * SEGURANÇA
 *
 *   - Só considera quebrada a mensagem cujo caminho foi resolvido com sucesso E
 *     não está na listagem do bucket. Ponteiro em formato desconhecido é
 *     ignorado (nunca apagado por não ter sido entendido).
 *   - Ignora mensagens com menos de MIN_AGE_HOURS, pelo mesmo motivo da
 *     varredura de órfãos: upload pode estar em curso.
 *   - Falha ao listar um bucket **aborta** — sem a listagem, tudo pareceria
 *     quebrado.
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

const APPLY = process.argv.includes("--apply");
const MIN_AGE_HOURS = 24;
const MARKER = "/storage/v1/object/public/";
const MEDIA_PREFIXES = ["[audio]:", "[image]:"];

/** Lista recursivamente todos os objetos de um bucket. */
async function listAll(bucket, prefix = "") {
  const PAGE = 100;
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listAll(bucket, full)));
      else out.push(full);
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Resolve o ponteiro de mídia de uma mensagem.
 * Devolve `{ bucket, path }`, ou null quando não há mídia reconhecível.
 */
function resolvePointer(text) {
  if (typeof text !== "string") return null;
  const prefix = MEDIA_PREFIXES.find((p) => text.startsWith(p));
  if (!prefix) return null;
  const value = text.slice(prefix.length).trim();

  // Formato novo: chat:<caminho dentro do bucket privado>
  if (value.startsWith("chat:")) {
    const path = value.slice("chat:".length).split("?")[0];
    return path ? { bucket: "chat-media", path: decodeURIComponent(path) } : null;
  }

  // Formato legado: URL pública completa
  const at = value.indexOf(MARKER);
  if (at === -1) return null;
  const rest = value.slice(at + MARKER.length).split("?")[0];
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const path = decodeURIComponent(rest.slice(slash + 1));
  return path ? { bucket: rest.slice(0, slash), path } : null;
}

async function main() {
  console.log("\nMensagens com mídia quebrada");
  console.log(APPLY ? "MODO: --apply (VAI APAGAR as linhas)\n" : "MODO: dry-run (não apaga nada)\n");

  console.log("1. Listando os buckets...");
  const buckets = {};
  for (const name of ["posts", "chat-media"]) {
    try {
      buckets[name] = new Set(await listAll(name));
      console.log(`  ${name.padEnd(12)} ${buckets[name].size} objetos`);
    } catch (err) {
      console.error(`\n✗ ABORTADO — não consegui listar o bucket ${name}: ${err.message}`);
      console.error("  Sem a listagem, toda mensagem pareceria quebrada.");
      process.exit(1);
    }
  }

  console.log("\n2. Lendo mensagens...");
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, text, user_id, following_id, created_at")
    .order("id");
  if (error) {
    console.error(`✗ ABORTADO — não consegui ler messages: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${messages.length} mensagens`);

  const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;
  const broken = [];
  let withMedia = 0;
  let unknownPointer = 0;
  let tooNew = 0;

  for (const msg of messages) {
    const pointer = resolvePointer(msg.text);
    if (!pointer) {
      if (MEDIA_PREFIXES.some((p) => String(msg.text ?? "").startsWith(p))) unknownPointer++;
      continue;
    }
    withMedia++;

    const known = buckets[pointer.bucket];
    // Bucket que nem listamos: não dá para afirmar que está quebrada.
    if (!known) {
      unknownPointer++;
      continue;
    }
    if (known.has(pointer.path)) continue;

    if (Date.parse(msg.created_at) > cutoff) {
      tooNew++;
      continue;
    }
    broken.push({ ...msg, pointer });
  }

  console.log("\n3. Resultado");
  console.log(`  mensagens com mídia:     ${withMedia}`);
  console.log(`  ponteiro não reconhecido: ${unknownPointer} (ignoradas por segurança)`);
  if (tooNew > 0) console.log(`  recentes (< ${MIN_AGE_HOURS}h), ignoradas: ${tooNew}`);
  console.log(`  QUEBRADAS:               ${broken.length}`);

  if (broken.length === 0) {
    console.log("\nNada a corrigir.\n");
    return;
  }

  console.log("");
  for (const b of broken) {
    console.log(
      `  #${String(b.id).padStart(4)}  ${String(b.created_at).slice(0, 16)}  ` +
        `${String(b.user_id).slice(0, 8)}→${String(b.following_id ?? "").slice(0, 8)}  ` +
        `${b.pointer.bucket}/${b.pointer.path}`,
    );
  }

  if (!APPLY) {
    console.log("\nNada foi apagado (dry-run). Rode com --apply para remover essas linhas.\n");
    return;
  }

  console.log(`\n4. Apagando ${broken.length} linhas...`);
  const ids = broken.map((b) => b.id);
  const { error: delError, count } = await supabase
    .from("messages")
    .delete({ count: "exact" })
    .in("id", ids);

  if (delError) {
    console.error(`  falhou: ${delError.message}`);
    process.exit(1);
  }
  console.log(`\nRemovidas ${count ?? ids.length} mensagens.\n`);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
