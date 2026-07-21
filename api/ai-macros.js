export default async function handler(req, res) {
  const name = (req.query.name || '').toString().trim()

  if (name.length < 2) {
    res.status(200).json({ result: null })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(200).json({ result: null, error: 'missing_api_key' })
    return
  }

  const prompt = `Donne les valeurs nutritionnelles moyennes pour 100g de l'aliment suivant, sous forme brute/cuite standard (préparation la plus courante) : "${name}".
Réponds STRICTEMENT avec un objet JSON, sans aucun texte autour, sans balises markdown, au format exact :
{"name": "nom normalisé en français", "calories_per_100g": nombre, "protein_per_100g": nombre, "carbs_per_100g": nombre, "fat_per_100g": nombre}
Si l'aliment n'est pas identifiable ou n'est pas un aliment, réponds exactement: {"name": null}`

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
        temperature: 0.2,
        max_tokens: 200,
      }),
    })

    if (!aiRes.ok) {
      res.status(200).json({ result: null, error: 'ai_error' })
      return
    }

    const data = await aiRes.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!parsed.name) {
      res.status(200).json({ result: null })
      return
    }

    res.status(200).json({
      result: {
        name: parsed.name,
        calories_per_100g: Number(parsed.calories_per_100g) || null,
        protein_per_100g: Number(parsed.protein_per_100g) || null,
        carbs_per_100g: Number(parsed.carbs_per_100g) || null,
        fat_per_100g: Number(parsed.fat_per_100g) || null,
        source: 'ai',
      },
    })
  } catch (err) {
    res.status(200).json({ result: null, error: 'fetch_failed' })
  }
}
