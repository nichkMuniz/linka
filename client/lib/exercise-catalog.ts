const WGER_BASE = "https://wger.de/api/v2";

export type CatalogExercise = {
  id: number;
  name: string;
  description: string;
  category: string;
  image: string | null;
  imageThumbnail: string | null;
  muscles: string[];
};

// Category ID → Portuguese label
const CATEGORY_MAP: Record<number, string> = {
  10: "Abdômen",
  8: "Braços",
  12: "Costas",
  14: "Panturrilha",
  15: "Cardio",
  11: "Peito",
  9: "Pernas",
  13: "Ombros",
};

// English category name → Portuguese
const CATEGORY_NAME_PT: Record<string, string> = {
  "Abs": "Abdômen",
  "Arms": "Braços",
  "Back": "Costas",
  "Calves": "Panturrilha",
  "Cardio": "Cardio",
  "Chest": "Peito",
  "Legs": "Pernas",
  "Shoulders": "Ombros",
};

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

// In-memory cache
let cachedExercises: CatalogExercise[] | null = null;

async function fetchFromApi(): Promise<CatalogExercise[]> {
  const exercises: CatalogExercise[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `${WGER_BASE}/exerciseinfo/?format=json&language=2&limit=${limit}&offset=${offset}`
    );
    if (!res.ok) break;

    const data = await res.json();
    const results = data.results ?? [];

    for (const ex of results) {
      const enTranslation = ex.translations?.find((t: any) => t.language === 2);
      const ptTranslation = ex.translations?.find((t: any) => t.language === 7 || t.language === 8);
      const translation = ptTranslation || enTranslation || ex.translations?.[0];

      if (!translation?.name) continue;
      if (!ex.images?.length) continue;

      const mainImage = ex.images?.find((img: any) => img.is_main);
      const anyImage = ex.images?.[0];
      const image = mainImage || anyImage;

      const categoryPt = ex.category?.id
        ? CATEGORY_MAP[ex.category.id] || ex.category.name || ""
        : "";

      const muscles = (ex.muscles ?? [])
        .map((m: any) => m.name_en || m.name || "")
        .filter(Boolean);

      exercises.push({
        id: ex.id,
        name: translation.name,
        description: translation.description ? stripHtml(translation.description).slice(0, 200) : "",
        category: categoryPt,
        image: image?.image || null,
        imageThumbnail: image?.image || null,
        muscles,
      });
    }

    if (!data.next) break;
    offset += limit;
  }

  return exercises;
}

async function persistToDb(exercises: CatalogExercise[]): Promise<void> {
  try {
    const { bulkUpsertCatalogWorkoutsDb } = await import("@/lib/ritmofit-db");
    await bulkUpsertCatalogWorkoutsDb(
      exercises.map((ex) => ({
        name: ex.name,
        description: ex.description,
        muscleGroup: ex.category,
        photo: ex.image,
        wgerId: ex.id,
      }))
    );
  } catch (e) {
    console.warn("Could not persist catalog to DB:", e);
  }
}

async function loadFromDb(): Promise<CatalogExercise[]> {
  try {
    const { getCatalogWorkoutsFromDb } = await import("@/lib/ritmofit-db");
    const rows = await getCatalogWorkoutsFromDb();
    return rows.map((row) => ({
      id: row.wgerId ?? 0,
      name: row.name,
      description: row.description,
      category: row.muscleGroup,
      image: row.photo,
      imageThumbnail: row.photo,
      muscles: [],
    }));
  } catch {
    return [];
  }
}

export async function fetchExerciseCatalog(): Promise<CatalogExercise[]> {
  if (cachedExercises) return cachedExercises;

  try {
    const apiExercises = await fetchFromApi();

    if (apiExercises.length > 0) {
      cachedExercises = apiExercises;
      // Persist in background — don't block the UI
      persistToDb(apiExercises);
      return apiExercises;
    }
  } catch (e) {
    console.warn("wger API unavailable, falling back to DB:", e);
  }

  // API failed or returned nothing — load from DB
  const dbExercises = await loadFromDb();
  cachedExercises = dbExercises;
  return dbExercises;
}

// Search exercises by term (fast, uses wger search endpoint)
export async function searchExerciseCatalog(term: string): Promise<CatalogExercise[]> {
  if (!term.trim()) return [];

  try {
    const res = await fetch(
      `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`
    );
    if (!res.ok) throw new Error("search failed");

    const data = await res.json();
    const suggestions = data.suggestions ?? [];

    const seen = new Set<number>();
    const results: CatalogExercise[] = [];

    for (const s of suggestions) {
      const baseId = s.data?.base_id ?? s.data?.id;
      if (seen.has(baseId)) continue;
      seen.add(baseId);

      results.push({
        id: baseId,
        name: s.data?.name || s.value || "",
        description: "",
        category: CATEGORY_NAME_PT[s.data?.category] || s.data?.category || "",
        image: s.data?.image ? `https://wger.de${s.data.image}` : null,
        imageThumbnail: s.data?.image_thumbnail ? `https://wger.de${s.data.image_thumbnail}` : null,
        muscles: [],
      });
    }

    return results;
  } catch {
    // Fall back to filtering the full catalog from DB
    const all = await fetchExerciseCatalog();
    const lower = term.toLowerCase();
    return all.filter((ex) => ex.name.toLowerCase().includes(lower)).slice(0, 20);
  }
}
