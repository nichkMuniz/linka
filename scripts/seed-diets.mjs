/**
 * seed-diets.mjs
 *
 * Fetches all meals from TheMealDB API, downloads each image into
 * Supabase Storage ("diets" bucket), and upserts the records into
 * the `diets` table with the permanent Storage URL.
 *
 * Run once:
 *   node scripts/seed-diets.mjs
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
const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";
const STORAGE_BUCKET = "diets";

// ---------------------------------------------------------------------------
// Category translations
// ---------------------------------------------------------------------------

const CATEGORY_PT = {
  "Beef": "Carne Bovina",
  "Chicken": "Frango",
  "Dessert": "Sobremesa",
  "Lamb": "Cordeiro",
  "Miscellaneous": "Diversos",
  "Pasta": "Massas",
  "Pork": "Porco",
  "Seafood": "Frutos do Mar",
  "Side": "Acompanhamento",
  "Starter": "Entrada",
  "Vegan": "Vegano",
  "Vegetarian": "Vegetariano",
  "Breakfast": "Café da Manhã",
  "Goat": "Cabrito",
};

// ---------------------------------------------------------------------------
// Fetch from TheMealDB API
// ---------------------------------------------------------------------------

async function fetchAllFromApi() {
  console.log("  Fetching categories...");
  const catRes = await fetch(`${MEALDB_BASE}/categories.php`);
  if (!catRes.ok) throw new Error(`Failed to fetch categories: ${catRes.status}`);
  const catData = await catRes.json();
  const categories = catData.categories ?? [];
  console.log(`  Found ${categories.length} categories\n`);

  const meals = [];
  const seen = new Set();

  for (const cat of categories) {
    const catName = cat.strCategory;
    try {
      const res = await fetch(`${MEALDB_BASE}/filter.php?c=${encodeURIComponent(catName)}`);
      if (!res.ok) { console.warn(`  Skipping category "${catName}": ${res.status}`); continue; }
      const data = await res.json();
      const items = (data.meals ?? []).filter((item) => item.strMeal && item.strMealThumb);
      for (const item of items) {
        const id = Number(item.idMeal);
        if (seen.has(id)) continue;
        seen.add(id);
        meals.push({
          mealdb_id: id,
          name: item.strMeal,
          description: "",
          category: CATEGORY_PT[catName] || catName,
          imageUrl: item.strMealThumb,
        });
      }
      console.log(`  ${catName}: ${items.length} meals (total so far: ${meals.length})`);
    } catch (err) {
      console.warn(`  Error fetching category "${catName}": ${err.message}`);
    }
  }

  return meals;
}

// ---------------------------------------------------------------------------
// Upload image to Supabase Storage
// ---------------------------------------------------------------------------

async function uploadImage(mealdbId, imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = imageUrl.split(".").pop()?.split("?")[0] ?? "jpg";
    const path = `meals/${mealdbId}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { upsert: true, contentType });

    if (error) {
      console.warn(`    Storage error for mealdb_id ${mealdbId}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn(`    Upload failed for mealdb_id ${mealdbId}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upsert batch into diets table
// ---------------------------------------------------------------------------

async function upsertBatch(rows) {
  const { error } = await supabase
    .from("diets")
    .upsert(rows, { onConflict: "mealdb_id", ignoreDuplicates: false });
  if (error) {
    console.warn(`  Upsert error: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== seed-diets ===\n");

  console.log("1. Fetching meals from TheMealDB API...");
  const meals = await fetchAllFromApi();
  console.log(`\nTotal: ${meals.length} meals\n`);

  if (meals.length === 0) {
    console.error("No meals fetched. Aborting.");
    process.exit(1);
  }

  console.log("2. Downloading images → Supabase Storage → upserting records...\n");

  const BATCH_SIZE = 20;
  let done = 0;
  let imgOk = 0;
  let imgFail = 0;
  const batchRows = [];

  for (const meal of meals) {
    let publicUrl = null;

    if (meal.imageUrl) {
      publicUrl = await uploadImage(meal.mealdb_id, meal.imageUrl);
      if (publicUrl) imgOk++; else imgFail++;
    }

    batchRows.push({
      mealdb_id: meal.mealdb_id,
      name: meal.name,
      description: meal.description,
      category: meal.category,
      photo: publicUrl,
    });

    done++;

    if (batchRows.length >= BATCH_SIZE) {
      await upsertBatch(batchRows.splice(0));
      console.log(`  [${done}/${meals.length}] images: ${imgOk} ok, ${imgFail} failed`);
    }
  }

  if (batchRows.length > 0) {
    await upsertBatch(batchRows);
    console.log(`  [${done}/${meals.length}] images: ${imgOk} ok, ${imgFail} failed`);
  }

  console.log(`\nDone!`);
  console.log(`  Meals upserted:    ${done}`);
  console.log(`  Images in Storage: ${imgOk}`);
  console.log(`  Images failed:     ${imgFail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
