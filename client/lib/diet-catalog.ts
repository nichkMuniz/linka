const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";

export type CatalogMeal = {
  id: number;
  name: string;
  description: string;
  category: string;
  image: string | null;
  imageThumbnail: string | null;
};

// English category → Portuguese
const CATEGORY_PT: Record<string, string> = {
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

// In-memory cache
let cachedMeals: CatalogMeal[] | null = null;

async function fetchFromApi(): Promise<CatalogMeal[]> {
  // 1. Get all categories
  const catRes = await fetch(`${MEALDB_BASE}/categories.php`);
  if (!catRes.ok) throw new Error("Failed to fetch categories");
  const catData = await catRes.json();
  const categories: Array<{ strCategory: string }> = catData.categories ?? [];

  // 2. Fetch all categories in parallel
  const results = await Promise.all(
    categories.map(async (cat) => {
      const catName = cat.strCategory;
      try {
        const res = await fetch(`${MEALDB_BASE}/filter.php?c=${encodeURIComponent(catName)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.meals ?? [])
          .filter((item: any) => item.strMeal && item.strMealThumb)
          .map((item: any): CatalogMeal => ({
            id: Number(item.idMeal),
            name: item.strMeal,
            description: "",
            category: CATEGORY_PT[catName] || catName,
            image: item.strMealThumb,
            imageThumbnail: `${item.strMealThumb}/preview`,
          }));
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

async function persistToDb(meals: CatalogMeal[]): Promise<void> {
  try {
    const { bulkUpsertCatalogDietsDb } = await import("@/lib/ritmofit-db");
    await bulkUpsertCatalogDietsDb(
      meals.map((m) => ({
        name: m.name,
        description: m.description,
        category: m.category,
        photo: m.image,
        mealdbId: m.id,
      }))
    );
  } catch (e) {
    console.warn("Could not persist meal catalog to DB:", e);
  }
}

async function loadFromDb(): Promise<CatalogMeal[]> {
  try {
    const { getCatalogDietsFromDb } = await import("@/lib/ritmofit-db");
    const rows = await getCatalogDietsFromDb();
    return rows.map((row) => ({
      id: row.mealdbId ?? 0,
      name: row.name,
      description: row.description,
      category: row.category,
      image: row.photo,
      imageThumbnail: row.photo ? `${row.photo}/preview` : null,
    }));
  } catch {
    return [];
  }
}

export async function fetchMealCatalog(): Promise<CatalogMeal[]> {
  if (cachedMeals) return cachedMeals;

  try {
    const apiMeals = await fetchFromApi();

    if (apiMeals.length > 0) {
      cachedMeals = apiMeals;
      // Persist in background
      persistToDb(apiMeals);
      return apiMeals;
    }
  } catch (e) {
    console.warn("TheMealDB API unavailable, falling back to DB:", e);
  }

  // API failed — load from DB
  const dbMeals = await loadFromDb();
  cachedMeals = dbMeals;
  return dbMeals;
}

// Search meals by first letter or name
export async function searchMealCatalog(term: string): Promise<CatalogMeal[]> {
  if (!term.trim()) return [];

  try {
    const res = await fetch(
      `${MEALDB_BASE}/search.php?s=${encodeURIComponent(term)}`
    );
    if (!res.ok) throw new Error("search failed");

    const data = await res.json();
    const items = data.meals ?? [];

    return items
      .filter((item: any) => item.strMeal && item.strMealThumb)
      .map((item: any) => ({
        id: Number(item.idMeal),
        name: item.strMeal,
        description: (item.strInstructions || "").slice(0, 200),
        category: CATEGORY_PT[item.strCategory] || item.strCategory || "",
        image: item.strMealThumb,
        imageThumbnail: `${item.strMealThumb}/preview`,
      }));
  } catch {
    // Fall back to filtering cached data
    const all = await fetchMealCatalog();
    const lower = term.toLowerCase();
    return all.filter((m) => m.name.toLowerCase().includes(lower)).slice(0, 20);
  }
}
