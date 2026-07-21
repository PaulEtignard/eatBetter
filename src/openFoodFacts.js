// Looks up an ingredient on Open Food Facts and returns candidate macro profiles (per 100g)
export async function searchOpenFoodFacts(term) {
  if (!term || term.trim().length < 2) return []
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    term
  )}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,code,nutriments`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Recherche Open Food Facts impossible')
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
