// Looks up an ingredient's macro profile (per 100g) via our own serverless proxy,
// which calls Open Food Facts server-side to avoid the browser CORS restriction.
export async function searchOpenFoodFacts(term) {
  if (!term || term.trim().length < 2) return []

  const res = await fetch(`/api/off-search?q=${encodeURIComponent(term)}`)
  if (!res.ok) throw new Error('Recherche de macros impossible')
  const data = await res.json()
  const products = data.products || []

  return products
    .filter((p) => p.product_name && p.nutriments)
    .map((p) => ({
      code: p.code,
      name: p.product_name,
      calories_per_100g: p.nutriments['energy-kcal_100g'] ?? p.nutriments['energy-kcal'] ?? null,
      protein_per_100g: p.nutriments['proteins_100g'] ?? null,
      carbs_per_100g: p.nutriments['carbohydrates_100g'] ?? null,
      fat_per_100g: p.nutriments['fat_100g'] ?? null,
    }))
    .filter((p) => p.calories_per_100g != null)
}
