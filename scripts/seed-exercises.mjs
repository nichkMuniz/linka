/**
 * seed-exercises.mjs
 *
 * Fetches all exercises from the wger API, downloads each image into
 * Supabase Storage ("exercises" bucket), and upserts the records into
 * the `workouts` table with the permanent Storage URL.
 *
 * Run once:
 *   node scripts/seed-exercises.mjs
 *
 * Requires .env at the project root with:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const WGER_BASE = "https://wger.de/api/v2";
const STORAGE_BUCKET = "exercises";

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  10: "Abdômen", 8: "Braços", 12: "Costas", 14: "Panturrilha",
  15: "Cardio", 11: "Peito", 9: "Pernas", 13: "Ombros",
};

const EXERCISE_NAME_PT = {
  "Bench Press": "Supino Reto", "Barbell Bench Press": "Supino Reto com Barra",
  "Dumbbell Bench Press": "Supino Reto com Halteres", "Incline Bench Press": "Supino Inclinado",
  "Incline Dumbbell Press": "Supino Inclinado com Halteres", "Decline Bench Press": "Supino Declinado",
  "Decline Dumbbell Press": "Supino Declinado com Halteres", "Chest Fly": "Crucifixo",
  "Dumbbell Fly": "Crucifixo com Halteres", "Cable Fly": "Crucifixo no Cabo",
  "Incline Dumbbell Fly": "Crucifixo Inclinado", "Pec Deck": "Peck Deck",
  "Push-Up": "Flexão de Braço", "Push Up": "Flexão de Braço",
  "Wide Push-Up": "Flexão Aberta", "Diamond Push-Up": "Flexão Diamante",
  "Chest Dip": "Mergulho no Paralelo", "Cable Crossover": "Crossover no Cabo",
  "Pull-Up": "Barra Fixa", "Pull Up": "Barra Fixa",
  "Chin-Up": "Barra Supinada", "Chin Up": "Barra Supinada",
  "Lat Pulldown": "Puxada Frontal", "Wide Grip Lat Pulldown": "Puxada Frontal Aberta",
  "Close Grip Lat Pulldown": "Puxada Frontal Fechada", "Seated Cable Row": "Remada Sentado no Cabo",
  "Bent Over Row": "Remada Curvada", "Barbell Row": "Remada com Barra",
  "Dumbbell Row": "Remada com Haltere", "One Arm Dumbbell Row": "Remada Unilateral com Haltere",
  "T-Bar Row": "Remada T", "Deadlift": "Levantamento Terra",
  "Romanian Deadlift": "Levantamento Terra Romeno", "Stiff-Leg Deadlift": "Levantamento Terra Perna Rígida",
  "Sumo Deadlift": "Levantamento Terra Sumô", "Back Extension": "Extensão Lombar",
  "Hyperextension": "Hiperextensão", "Good Morning": "Bom Dia",
  "Shrug": "Encolhimento de Ombros", "Barbell Shrug": "Encolhimento com Barra",
  "Dumbbell Shrug": "Encolhimento com Halteres", "Seated Row": "Remada Sentado",
  "Face Pull": "Face Pull", "Rack Pull": "Levantamento Parcial",
  "Overhead Press": "Desenvolvimento", "Barbell Overhead Press": "Desenvolvimento com Barra",
  "Dumbbell Overhead Press": "Desenvolvimento com Halteres", "Military Press": "Press Militar",
  "Seated Dumbbell Press": "Desenvolvimento Sentado com Halteres", "Arnold Press": "Press Arnold",
  "Lateral Raise": "Elevação Lateral", "Dumbbell Lateral Raise": "Elevação Lateral com Halteres",
  "Cable Lateral Raise": "Elevação Lateral no Cabo", "Front Raise": "Elevação Frontal",
  "Dumbbell Front Raise": "Elevação Frontal com Halteres", "Rear Delt Fly": "Crucifixo Invertido",
  "Reverse Fly": "Crucifixo Invertido", "Upright Row": "Remada Alta",
  "Barbell Upright Row": "Remada Alta com Barra", "Cable Upright Row": "Remada Alta no Cabo",
  "Shoulder Press": "Press de Ombro", "Bicep Curl": "Rosca Direta",
  "Biceps Curl": "Rosca Direta", "Barbell Curl": "Rosca Direta com Barra",
  "Dumbbell Curl": "Rosca com Halteres", "Hammer Curl": "Rosca Martelo",
  "Preacher Curl": "Rosca Scott", "EZ Bar Curl": "Rosca Direta com Barra EZ",
  "Incline Dumbbell Curl": "Rosca Inclinada com Halteres", "Concentration Curl": "Rosca Concentrada",
  "Cable Curl": "Rosca no Cabo", "Reverse Curl": "Rosca Inversa",
  "Spider Curl": "Rosca Spider", "Zottman Curl": "Rosca Zottman",
  "Tricep Dip": "Mergulho para Tríceps", "Triceps Dip": "Mergulho para Tríceps",
  "Dip": "Mergulho no Paralelo", "Tricep Pushdown": "Tríceps Pulley",
  "Triceps Pushdown": "Tríceps Pulley", "Cable Tricep Pushdown": "Tríceps Pulley no Cabo",
  "Overhead Tricep Extension": "Extensão de Tríceps Acima da Cabeça", "Skull Crusher": "Tríceps Testa",
  "Close Grip Bench Press": "Supino Fechado", "Tricep Kickback": "Coice de Tríceps",
  "Diamond Push Up": "Flexão Diamante", "Rope Pushdown": "Tríceps Corda",
  "French Press": "Tríceps Francês", "Crunch": "Abdominal",
  "Sit-Up": "Abdominal Completo", "Sit Up": "Abdominal Completo",
  "Plank": "Prancha", "Side Plank": "Prancha Lateral",
  "Russian Twist": "Rotação Russa", "Leg Raise": "Elevação de Pernas",
  "Hanging Leg Raise": "Elevação de Pernas Suspenso", "Mountain Climber": "Escalada",
  "Bicycle Crunch": "Abdominal Bicicleta", "Cable Crunch": "Abdominal no Cabo",
  "Ab Wheel Rollout": "Roda Abdominal", "Flutter Kick": "Batida de Pernas",
  "Hollow Body Hold": "Prancha Hollow", "Dragon Flag": "Dragon Flag",
  "V-Up": "Abdominal em V", "Toe Touch": "Toque nos Pés",
  "Windshield Wiper": "Limpador de Para-brisa", "Squat": "Agachamento",
  "Back Squat": "Agachamento com Barra", "Front Squat": "Agachamento Frontal",
  "Goblet Squat": "Agachamento Goblet", "Sumo Squat": "Agachamento Sumô",
  "Hack Squat": "Hack Squat", "Leg Press": "Leg Press",
  "Leg Extension": "Extensão de Joelho", "Lunge": "Avanço",
  "Barbell Lunge": "Avanço com Barra", "Dumbbell Lunge": "Avanço com Halteres",
  "Walking Lunge": "Avanço Andando", "Reverse Lunge": "Avanço Reverso",
  "Bulgarian Split Squat": "Agachamento Búlgaro", "Step Up": "Subida no Step",
  "Box Jump": "Salto na Caixa", "Pistol Squat": "Agachamento Unilateral",
  "Wall Sit": "Cadeira na Parede", "Hip Thrust": "Elevação de Quadril",
  "Barbell Hip Thrust": "Elevação de Quadril com Barra", "Glute Bridge": "Ponte Glúteo",
  "Leg Curl": "Flexão de Joelho", "Lying Leg Curl": "Flexão de Joelho Deitado",
  "Seated Leg Curl": "Flexão de Joelho Sentado", "Nordic Hamstring Curl": "Flexão Nórdica",
  "Donkey Kick": "Coice do Burro", "Fire Hydrant": "Abdução Lateral no Chão",
  "Cable Kickback": "Extensão de Quadril no Cabo", "Calf Raise": "Elevação de Panturrilha",
  "Standing Calf Raise": "Elevação de Panturrilha em Pé", "Seated Calf Raise": "Elevação de Panturrilha Sentado",
  "Donkey Calf Raise": "Elevação de Panturrilha Inclinado", "Burpee": "Burpee",
  "Jumping Jack": "Polichinelo", "Jumping Jacks": "Polichinelo",
  "Jump Rope": "Corda", "High Knees": "Corrida com Joelhos Altos",
  "Treadmill": "Esteira", "Rowing Machine": "Remo Ergométrico",
  "Stationary Bike": "Bicicleta Ergométrica", "Elliptical": "Elíptico",
  "Sprint": "Tiro", "Run": "Corrida", "Swimming": "Natação",
  "Jump Squat": "Agachamento com Salto", "Kettlebell Swing": "Swing com Kettlebell",
  "Clean and Jerk": "Arremesso", "Snatch": "Arranque", "Thruster": "Thruster",
  "Battle Rope": "Corda Battle Rope", "Foam Rolling": "Rolo de Espuma",
  "Stretching": "Alongamento", "Yoga": "Yoga", "Pilates": "Pilates",
};

function translateExerciseName(name) {
  if (EXERCISE_NAME_PT[name]) return EXERCISE_NAME_PT[name];
  const lower = name.toLowerCase();
  for (const [en, pt] of Object.entries(EXERCISE_NAME_PT)) {
    if (en.toLowerCase() === lower) return pt;
  }
  return name;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Fetch from wger API
// ---------------------------------------------------------------------------

async function fetchAllFromApi() {
  const exercises = [];
  let offset = 0;
  const limit = 100;
  let page = 1;

  while (true) {
    console.log(`  Fetching page ${page} (offset ${offset})...`);
    const res = await fetch(
      `${WGER_BASE}/exerciseinfo/?format=json&language=2&limit=${limit}&offset=${offset}`
    );
    if (!res.ok) {
      console.error(`  API error: ${res.status} ${res.statusText}`);
      break;
    }

    const data = await res.json();
    const results = data.results ?? [];

    for (const ex of results) {
      const enTranslation = ex.translations?.find((t) => t.language === 2);
      const ptTranslation = ex.translations?.find((t) => t.language === 7 || t.language === 8);
      const translation = ptTranslation || enTranslation || ex.translations?.[0];

      if (!translation?.name) continue;
      if (!ex.images?.length) continue;

      const mainImage = ex.images?.find((img) => img.is_main);
      const image = mainImage || ex.images[0];

      const categoryPt = ex.category?.id
        ? CATEGORY_MAP[ex.category.id] || ex.category.name || ""
        : "";

      let imageUrl = image?.image || null;
      if (imageUrl && imageUrl.startsWith("/")) {
        imageUrl = `https://wger.de${imageUrl}`;
      }

      exercises.push({
        wger_id: ex.id,
        name: translateExerciseName(translation.name),
        description: translation.description
          ? stripHtml(translation.description).slice(0, 200)
          : "",
        muscle_group: categoryPt || null,
        imageUrl,
      });
    }

    console.log(`  → ${results.length} on page, ${exercises.length} with images so far`);

    if (!data.next) break;
    offset += limit;
    page++;
  }

  return exercises;
}

// ---------------------------------------------------------------------------
// Upload image to Supabase Storage
// ---------------------------------------------------------------------------

async function uploadImage(wgerId, imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = imageUrl.split(".").pop()?.split("?")[0] ?? "jpg";
    const path = `exercises/${wgerId}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { upsert: true, contentType });

    if (error) {
      console.warn(`    Storage error for wger_id ${wgerId}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn(`    Upload failed for wger_id ${wgerId}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upsert batch into workouts table
// ---------------------------------------------------------------------------

async function upsertBatch(rows) {
  const { error } = await supabase
    .from("workouts")
    .upsert(rows, { onConflict: "wger_id", ignoreDuplicates: false });
  if (error) {
    console.warn(`  Upsert error: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== seed-exercises ===\n");

  console.log("1. Fetching exercises from wger API...");
  const exercises = await fetchAllFromApi();
  console.log(`\nTotal: ${exercises.length} exercises with images\n`);

  if (exercises.length === 0) {
    console.error("No exercises fetched. Aborting.");
    process.exit(1);
  }

  console.log("2. Downloading images → Supabase Storage → upserting records...\n");

  const BATCH_SIZE = 20;
  let done = 0;
  let imgOk = 0;
  let imgFail = 0;
  const batchRows = [];

  for (const ex of exercises) {
    let publicUrl = null;

    if (ex.imageUrl) {
      publicUrl = await uploadImage(ex.wger_id, ex.imageUrl);
      if (publicUrl) imgOk++; else imgFail++;
    }

    const row = {
      wger_id: ex.wger_id,
      name: ex.name,
      description: ex.description,
      muscle_group: ex.muscle_group,
    };
    // Only set photo if upload succeeded — never overwrite existing photo with null
    if (publicUrl) row.photo = publicUrl;
    batchRows.push(row);

    done++;

    if (batchRows.length >= BATCH_SIZE) {
      await upsertBatch(batchRows.splice(0));
      console.log(`  [${done}/${exercises.length}] images: ${imgOk} ok, ${imgFail} failed`);
    }
  }

  // Flush remaining
  if (batchRows.length > 0) {
    await upsertBatch(batchRows);
    console.log(`  [${done}/${exercises.length}] images: ${imgOk} ok, ${imgFail} failed`);
  }

  console.log(`\nDone!`);
  console.log(`  Exercises upserted: ${done}`);
  console.log(`  Images in Storage:  ${imgOk}`);
  console.log(`  Images failed:      ${imgFail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
