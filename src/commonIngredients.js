// Open Food Facts is a barcoded-product database, so raw whole foods (fruit, veg, plain meat)
// are poorly covered. This small curated table (macros per 100g) is checked first and
// instantly, before falling back to the Open Food Facts API for branded/packaged items.
export const COMMON_INGREDIENTS = [
  { name: 'Banane', calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 22.8, fat_per_100g: 0.3 },
  { name: 'Pomme', calories_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 13.8, fat_per_100g: 0.2 },
  { name: 'Orange', calories_per_100g: 47, protein_per_100g: 0.9, carbs_per_100g: 11.8, fat_per_100g: 0.1 },
  { name: 'Citron', calories_per_100g: 29, protein_per_100g: 1.1, carbs_per_100g: 9.3, fat_per_100g: 0.3 },
  { name: 'Avocat', calories_per_100g: 160, protein_per_100g: 2, carbs_per_100g: 8.5, fat_per_100g: 14.7 },
  { name: 'Fraise', calories_per_100g: 32, protein_per_100g: 0.7, carbs_per_100g: 7.7, fat_per_100g: 0.3 },
  { name: 'Poulet blanc cru', calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
  { name: 'Boeuf haché 5%', calories_per_100g: 137, protein_per_100g: 21, carbs_per_100g: 0, fat_per_100g: 5 },
  { name: 'Saumon cru', calories_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 13 },
  { name: 'Oeuf', calories_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11 },
  { name: 'Riz blanc cru', calories_per_100g: 365, protein_per_100g: 7.1, carbs_per_100g: 80, fat_per_100g: 0.7 },
  { name: 'Riz basmati cru', calories_per_100g: 350, protein_per_100g: 7.5, carbs_per_100g: 78, fat_per_100g: 0.6 },
  { name: 'Pâtes crues', calories_per_100g: 371, protein_per_100g: 13, carbs_per_100g: 75, fat_per_100g: 1.5 },
  { name: 'Pomme de terre', calories_per_100g: 77, protein_per_100g: 2, carbs_per_100g: 17, fat_per_100g: 0.1 },
  { name: 'Pain complet', calories_per_100g: 247, protein_per_100g: 9, carbs_per_100g: 41, fat_per_100g: 3.4 },
  { name: 'Tomate', calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2 },
  { name: 'Oignon', calories_per_100g: 40, protein_per_100g: 1.1, carbs_per_100g: 9.3, fat_per_100g: 0.1 },
  { name: 'Carotte', calories_per_100g: 41, protein_per_100g: 0.9, carbs_per_100g: 9.6, fat_per_100g: 0.2 },
  { name: 'Brocoli', calories_per_100g: 34, protein_per_100g: 2.8, carbs_per_100g: 6.6, fat_per_100g: 0.4 },
  { name: 'Courgette', calories_per_100g: 17, protein_per_100g: 1.2, carbs_per_100g: 3.1, fat_per_100g: 0.3 },
  { name: 'Épinards', calories_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4 },
  { name: 'Poivron', calories_per_100g: 31, protein_per_100g: 1, carbs_per_100g: 6, fat_per_100g: 0.3 },
  { name: 'Champignon', calories_per_100g: 22, protein_per_100g: 3.1, carbs_per_100g: 3.3, fat_per_100g: 0.3 },
  { name: 'Ail', calories_per_100g: 149, protein_per_100g: 6.4, carbs_per_100g: 33, fat_per_100g: 0.5 },
  { name: 'Yaourt nature', calories_per_100g: 61, protein_per_100g: 3.5, carbs_per_100g: 4.7, fat_per_100g: 3.3 },
  { name: 'Fromage blanc', calories_per_100g: 68, protein_per_100g: 7.5, carbs_per_100g: 4, fat_per_100g: 2 },
  { name: 'Lait demi-écrémé', calories_per_100g: 46, protein_per_100g: 3.3, carbs_per_100g: 4.8, fat_per_100g: 1.6 },
  { name: "Huile d'olive", calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100 },
  { name: 'Beurre', calories_per_100g: 717, protein_per_100g: 0.9, carbs_per_100g: 0.1, fat_per_100g: 81 },
  { name: 'Amandes', calories_per_100g: 579, protein_per_100g: 21, carbs_per_100g: 22, fat_per_100g: 50 },
  { name: 'Lentilles cuites', calories_per_100g: 116, protein_per_100g: 9, carbs_per_100g: 20, fat_per_100g: 0.4 },
  { name: 'Pois chiches cuits', calories_per_100g: 164, protein_per_100g: 8.9, carbs_per_100g: 27, fat_per_100g: 2.6 },
  { name: 'Haricots verts', calories_per_100g: 31, protein_per_100g: 1.8, carbs_per_100g: 7, fat_per_100g: 0.1 },
  { name: 'Concombre', calories_per_100g: 15, protein_per_100g: 0.7, carbs_per_100g: 3.6, fat_per_100g: 0.1 },
]

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .trim()
}

// Returns local matches whose name contains the search term (or vice versa for short terms)
export function searchCommonIngredients(term) {
  const needle = normalize(term)
  if (needle.length < 2) return []
  return COMMON_INGREDIENTS.filter((item) => normalize(item.name).includes(needle)).map((item) => ({
    ...item,
    code: null,
    source: 'local',
  }))
}
