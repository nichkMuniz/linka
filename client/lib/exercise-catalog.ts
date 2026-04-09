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

// English exercise name → Portuguese translation dictionary
const EXERCISE_NAME_PT: Record<string, string> = {
  // Peito
  "Bench Press": "Supino Reto",
  "Barbell Bench Press": "Supino Reto com Barra",
  "Dumbbell Bench Press": "Supino Reto com Halteres",
  "Incline Bench Press": "Supino Inclinado",
  "Incline Dumbbell Press": "Supino Inclinado com Halteres",
  "Decline Bench Press": "Supino Declinado",
  "Decline Dumbbell Press": "Supino Declinado com Halteres",
  "Chest Fly": "Crucifixo",
  "Dumbbell Fly": "Crucifixo com Halteres",
  "Cable Fly": "Crucifixo no Cabo",
  "Incline Dumbbell Fly": "Crucifixo Inclinado",
  "Pec Deck": "Peck Deck",
  "Push-Up": "Flexão de Braço",
  "Push Up": "Flexão de Braço",
  "Wide Push-Up": "Flexão Aberta",
  "Diamond Push-Up": "Flexão Diamante",
  "Chest Dip": "Mergulho no Paralelo",
  "Cable Crossover": "Crossover no Cabo",

  // Costas
  "Pull-Up": "Barra Fixa",
  "Pull Up": "Barra Fixa",
  "Chin-Up": "Barra Supinada",
  "Chin Up": "Barra Supinada",
  "Lat Pulldown": "Puxada Frontal",
  "Wide Grip Lat Pulldown": "Puxada Frontal Aberta",
  "Close Grip Lat Pulldown": "Puxada Frontal Fechada",
  "Seated Cable Row": "Remada Sentado no Cabo",
  "Bent Over Row": "Remada Curvada",
  "Barbell Row": "Remada com Barra",
  "Dumbbell Row": "Remada com Haltere",
  "One Arm Dumbbell Row": "Remada Unilateral com Haltere",
  "T-Bar Row": "Remada T",
  "Deadlift": "Levantamento Terra",
  "Romanian Deadlift": "Levantamento Terra Romeno",
  "Stiff-Leg Deadlift": "Levantamento Terra Perna Rígida",
  "Sumo Deadlift": "Levantamento Terra Sumô",
  "Back Extension": "Extensão Lombar",
  "Hyperextension": "Hiperextensão",
  "Good Morning": "Bom Dia",
  "Shrug": "Encolhimento de Ombros",
  "Barbell Shrug": "Encolhimento com Barra",
  "Dumbbell Shrug": "Encolhimento com Halteres",
  "Seated Row": "Remada Sentado",
  "Face Pull": "Face Pull",
  "Rack Pull": "Levantamento Parcial",

  // Ombros
  "Overhead Press": "Desenvolvimento",
  "Barbell Overhead Press": "Desenvolvimento com Barra",
  "Dumbbell Overhead Press": "Desenvolvimento com Halteres",
  "Military Press": "Press Militar",
  "Seated Dumbbell Press": "Desenvolvimento Sentado com Halteres",
  "Arnold Press": "Press Arnold",
  "Lateral Raise": "Elevação Lateral",
  "Dumbbell Lateral Raise": "Elevação Lateral com Halteres",
  "Cable Lateral Raise": "Elevação Lateral no Cabo",
  "Front Raise": "Elevação Frontal",
  "Dumbbell Front Raise": "Elevação Frontal com Halteres",
  "Rear Delt Fly": "Crucifixo Invertido",
  "Reverse Fly": "Crucifixo Invertido",
  "Upright Row": "Remada Alta",
  "Barbell Upright Row": "Remada Alta com Barra",
  "Cable Upright Row": "Remada Alta no Cabo",
  "Shoulder Press": "Press de Ombro",

  // Bíceps
  "Bicep Curl": "Rosca Direta",
  "Biceps Curl": "Rosca Direta",
  "Barbell Curl": "Rosca Direta com Barra",
  "Dumbbell Curl": "Rosca com Halteres",
  "Hammer Curl": "Rosca Martelo",
  "Preacher Curl": "Rosca Scott",
  "EZ Bar Curl": "Rosca Direta com Barra EZ",
  "Incline Dumbbell Curl": "Rosca Inclinada com Halteres",
  "Concentration Curl": "Rosca Concentrada",
  "Cable Curl": "Rosca no Cabo",
  "Reverse Curl": "Rosca Inversa",
  "Spider Curl": "Rosca Spider",
  "Zottman Curl": "Rosca Zottman",

  // Tríceps
  "Tricep Dip": "Mergulho para Tríceps",
  "Triceps Dip": "Mergulho para Tríceps",
  "Dip": "Mergulho no Paralelo",
  "Tricep Pushdown": "Tríceps Pulley",
  "Triceps Pushdown": "Tríceps Pulley",
  "Cable Tricep Pushdown": "Tríceps Pulley no Cabo",
  "Overhead Tricep Extension": "Extensão de Tríceps Acima da Cabeça",
  "Skull Crusher": "Tríceps Testa",
  "Close Grip Bench Press": "Supino Fechado",
  "Tricep Kickback": "Coice de Tríceps",
  "Diamond Push Up": "Flexão Diamante",
  "Rope Pushdown": "Tríceps Corda",
  "French Press": "Tríceps Francês",

  // Abdômen
  "Crunch": "Abdominal",
  "Sit-Up": "Abdominal Completo",
  "Sit Up": "Abdominal Completo",
  "Plank": "Prancha",
  "Side Plank": "Prancha Lateral",
  "Russian Twist": "Rotação Russa",
  "Leg Raise": "Elevação de Pernas",
  "Hanging Leg Raise": "Elevação de Pernas Suspenso",
  "Mountain Climber": "Escalada",
  "Bicycle Crunch": "Abdominal Bicicleta",
  "Cable Crunch": "Abdominal no Cabo",
  "Ab Wheel Rollout": "Roda Abdominal",
  "Flutter Kick": "Batida de Pernas",
  "Hollow Body Hold": "Prancha Hollow",
  "Dragon Flag": "Dragon Flag",
  "V-Up": "Abdominal em V",
  "Toe Touch": "Toque nos Pés",
  "Windshield Wiper": "Limpador de Para-brisa",

  // Pernas — Quadríceps
  "Squat": "Agachamento",
  "Back Squat": "Agachamento com Barra",
  "Front Squat": "Agachamento Frontal",
  "Goblet Squat": "Agachamento Goblet",
  "Sumo Squat": "Agachamento Sumô",
  "Hack Squat": "Hack Squat",
  "Leg Press": "Leg Press",
  "Leg Extension": "Extensão de Joelho",
  "Lunge": "Avanço",
  "Barbell Lunge": "Avanço com Barra",
  "Dumbbell Lunge": "Avanço com Halteres",
  "Walking Lunge": "Avanço Andando",
  "Reverse Lunge": "Avanço Reverso",
  "Bulgarian Split Squat": "Agachamento Búlgaro",
  "Step Up": "Subida no Step",
  "Box Jump": "Salto na Caixa",
  "Pistol Squat": "Agachamento Unilateral",
  "Wall Sit": "Cadeira na Parede",

  // Pernas — Posterior / Glúteos
  "Hip Thrust": "Elevação de Quadril",
  "Barbell Hip Thrust": "Elevação de Quadril com Barra",
  "Glute Bridge": "Ponte Glúteo",
  "Leg Curl": "Flexão de Joelho",
  "Lying Leg Curl": "Flexão de Joelho Deitado",
  "Seated Leg Curl": "Flexão de Joelho Sentado",
  "Nordic Hamstring Curl": "Flexão Nórdica",
  "Good Morning": "Bom Dia",
  "Donkey Kick": "Coice do Burro",
  "Fire Hydrant": "Abdução Lateral no Chão",
  "Cable Kickback": "Extensão de Quadril no Cabo",

  // Panturrilha
  "Calf Raise": "Elevação de Panturrilha",
  "Standing Calf Raise": "Elevação de Panturrilha em Pé",
  "Seated Calf Raise": "Elevação de Panturrilha Sentado",
  "Donkey Calf Raise": "Elevação de Panturrilha Inclinado",

  // Cardio / Full Body
  "Burpee": "Burpee",
  "Jumping Jack": "Polichinelo",
  "Jumping Jacks": "Polichinelo",
  "Jump Rope": "Corda",
  "High Knees": "Corrida com Joelhos Altos",
  "Box Jump": "Salto na Caixa",
  "Treadmill": "Esteira",
  "Rowing Machine": "Remo Ergométrico",
  "Stationary Bike": "Bicicleta Ergométrica",
  "Elliptical": "Elíptico",
  "Sprint": "Tiro",
  "Run": "Corrida",
  "Swimming": "Natação",
  "Jump Squat": "Agachamento com Salto",
  "Kettlebell Swing": "Swing com Kettlebell",
  "Clean and Jerk": "Arremesso",
  "Snatch": "Arranque",
  "Thruster": "Thruster",
  "Battle Rope": "Corda Battle Rope",

  // Mobilidade / Outros
  "Foam Rolling": "Rolo de Espuma",
  "Stretching": "Alongamento",
  "Yoga": "Yoga",
  "Pilates": "Pilates",
};

