import { searchCommonIngredients } from './commonIngredients'

// Looks up an ingredient's macro profile (per 100g), in three tiers:
// 1. Local common-foods table (instant, covers raw fruit/veg/meat OFF handles poorly)
// 2. Open Food Facts API via our own serverless proxy (avoids the browser CORS restriction)
// 3. AI estimate (only if the first two found nothing) via a serverless OpenRouter proxy
export async function searchIngredientMacros(term) {
  if (!term || term.trim().length < 2) return []

  const localMatches = searchCommonIngredients(term)

  let apiMatches = []
  try {
    apiMatches = await searchOpenFoodFactsAPI(term)
  } catch {
    apiMatches = []
  }

  const localNames = new Set(localMatches.map((m) => m.name.toLowerCase()))
  const dedupedApiMatches = apiMatches.filter((m) => !localNames.has(m.name.toLowerCase()))

  const combined = [...localMatches, ...dedupedApiMatches]
  if (combined.length > 0) return combined

  // Nothing found locally or via Open Food Facts: ask the AI as a last resort
  try {
    const aiMatch = await searchAIFallback(term)
    return aiMatch ? [aiMatch] : []
  } catch {
    return []
  }
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

async function searchAIFallback(term) {
  const res = await fetch(`/api/ai-macros?name=${encodeURIComponent(term)}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.result || data.result.calories_per_100g == null) return null
  return { ...data.result, code: null }
}
