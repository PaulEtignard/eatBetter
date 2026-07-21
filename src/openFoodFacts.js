import { searchCommonIngredients } from './commonIngredients'

// Looks up an ingredient's macro profile (per 100g): local common-foods table first
// (instant, covers raw fruit/veg/meat that Open Food Facts poorly covers), then the
// Open Food Facts API via our own serverless proxy (avoids the browser CORS restriction).
export async function searchIngredientMacros(term) {
  if (!term || term.trim().length < 2) return []

  const localMatches = searchCommonIngredients(term)

  let apiMatches = []
  try {
    apiMatches = await searchOpenFoodFactsAPI(term)
  } catch {
    apiMatches = []
  }

  // Avoid showing near-duplicate entries when a local match already covers a name
  const localNames = new Set(localMatches.map((m) => m.name.toLowerCase()))
  const dedupedApiMatches = apiMatches.filter((m) => !localNames.has(m.name.toLowerCase()))

  return [...localMatches, ...dedupedApiMatches]
}

async function searchOpenFoodFactsAPI(term) {
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
      source: 'off',
    }))
    .filter((p) => p.calories_per_100g != null)
}