function translateExerciseName(name: string): string {
  // Exact match first
  if (EXERCISE_NAME_PT[name]) return EXERCISE_NAME_PT[name];
  // Case-insensitive fallback
  const lower = name.toLowerCase();
  for (const [en, pt] of Object.entries(EXERCISE_NAME_PT)) {
    if (en.toLowerCase() === lower) return pt;
  }
  return name;
}

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
        name: translateExerciseName(translation.name),
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

/**
 * Migrates existing exercises in the DB that still have wger.de URLs by downloading
 * and re-uploading them to Supabase Storage. Call this once from an admin context.
 * Returns the number of images successfully migrated.
 */
export async function migrateExerciseImagesToStorage(): Promise<number> {
  const { getCatalogWorkoutsFromDb, uploadExerciseImageToStorage, bulkUpsertCatalogWorkoutsDb } = await import("@/lib/ritmofit-db");
  const rows = await getCatalogWorkoutsFromDb();
  const toMigrate = rows.filter((r) => r.photo && r.photo.includes("wger.de") && r.wgerId);

  let migrated = 0;
  const updated: Array<{ name: string; description: string; muscleGroup: string; photo: string | null; wgerId: number }> = [];

  for (const row of toMigrate) {
    const storageUrl = await uploadExerciseImageToStorage(row.wgerId!, row.photo!);
    if (storageUrl) {
      updated.push({
        name: row.name,
        description: row.description,
        muscleGroup: row.muscleGroup,
        photo: storageUrl,
        wgerId: row.wgerId!,
      });
      migrated++;
    }
  }

  if (updated.length > 0) {
    await bulkUpsertCatalogWorkoutsDb(updated);
    // Invalidate cache so next load picks up new URLs
    cachedExercises = null;
  }

  return migrated;
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
