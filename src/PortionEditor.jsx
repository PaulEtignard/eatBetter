import { useState } from 'react'
import { mealMacros, round } from './utils'

export default function PortionEditor({ placement, meal, memberName, initialOverrides, onClose, onSave, onEditRecipe }) {
  const [quantities, setQuantities] = useState(() => {
    const map = {}
    meal.ingredients.forEach((ing) => {
      const override = initialOverrides.find((o) => o.meal_ingredient_id === ing.id)
      map[ing.id] = override ? override.quantity : ing.quantity
    })
    return map
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateQty(ingId, value) {
    setQuantities((prev) => ({ ...prev, [ingId]: value }))
  }

  const effectiveIngredients = meal.ingredients.map((ing) => ({
    ...ing,
    quantity: quantities[ing.id] === '' ? 0 : Number(quantities[ing.id]) || 0,
  }))
  const totals = mealMacros(effectiveIngredients)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const overrides = meal.ingredients
        .filter((ing) => Number(quantities[ing.id]) !== Number(ing.quantity))
        .map((ing) => ({
          meal_ingredient_id: ing.id,
          quantity: Number(quantities[ing.id]) || 0,
        }))
      await onSave(overrides)
      onClose()
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer cette portion")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal portion-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{meal.name}</h2>
            <p className="portion-subtitle">Portion de {memberName}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <span className="macro-pill">
            {round(totals.calories)} kcal · {round(totals.protein)}g prot · {round(totals.carbs)}g gluc ·{' '}
            {round(totals.fat)}g lip
          </span>

          <div className="portion-ingredients">
            {meal.ingredients.map((ing) => (
              <div key={ing.id} className="portion-ingredient-row">
                <span className="portion-ingredient-name">{ing.name}</span>
                <input
                  type="number"
                  min="0"
                  value={quantities[ing.id]}
                  onChange={(e) => updateQty(ing.id, e.target.value)}
                />
                <span className="portion-ingredient-unit">{ing.unit}</span>
              </div>
            ))}
          </div>

          <button type="button" className="ing-manual-toggle" onClick={() => onEditRecipe(meal)}>
            Modifier la recette partagée (affecte tout le foyer)
          </button>

          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <span />
          <div className="modal-footer-right">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer cette portion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
