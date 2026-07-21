export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  console.log('[generate-menu] incoming request', { method: req.method })

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  console.log('[generate-menu] OPENROUTER_API_KEY present:', Boolean(apiKey))
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

  console.log('[generate-menu] params', { days, dailyCalories, dailyProtein, dailyCarbs, dailyFat, slots, preferences, existingMealsCount: existingMeals.length })

  if (!dailyCalories || !dailyProtein) {
    console.warn('[generate-menu] missing_targets', { dailyCalories, dailyProtein })
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
    ? `Recettes déjà existantes dans le foyer et encore disponibles à la réutilisation (celles trop souvent utilisées cette semaine ne sont plus listées ici) :
${existingList}
Pour un repas qui réutilise une recette EXACTEMENT telle quelle, réponds pour ce repas avec {"slot": "...", "reuse": "Nom exact de la recette existante"} au lieu du champ "ingredients". N'utilise "reuse" que si le nom correspond EXACTEMENT à une recette listée ci-dessus, et seulement si elle convient vraiment à ce repas et ces objectifs — sinon invente un nouveau repas. La variété prime sur la réutilisation.`
    : ''

  const prompt = `Tu es un nutritionniste qui construit un plan de repas pour ${days} jours consécutifs.
Objectif nutritionnel PAR JOUR (à répartir sur l'ensemble des repas du jour, tolérance +/-8%) : ${macroLine}.
Repas à générer chaque jour, dans cet ordre : ${slotList}.
${preferences ? `Préférences/contraintes à respecter impérativement : ${preferences}.` : ''}
${reuseInstructions}
Varie les recettes autant que possible d'un jour à l'autre et entre petit-déjeuner/déjeuner/dîner/collation : la variété est l'objectif principal, plus important que l'optimisation exacte des macros. Cuisine familiale simple et réaliste, ingrédients courants, quantités en grammes (ou ml/pièce quand pertinent) réalistes pour une portion.

Consignes de variété par type de repas — NE PAS proposer le même type de plat deux fois sur toute la période. Regarde la liste des recettes existantes ci-dessus (s'il y en a) : si un type de plat y figure déjà pour une catégorie donnée (ex. une omelette en "breakfast"), NE PROPOSE PAS un autre plat du même type pour cette catégorie, choisis autre chose dans la liste ci-dessous.
- Petit-déjeuner : alterne entre porridge/flocons d'avoine, tartines (beurre/confiture/fromage), pancakes ou gaufres, smoothie ou smoothie bowl, yaourt/skyr avec fruits et granola, oeufs brouillés ou pochés, pain perdu, muesli, fromage blanc. N'utilise une omelette qu'UNE SEULE fois maximum sur toute la période, jamais deux jours de suite, et jamais si une omelette apparaît déjà dans la liste des recettes existantes ci-dessus.
- Déjeuner et dîner : alterne les sources de protéines (poulet, boeuf, porc, poisson, oeufs, légumineuses, tofu) et les styles de cuisine (française, italienne, méditerranéenne, asiatique, mexicaine, orientale). Évite de répéter la même association protéine+féculent (ex. "poulet + riz" puis encore "poulet + riz") deux fois dans la semaine.
- Collation : varie entre fruits, yaourts, oléagineux, barres protéinées maison, compotes, fromage.

Réponds STRICTEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, au format exact :
{
  "days": [
    {
      "meals": [
        {
          "slot": "breakfast",
          "name": "Nom du repas",
          "ingredients": [
            { "name": "Nom de l'ingrédient", "quantity": 100, "unit": "g", "calories_per_100g": 0, "protein_per_100g": 0, "carbs_per_100g": 0, "fat_per_100g": 0, "piece_weight_g": null }
          ]
        }
      ]
    }
  ]
}
Le tableau "days" doit contenir exactement ${days} éléments, dans l'ordre chronologique. Les valeurs de macros par 100g doivent être des estimations nutritionnelles réalistes pour chaque ingrédient. L'unité doit être une de: g, ml, pièce, cs, cc.
Si l'unité est "pièce" (ex. 2 oeufs, 1 banane), remplis obligatoirement "piece_weight_g" avec le poids réaliste en grammes d'UNE pièce de cet ingrédient précis (ex. 50 pour un oeuf, 120 pour une banane) — sinon laisse "piece_weight_g" à null.
Rappel : un repas qui réutilise une recette existante n'a PAS besoin du champ "ingredients", juste {"slot": "...", "reuse": "Nom exact"}.`

  const startedAt = Date.now()
  try {
    console.log('[generate-menu] calling OpenRouter…')
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
        temperature: 0.75,
        max_tokens: Math.min(6000, days * 900 + 400),
        response_format: { type: 'json_object' },
      }),
    })

    console.log('[generate-menu] OpenRouter responded', { status: aiRes.status, ms: Date.now() - startedAt })

    if (!aiRes.ok) {
      const text = await aiRes.text()
      console.error('[generate-menu] OpenRouter error body:', text.slice(0, 1000))
      res.status(200).json({ error: 'ai_error', detail: text.slice(0, 300) })
      return
    }

    const data = await aiRes.json()
    const raw = data.choices?.[0]?.message?.content || ''
    console.log('[generate-menu] raw content length:', raw.length)
    const cleaned = raw.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[generate-menu] JSON.parse failed:', String(parseErr), 'raw (first 500 chars):', cleaned.slice(0, 500))
      res.status(200).json({ error: 'invalid_response', detail: 'json_parse_failed' })
      return
    }

    if (!Array.isArray(parsed.days)) {
      console.error('[generate-menu] parsed.days is not an array:', JSON.stringify(parsed).slice(0, 500))
      res.status(200).json({ error: 'invalid_response', detail: 'no_days_array' })
      return
    }

    console.log('[generate-menu] success, days:', parsed.days.length, 'total ms:', Date.now() - startedAt)
    res.status(200).json({ days: parsed.days })
  } catch (err) {
    console.error('[generate-menu] fetch_failed exception:', err && err.stack ? err.stack : String(err), 'ms elapsed:', Date.now() - startedAt)
    res.status(200).json({ error: 'fetch_failed', detail: String(err).slice(0, 300) })
  }
}
