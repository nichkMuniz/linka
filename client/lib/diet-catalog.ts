export type CatalogMeal = {
  id: number;
  name: string;
  description: string;
  category: string;
  image: string | null;
  imageThumbnail: string | null;
};

export async function fetchMealCatalog(): Promise<CatalogMeal[]> {
  try {
    const { getCatalogDietsFromDb } = await import("@/lib/ritmofit-db");
    const rows = await getCatalogDietsFromDb();
    return rows.map((row) => ({
      id: row.mealdbId ?? 0,
      name: row.name,
      description: row.description,
      category: row.category,
      image: row.photo,
      imageThumbnail: row.photo,
    }));
  } catch {
    return [];
  }
}

export async function searchMealCatalog(term: string): Promise<CatalogMeal[]> {
  if (!term.trim()) return [];

  const all = await fetchMealCatalog();
  const lower = term.toLowerCase();
  return all.filter((m) => m.name.toLowerCase().includes(lower)).slice(0, 20);
}
