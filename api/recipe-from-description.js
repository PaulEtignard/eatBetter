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

  const { description, servings } = req.body || {}
  if (!description || description.trim().length < 3) {
    res.status(400).json({ error: 'missing_description' })
    return
  }

  const prompt = `Tu es un chef et nutritionniste. À partir de la description d'un plat, génère une recette structurée avec des quantités réalistes pour ${
    servings || 1
  } portion(s), et des valeurs nutritionnelles réalistes par 100g pour chaque ingrédient.

Description du plat : "${description.trim()}"

Réponds STRICTEMENT en JSON valide, sans texte autour, sans markdown, au format exact :
{
  "name": "<nom court et appétissant du plat>",
  "category": "<un de: breakfast, lunch, snack, dinner ou null>",
  "ingredients": [
    { "name": "<ingrédient>", "quantity": <nombre>, "unit": "<g|ml|pièce|cs|cc>", "calories_per_100g": <nombre>, "protein_per_100g": <nombre>, "carbs_per_100g": <nombre>, "fat_per_100g": <nombre>, "piece_weight_g": <nombre ou null> }
  ]
}
Règles :
- Quantités réalistes pour ${servings || 1} portion(s), en grammes de préférence (ml pour les liquides).
- Si unit="pièce" (ex. 2 oeufs), remplis "piece_weight_g" avec le poids en grammes d'UNE pièce (ex. 50 pour un oeuf), sinon mets-le à null.
- Les macros par 100g doivent être des estimations nutritionnelles réalistes et cohérentes.
- Inclus tous les ingrédients principaux (protéine, féculent, légumes, matière grasse, assaisonnement notable).
- Choisis "category" selon le type de plat, ou null si incertain.`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eat-better-alpha.vercel.app',
        'X-Title': 'eatBetter - Recipe from description',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 1500,
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

    if (!parsed.name || !Array.isArray(parsed.ingredients)) {
      res.status(200).json({ error: 'invalid_response' })
      return
    }

    res.status(200).json({ recipe: parsed })
  } catch (err) {
    res.status(200).json({ error: 'fetch_failed', detail: String(err).slice(0, 300) })
  }
}
