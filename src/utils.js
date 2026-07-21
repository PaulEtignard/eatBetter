export const SLOTS = [
  { key: 'breakfast', label: 'Petit-déj' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'snack', label: 'Collation' },
  { key: 'dinner', label: 'Dîner' },
]

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Returns the Monday of the week containing `date`
export function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDays(mondayDate) {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      iso: toISODate(d),
      label: DAY_LABELS[i],
      shortLabel: `${DAY_LABELS[i].slice(0, 3)} ${d.getDate()}`,
    })
  }
  return days
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function formatWeekRange(monday) {
  const sunday = addDays(monday, 6)
  const opts = { day: 'numeric', month: 'long' }
  return `${monday.toLocaleDateString('fr-FR', opts)} — ${sunday.toLocaleDateString('fr-FR', opts)}`
}

// Compute totals for one meal from its ingredients (per full recipe, not per 100g)
export function mealMacros(ingredients) {
  return ingredients.reduce(
    (acc, ing) => {
      const factor = (Number(ing.quantity) || 0) / 100
      acc.calories += (Number(ing.calories_per_100g) || 0) * factor
      acc.protein += (Number(ing.protein_per_100g) || 0) * factor
      acc.carbs += (Number(ing.carbs_per_100g) || 0) * factor
      acc.fat += (Number(ing.fat_per_100g) || 0) * factor
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

export function round(n) {
  return Math.round(n * 10) / 10
}

// Merges base recipe ingredients with per-placement quantity overrides (per-person portions)
export function applyOverrides(ingredients, overrides) {
  if (!overrides || overrides.length === 0) return ingredients
  const overrideMap = new Map(overrides.map((o) => [o.meal_ingredient_id, o.quantity]))
  return ingredients.map((ing) => (overrideMap.has(ing.id) ? { ...ing, quantity: overrideMap.get(ing.id) } : ing))
}
