export type CatalogExercise = {
  id: number;
  name: string;
  description: string;
  category: string;
  image: string | null;
  imageThumbnail: string | null;
  muscles: string[];
};

export async function fetchExerciseCatalog(): Promise<CatalogExercise[]> {
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
  }

  return migrated;
}

export async function searchExerciseCatalog(term: string): Promise<CatalogExercise[]> {
  if (!term.trim()) return [];

  const all = await fetchExerciseCatalog();
  const lower = term.toLowerCase();
  return all.filter((ex) => ex.name.toLowerCase().includes(lower)).slice(0, 20);
}
