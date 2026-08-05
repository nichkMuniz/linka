/**
 * upload-lote-images.mjs
 *
 * Sobe as imagens de um lote (ai-exercise-images/<lote>/) para o Storage do
 * Supabase e aponta `workouts.photo`. Guiado pelo manifest.csv do lote:
 *   arquivo,exercicio,grupo,workout_id,status
 *
 * Para cada linha com `status = ok` e `workout_id` preenchido:
 *   1. lê ai-exercise-images/<lote>/<arquivo>.(png|jpg|jpeg|webp)
 *   2. achata em FUNDO BRANCO + redimensiona 1024×1024 + JPEG (evita o bug de
 *      PNG transparente virar imagem preta no app)
 *   3. upload em exercises/manual/<workout_id>.jpg (upsert)
 *   4. UPDATE workouts.photo = URL pública
 *
 * Idempotente: reprocessa e sobrescreve (upsert). Seguro re-rodar.
 *
 *   node scripts/upload-lote-images.mjs lote3
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const lote = process.argv[2];
if (!lote) {
  console.error("Uso: node scripts/upload-lote-images.mjs <lote>  (ex.: lote3)");
  process.exit(1);
}

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET = "exercises";
const EXTS = ["png", "jpg", "jpeg", "webp"];

const loteDir = resolve(__dirname, "../ai-exercise-images", lote);
const manifestPath = resolve(loteDir, "manifest.csv");
if (!existsSync(manifestPath)) {
  console.error(`manifest não encontrado: ${manifestPath}`);
  process.exit(1);
}

// Parse tolerante a vírgula no meio (exercicio): arquivo é o 1º campo,
// status é o último, workout_id é o penúltimo.
const lines = readFileSync(manifestPath, "utf-8").split(/\r?\n/).filter(Boolean);
const rows = lines
  .slice(1) // pula o header
  .map((line) => {
    const f = line.split(",");
    return { arquivo: f[0]?.trim(), workout_id: f[f.length - 2]?.trim(), status: f[f.length - 1]?.trim() };
  })
  .filter((r) => r.arquivo);

let ok = 0, skipped = 0, failed = 0;
for (const r of rows) {
  if (r.status !== "ok") { console.log(`· pula ${r.arquivo} (status=${r.status || "vazio"})`); skipped++; continue; }
  if (!r.workout_id) { console.log(`· pula ${r.arquivo} (sem workout_id)`); skipped++; continue; }

  const file = EXTS.map((e) => resolve(loteDir, `${r.arquivo}.${e}`)).find(existsSync);
  if (!file) { console.error(`✗ ${r.arquivo}: arquivo de imagem não encontrado`); failed++; continue; }

  try {
    const jpg = await sharp(readFileSync(file))
      .flatten({ background: "#ffffff" }) // achata transparência em branco
      .resize(1024, 1024, { fit: "cover" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const path = `manual/${r.workout_id}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, jpg, { upsert: true, contentType: "image/jpeg" });
    if (up.error) throw up.error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const upd = await supabase.from("workouts").update({ photo: publicUrl }).eq("id", r.workout_id);
    if (upd.error) throw upd.error;

    console.log(`✓ ${r.arquivo} -> ${path}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${r.arquivo}: ${e.message || e}`);
    failed++;
  }
}

console.log(`\nfeito: ${ok} enviadas, ${skipped} puladas, ${failed} falhas`);
process.exit(failed > 0 ? 1 : 0);
