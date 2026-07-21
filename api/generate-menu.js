export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(200).json({ error: 'missing_api_key' })
    return
  }

  const {
    days = 7,
    dailyCalories,
    dailyProtein,
    dailyCarbs,
    dailyFat,
    slots = ['breakfast', 'lunch', 'dinner'],
    preferences = '',
    existingMeals = [],
  } = req.body || {}

  if (!dailyCalories || !dailyProtein) {
    res.status(400).json({ error: 'missing_targets' })
    return
  }

  const slotLabels = {
    breakfast: 'petit-déjeuner',
    lunch: 'déjeuner',
    snack: 'collation',
    dinner: 'dîner',
  }
  const slotList = slots.map((s) => slotLabels[s] || s).join(', ')

  const macroLine = [
    `${dailyCalories} kcal`,
    `${dailyProtein} g de protéines`,
    dailyCarbs ? `${dailyCarbs} g de glucides` : null,
    dailyFat ? `${dailyFat} g de lipides` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const existingList = existingMeals
    .slice(0, 60)
    .map((m) => `- "${m.name}" (${m.category || 'tous types'}, ${m.calories} kcal/portion)`)
    .join('\n')

  const reuseInstructions = existingList
    ? `Recettes déjà existantes dans le foyer, à réutiliser en priorité quand elles conviennent au repas et aux objectifs (économise du travail de génération) :
${existingList}
Pour un repas qui réutilise une recette EXACTEMENT telle quelle, réponds pour ce repas avec {"slot": "...", "reuse": "Nom exact de la recette existante"} au lieu du champ "ingredients". N'utilise "reuse" que si le nom correspond EXACTEMENT à une recette listée ci-dessus.`
    : ''

  const prompt = `Tu es un nutritionniste qui construit un plan de repas pour ${days} jours consécutifs.
Objectif nutritionnel PAR JOUR (à répartir sur l'ensemble des repas du jour, tolérance +/-8%) : ${macroLine}.
Repas à générer chaque jour, dans cet ordre : ${slotList}.
${preferences ? `Préférences/contraintes à respecter impérativement : ${preferences}.` : ''}
${reuseInstructions}
Varie les recettes d'un jour à l'autre (ne répète pas le même repas plus de 2 fois sur la semaine). Cuisine familiale simple et réaliste, ingrédients courants, quantités en grammes (ou ml/pièce quand pertinent) réalistes pour une portion.

Réponds STRICTEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, au format exact :
{
  "days": [
    {
      "meals": [
        {
          "slot": "breakfast",
          "name": "Nom du repas",
          "ingredients": [
            { "name": "Nom de l'ingrédient", "quantity": 100, "unit": "g", "calories_per_100g": 0, "protein_per_100g": 0, "carbs_per_100g": 0, "fat_per_100g": 0 }
          ]
        }
      ]
    }
  ]
}
Le tableau "days" doit contenir exactement ${days} éléments, dans l'ordre chronologique. Les valeurs de macros par 100g doivent être des estimations nutritionnelles réalistes pour chaque ingrédient. L'unité doit être une de: g, ml, pièce, cs, cc.
Rappel : un repas qui réutilise une recette existante n'a PAS besoin du champ "ingredients", juste {"slot": "...", "reuse": "Nom exact"}.`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eat-better-alpha.vercel.app',
        'X-Title': 'Le Menu - Meal Planner',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiRes.ok) {
      const text = await aiRes.text()
      res.status(200).json({ error: 'ai_error', detail: text.slice(0, 300) })
      return
    }

    const data = await aiRes.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed.days)) {
      res.status(200).json({ error: 'invalid_response' })
      return
    }

    res.status(200).json({ days: parsed.days })
  } catch (err) {
    res.status(200).json({ error: 'fetch_failed', detail: String(err).slice(0, 300) })
  }
}
