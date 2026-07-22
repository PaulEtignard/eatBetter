import { useEffect, useState, useMemo } from 'react'
import { SLOTS, mealMacros, applyOverrides, round } from './utils'

const SLOT_LABEL = { breakfast: 'petit-déj', lunch: 'déjeuner', snack: 'collation', dinner: 'dîner' }

export default function CoachModal({
  member,
  weekDays,
  weekLabel,
  plannedMeals,
  mealsById,
  overridesByPlacementId,
  onClose,
}) {
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')

  // Build the factual week summary for this member locally, so the AI only interprets it
  const summary = useMemo(() => {
    const isoSet = new Set(weekDays.map((d) => d.iso))
    const mine = plannedMeals.filter((p) => p.member_id === member.id && isoSet.has(p.plan_date))

    const dailyTotals = weekDays.map((day) => {
      const dayPlacements = mine.filter((p) => p.plan_date === day.iso)
      const totals = dayPlacements.reduce(
        (acc, p) => {
          const meal = mealsById[p.meal_id]
          if (!meal) return acc
          const m = mealMacros(applyOverrides(meal.ingredients, overridesByPlacementId[p.id]))
          acc.calories += m.calories
          acc.protein += m.protein
          acc.carbs += m.carbs
          acc.fat += m.fat
          return acc
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      )
      return { label: day.label, ...totals, mealCount: dayPlacements.length }
    })

    const mealsInWeek = mine
      .map((p) => {
        const meal = mealsById[p.meal_id]
        return meal ? { name: meal.name, slot: SLOT_LABEL[p.slot] || p.slot } : null
      })
      .filter(Boolean)

    return {
      memberName: member.display_name,
      weekLabel,
      targets: {
        calories: member.daily_calories_target,
        protein: member.daily_protein_target,
        carbs: member.daily_carbs_target,
        fat: member.daily_fat_target,
      },
      dailyTotals,
      meals: mealsInWeek,
      plannedCount: mine.length,
    }
  }, [weekDays, plannedMeals, member, mealsById, overridesByPlacementId, weekLabel])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(summary),
        })
        const data = await res.json()
        if (cancelled) return
        if (data.error === 'missing_api_key') {
          setError("La clé OpenRouter n'est pas configurée côté serveur (OPENROUTER_API_KEY sur Vercel).")
        } else if (data.error || !data.analysis) {
          setError("Le coach n'a pas pu analyser ta semaine. Réessaie dans un instant.")
        } else {
          setAnalysis(data.analysis)
        }
      } catch {
        if (!cancelled) setError('Impossible de contacter le coach. Vérifie ta connexion.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [summary])

  const avgCalories =
    summary.dailyTotals.filter((d) => d.mealCount > 0).length > 0
      ? summary.dailyTotals.reduce((s, d) => s + d.calories, 0) /
        summary.dailyTotals.filter((d) => d.mealCount > 0).length
      : 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal coach-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Coach de la semaine</h2>
            <p className="portion-subtitle">
              {member.display_name} · {weekLabel}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="coach-loading">
              <div className="coach-spinner" />
              <p>Ton coach analyse ta semaine…</p>
            </div>
          )}

          {error && !loading && <p className="auth-error">{error}</p>}

          {analysis && !loading && (
            <div className="coach-result">
              <div className="coach-score-block">
                <div className="coach-score-ring" style={ringStyle(analysis.score)}>
                  <span className="coach-score-value">{analysis.score}</span>
                  <span className="coach-score-max">/100</span>
                </div>
                <p className="coach-headline">{analysis.headline}</p>
              </div>

              {analysis.macroVerdict && (
                <div className="coach-macro-verdict">
                  <span className="coach-section-eyebrow">Équilibre</span>
                  <p>{analysis.macroVerdict}</p>
                </div>
              )}

              {Array.isArray(analysis.highlights) && analysis.highlights.length > 0 && (
                <div className="coach-section">
                  <span className="coach-section-eyebrow coach-eyebrow-good">Ce qui marche</span>
                  <ul className="coach-list">
                    {analysis.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(analysis.improvements) && analysis.improvements.length > 0 && (
                <div className="coach-section">
                  <span className="coach-section-eyebrow coach-eyebrow-warn">À ajuster</span>
                  <ul className="coach-list">
                    {analysis.improvements.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(analysis.tips) && analysis.tips.length > 0 && (
                <div className="coach-section">
                  <span className="coach-section-eyebrow">Conseils rapides</span>
                  <ul className="coach-list coach-tips">
                    {analysis.tips.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="coach-footnote">
                Basé sur {summary.plannedCount} repas planifiés · moyenne {round(avgCalories)} kcal/jour
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ringStyle(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0))
  const color = s >= 75 ? '#8fa998' : s >= 50 ? '#e8b930' : '#c1502e'
  return {
    background: `conic-gradient(${color} ${s * 3.6}deg, rgba(242,239,226,0.1) 0deg)`,
  }
}
