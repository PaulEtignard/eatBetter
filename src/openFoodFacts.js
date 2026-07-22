import { supabase } from './supabaseClient'
import { searchCommonIngredients } from './commonIngredients'

export function normalizeIngredientName(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Looks up an ingredient's macro profile (per 100g), in three tiers:
// 1. Local common-foods table (instant, covers raw fruit/veg/meat OFF handles poorly)
// 2. Shared ingredient cache (previously confirmed by a person, reused for free)
// 3. Open Food Facts API via our own serverless proxy (avoids the browser CORS restriction)
export async function searchIngredientMacros(term) {
  if (!term || term.trim().length < 2) return []

  const localMatches = searchCommonIngredients(term)

  let cacheMatches = []
  try {
    cacheMatches = await searchIngredientCache(term)
  } catch {
    cacheMatches = []
  }

  let apiMatches = []
  try {
    apiMatches = await searchOpenFoodFactsAPI(term)
  } catch {
    apiMatches = []
  }

  const seenNames = new Set([
    ...localMatches.map((m) => m.name.toLowerCase()),
    ...cacheMatches.map((m) => m.name.toLowerCase()),
  ])
  const dedupedApiMatches = apiMatches.filter((m) => !seenNames.has(m.name.toLowerCase()))

  return [...localMatches, ...cacheMatches, ...dedupedApiMatches]
}

async function searchIngredientCache(term) {
  const needle = normalizeIngredientName(term)
  if (needle.length < 2) return []
  const { data, error } = await supabase
    .from('ingredient_macro_cache')
    .select('name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source')
    .ilike('normalized_name', `%${needle}%`)
    .limit(6)
  if (error) throw error
  return (data || [])
    .filter((row) => row.calories_per_100g != null)
    .map((row) => ({
      code: null,
      name: row.name,
      calories_per_100g: row.calories_per_100g,
      protein_per_100g: row.protein_per_100g,
      carbs_per_100g: row.carbs_per_100g,
      fat_per_100g: row.fat_per_100g,
      source: 'cached',
    }))
}

// Persists an ingredient's final macros (after any manual correction) into the shared
// cache so future searches for the same name are instant, whatever their origin.
export async function cacheIngredientMacros(ingredients) {
  const rows = ingredients
    .filter((ing) => ing.name && ing.name.trim() && ing.calories_per_100g !== '' && ing.calories_per_100g != null)
    .map((ing) => ({
      name: ing.name.trim(),
      normalized_name: normalizeIngredientName(ing.name),
      calories_per_100g: Number(ing.calories_per_100g),
      protein_per_100g: ing.protein_per_100g === '' || ing.protein_per_100g == null ? null : Number(ing.protein_per_100g),
      carbs_per_100g: ing.carbs_per_100g === '' || ing.carbs_per_100g == null ? null : Number(ing.carbs_per_100g),
      fat_per_100g: ing.fat_per_100g === '' || ing.fat_per_100g == null ? null : Number(ing.fat_per_100g),
      source: ing.off_code ? 'off' : 'manual',
      updated_at: new Date().toISOString(),
    }))
  if (rows.length === 0) return
  try {
    await supabase.from('ingredient_macro_cache').upsert(rows, { onConflict: 'normalized_name' })
  } catch (err) {
    console.error('[cacheIngredientMacros] failed to cache ingredients:', err)
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
      brand: (p.brands || '').split(',')[0]?.trim() || null,
      image: p.image_front_small_url || null,
      nutriscore: p.nutriscore_grade && p.nutriscore_grade !== 'unknown' ? p.nutriscore_grade : null,
      calories_per_100g: p.nutriments['energy-kcal_100g'] ?? p.nutriments['energy-kcal'] ?? null,
      protein_per_100g: p.nutriments['proteins_100g'] ?? null,
      carbs_per_100g: p.nutriments['carbohydrates_100g'] ?? null,
      fat_per_100g: p.nutriments['fat_100g'] ?? null,
      source: 'off',
    }))
    .filter((p) => p.calories_per_100g != null)
}
