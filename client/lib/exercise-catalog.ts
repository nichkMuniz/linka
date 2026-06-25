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
