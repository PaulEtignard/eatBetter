import { useState } from 'react'
import { SLOTS } from './utils'

export default function GenerateMenuModal({ onCancel, onGenerate }) {
  const [dailyCalories, setDailyCalories] = useState(2200)
  const [dailyProtein, setDailyProtein] = useState(150)
  const [dailyCarbs, setDailyCarbs] = useState('')
  const [dailyFat, setDailyFat] = useState('')
  const [days, setDays] = useState(7)
  const [selectedSlots, setSelectedSlots] = useState(['breakfast', 'lunch', 'dinner'])
  const [preferences, setPreferences] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleSlot(key) {
    setSelectedSlots((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (selectedSlots.length === 0) {
      setError('Sélectionne au moins un type de repas.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onGenerate({
        days,
        dailyCalories: Number(dailyCalories),
        dailyProtein: Number(dailyProtein),
        dailyCarbs: dailyCarbs ? Number(dailyCarbs) : null,
        dailyFat: dailyFat ? Number(dailyFat) : null,
        slots: SLOTS.filter((s) => selectedSlots.includes(s.key)).map((s) => s.key),
        preferences: preferences.trim(),
      })
    } catch (err) {
      setError(err.message || "La génération a échoué. Réessaie dans un instant.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="modal generate-menu" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Générer un menu avec l'IA</h2>
          {!loading && (
            <button className="icon-btn" onClick={onCancel} aria-label="Fermer">
              ✕
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="generate-intro">
              Donne tes objectifs quotidiens, l'IA construit des repas complets (avec ingrédients et
              quantités) pour toute la semaine et les place directement sur ton calendrier.
            </p>

            <div className="macro-target-grid">
              <label className="field">
                Calories / jour
                <input
                  type="number"
                  min="800"
                  required
                  value={dailyCalories}
                  onChange={(e) => setDailyCalories(e.target.value)}
                />
              </label>
              <label className="field">
                Protéines / jour (g)
                <input
                  type="number"
                  min="0"
                  required
                  value={dailyProtein}
                  onChange={(e) => setDailyProtein(e.target.value)}
                />
              </label>
              <label className="field">
                Glucides / jour (g, optionnel)
                <input
                  type="number"
                  min="0"
                  value={dailyCarbs}
                  onChange={(e) => setDailyCarbs(e.target.value)}
                  placeholder="auto"
                />
              </label>
              <label className="field">
                Lipides / jour (g, optionnel)
                <input
                  type="number"
                  min="0"
                  value={dailyFat}
                  onChange={(e) => setDailyFat(e.target.value)}
                  placeholder="auto"
                />
              </label>
            </div>

            <label className="field">
              Nombre de jours
              <input
                type="number"
                min="1"
                max="14"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>

            <div className="field">
              <span>Repas à générer chaque jour</span>
              <div className="slot-checkboxes">
                {SLOTS.map((slot) => (
                  <label key={slot.key} className="slot-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSlots.includes(slot.key)}
                      onChange={() => toggleSlot(slot.key)}
                    />
                    {slot.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="field">
              Préférences / contraintes (optionnel)
              <textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Ex. sans porc, beaucoup de poisson, végétarien, pas de fruits à coque…"
                rows={2}
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            {loading && (
              <p className="generate-loading">
                Génération en cours… ça peut prendre 30 à 60 secondes pour une semaine complète.
              </p>
            )}
          </div>

          <div className="modal-footer">
            <span />
            <div className="modal-footer-right">
              <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Génération…' : 'Générer le menu'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
