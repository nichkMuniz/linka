/**
 * upload-exercise-image.mjs
 *
 * Sobe a imagem de UM exercício e aponta `workouts.photo` — o par do botão
 * "copiar comando de upload" da aba Imagens do painel admin. Mesmo tratamento
 * do upload-lote-images.mjs:
 *   1. achata em FUNDO BRANCO + 1024×1024 + JPEG (PNG transparente vira preto no app)
 *   2. upload em exercises/manual/<workout_id>.jpg (upsert)
 *   3. UPDATE workouts.photo = URL pública
 *
 * Aceita a imagem em png/jpg/jpeg/webp: se o caminho exato não existir, tenta
 * o mesmo nome com as outras extensões.
 *
 *   node scripts/upload-exercise-image.mjs <workout_id> ai-exercise-images/<arquivo>.png
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 7 dias, não imutável: corrigir a imagem sobrescreve o MESMO caminho.
const CATALOG_CACHE_CONTROL = "604800";
const EXTS = ["png", "jpg", "jpeg", "webp"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const [workoutId, fileArg] = process.argv.slice(2);
if (!workoutId || !fileArg) {
  console.error("Uso: node scripts/upload-exercise-image.mjs <workout_id> <caminho-da-imagem>");
  process.exit(1);
}

function loadEnv() {
  const raw = readFileSync(resolve(root, ".env"), "utf-8");
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

function findImage(arg) {
  const exact = resolve(root, arg);
  if (existsSync(exact)) return exact;
  const base = exact.replace(/\.(png|jpe?g|webp)$/i, "");
  return EXTS.map((e) => `${base}.${e}`).find(existsSync) ?? null;
}

const file = findImage(fileArg);
if (!file) {
  console.error(`✗ imagem não encontrada: ${fileArg} (tentei .${EXTS.join(" / .")})`);
  process.exit(1);
}

const env = loadEnv();
const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Confere o exercício ANTES de subir: id errado não deve deixar arquivo órfão.
const { data: workout, error: readErr } = await supabase
  .from("workouts")
  .select("id, name")
  .eq("id", workoutId)
  .maybeSingle();
if (readErr) {
  console.error(`✗ erro ao ler o exercício: ${readErr.message}`);
  process.exit(1);
}
if (!workout) {
  console.error(`✗ exercício ${workoutId} não existe em workouts`);
  process.exit(1);
}

try {
  const jpg = await sharp(readFileSync(file))
    .flatten({ background: "#ffffff" })
    .resize(1024, 1024, { fit: "cover" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const path = `manual/${workoutId}.jpg`;
  const up = await supabase.storage
    .from("exercises")
    .upload(path, jpg, { upsert: true, contentType: "image/jpeg", cacheControl: CATALOG_CACHE_CONTROL });
  if (up.error) throw up.error;

  const publicUrl = supabase.storage.from("exercises").getPublicUrl(path).data.publicUrl;
  const upd = await supabase.from("workouts").update({ photo: publicUrl }).eq("id", workoutId).select("id");
  if (upd.error) throw upd.error;
  if (!upd.data?.length) throw new Error("UPDATE não alterou nenhuma linha");

  console.log(`✓ ${workout.name} -> ${path} (${Math.round(jpg.length / 1024)} KB)`);
} catch (e) {
  console.error(`✗ ${workout.name}: ${e.message || e}`);
  process.exit(1);
}
