/**
 * migrate-exercise-images.mjs
 *
 * Finds all exercises in the `workouts` table that have a wger_id but
 * whose photo is either null or a relative/wger.de URL, fetches the image
 * from wger.de, uploads to Supabase Storage, and updates the record.
 *
 * Safe to re-run: skips exercises that already have a Storage URL.
 *
 *   node scripts/migrate-exercise-images.mjs
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
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const STORAGE_BUCKET = "exercises";
const WGER_BASE = "https://wger.de";

// ---------------------------------------------------------------------------
// Fetch exercises that need image migration
// ---------------------------------------------------------------------------

async function fetchPending() {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, wger_id, photo")
    .not("wger_id", "is", null);

  if (error) throw new Error(`Failed to fetch workouts: ${error.message}`);

  return (data ?? []).filter((row) => {
    const photo = row.photo;
    // Needs migration if: null, relative path, or wger.de URL
    if (!photo) return true;
    if (photo.startsWith("/")) return true;
    if (photo.includes("wger.de")) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Fetch the image URL for a wger exercise from the API
// ---------------------------------------------------------------------------

async function fetchWgerImageUrl(wgerId) {
  try {
    const res = await fetch(`${WGER_BASE}/api/v2/exerciseimage/?format=json&exercise_base=${wgerId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const images = data.results ?? [];
    if (!images.length) return null;
    const main = images.find((img) => img.is_main) || images[0];
    const url = main.image;
    if (!url) return null;
    return url.startsWith("/") ? `${WGER_BASE}${url}` : url;
  } catch {
    return null;
  }
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== migrate-exercise-images ===\n");

  console.log("Fetching exercises with missing or invalid photos...");
  const pending = await fetchPending();
  console.log(`Found ${pending.length} exercises to migrate\n`);

  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let ok = 0;
  let failed = 0;
  let noImage = 0;

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const wgerId = row.wger_id;
    process.stdout.write(`[${i + 1}/${pending.length}] wger_id=${wgerId} `);

    // If we already have a URL (relative or wger.de), use it directly
    let imageUrl = row.photo;
    if (imageUrl && imageUrl.startsWith("/")) {
      imageUrl = `${WGER_BASE}${imageUrl}`;
    } else if (!imageUrl || imageUrl.includes("wger.de")) {
      // Fetch fresh URL from API if photo is null or already a wger.de URL
      imageUrl = imageUrl && imageUrl.includes("wger.de") ? imageUrl : await fetchWgerImageUrl(wgerId);
    }

    if (!imageUrl) {
      console.log("→ no image found, skipping");
      noImage++;
      continue;
    }

    const publicUrl = await uploadImage(wgerId, imageUrl);

    if (!publicUrl) {
      console.log("→ upload failed");
      failed++;
      continue;
    }

    const { error } = await supabase
      .from("workouts")
      .update({ photo: publicUrl })
      .eq("wger_id", wgerId);

    if (error) {
      console.log(`→ DB update failed: ${error.message}`);
      failed++;
    } else {
      console.log("→ ok");
      ok++;
    }
  }

  console.log(`\nDone!`);
  console.log(`  Migrated:  ${ok}`);
  console.log(`  No image:  ${noImage}`);
  console.log(`  Failed:    ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
