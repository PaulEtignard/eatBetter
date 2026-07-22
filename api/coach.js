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

  const { memberName, weekLabel, targets, dailyTotals, meals, plannedCount } = req.body || {}

  const targetLine = targets
    ? [
        targets.calories ? `${targets.calories} kcal` : null,
        targets.protein ? `${targets.protein} g protéines` : null,
        targets.carbs ? `${targets.carbs} g glucides` : null,
        targets.fat ? `${targets.fat} g lipides` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : 'aucun objectif défini'

  const daysSummary = (dailyTotals || [])
    .map(
      (d) =>
        `${d.label}: ${Math.round(d.calories)} kcal, P ${Math.round(d.protein)}g, G ${Math.round(
          d.carbs
        )}g, L ${Math.round(d.fat)}g${d.mealCount === 0 ? ' (rien de planifié)' : ` (${d.mealCount} repas)`}`
    )
    .join('\n')

  const mealsList = (meals || []).slice(0, 40).map((m) => `- ${m.name} (${m.slot})`).join('\n')

  const prompt = `Tu es un coach nutritionnel professionnel et bienveillant. Ton style : expertise réelle mais ton décontracté, direct, sans jargon inutile, tutoiement, jamais culpabilisant. Tu parles à ${memberName || 'la personne'}.

Voici sa semaine planifiée (${weekLabel}) :
Objectifs quotidiens : ${targetLine}
Nombre total de repas planifiés : ${plannedCount ?? 0}

Bilan jour par jour (ce qui est prévu) :
${daysSummary || 'Aucun repas planifié cette semaine.'}

Repas de la semaine :
${mealsList || 'aucun'}

Analyse cette semaine et réponds STRICTEMENT en JSON valide, sans texte autour, sans markdown, au format exact :
{
  "score": <entier 0-100 : qualité globale de la semaine au regard des objectifs et de l'équilibre>,
  "headline": "<une phrase d'accroche percutante et encourageante, max 90 caractères>",
  "highlights": ["<2 à 3 points positifs concrets et chiffrés>"],
  "improvements": ["<2 à 3 axes d'amélioration concrets, chiffrés et actionnables>"],
  "tips": ["<2 à 3 conseils pratiques et faciles à appliquer cette semaine>"],
  "macroVerdict": "<1 à 2 phrases sur l'équilibre protéines/glucides/lipides vs objectifs>"
}
Sois spécifique aux vrais chiffres ci-dessus (cite des jours, des écarts en grammes/kcal). Si peu de repas sont planifiés, encourage à remplir la semaine plutôt que de juger. Reste concret et motivant.`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eat-better-alpha.vercel.app',
        'X-Title': 'eatBetter - Coach',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 1200,
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
    res.status(200).json({ analysis: parsed })
  } catch (err) {
    res.status(200).json({ error: 'fetch_failed', detail: String(err).slice(0, 300) })
  }
}
