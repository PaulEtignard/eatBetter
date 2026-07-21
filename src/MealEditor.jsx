import { useState } from 'react'
import IngredientRow from './IngredientRow'
import { mealMacros, round } from './utils'

const COLORS = ['#e8b930', '#c1502e', '#8fa998', '#5b7a9d', '#a86fb0']

let tempId = 0
function nextId() {
  tempId -= 1
  return `tmp-${tempId}`
}

function emptyIngredient() {
  return {
    id: nextId(),
    name: '',
    quantity: 100,
    unit: 'g',
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fat_per_100g: '',
    off_code: null,
  }
}

export default function MealEditor({ initialMeal, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(initialMeal?.name || '')
  const [notes, setNotes] = useState(initialMeal?.notes || '')
  const [color, setColor] = useState(initialMeal?.color || COLORS[0])
  const [ingredients, setIngredients] = useState(
    initialMeal?.ingredients?.length ? initialMeal.ingredients.map((i) => ({ ...i })) : [emptyIngredient()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateIngredient(id, patch) {
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)))
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, emptyIngredient()])
  }

  function removeIngredient(id) {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id))
  }

  const totals = mealMacros(ingredients)

  async function handleSave() {
    if (!name.trim()) {
      setError('Donne un nom à ce repas.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), notes, color, ingredients })
    } catch (e) {
      setError(e.message || "Impossible d'enregistrer ce repas")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal meal-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initialMeal ? 'Modifier le repas' : 'Nouveau repas'}</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="meal-basics">
            <label className="field field-name">
              Nom du repas
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Poulet rôti & légumes"
                autoFocus
              />
            </label>

            <div className="field field-color">
              <span>Étiquette</span>
              <div className="color-picker">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${color === c ? 'is-selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="field">
            Notes (optionnel)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Préparation, astuces…"
              rows={2}
            />
          </label>

          <div className="ingredients-section">
            <div className="ingredients-header">
              <h3>Ingrédients</h3>
              <span className="macro-pill">
                {round(totals.calories)} kcal · {round(totals.protein)}g prot · {round(totals.carbs)}g gluc ·{' '}
                {round(totals.fat)}g lip
              </span>
            </div>

            <div className="ingredients-list">
              {ingredients.map((ing) => (
                <IngredientRow
                  key={ing.id}
                  ingredient={ing}
                  onChange={(patch) => updateIngredient(ing.id, patch)}
                  onRemove={() => removeIngredient(ing.id)}
                />
              ))}
            </div>

            <button type="button" className="btn btn-ghost add-ingredient-btn" onClick={addIngredient}>
              + Ajouter un ingrédient
            </button>
          </div>

          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="modal-footer">
          {initialMeal ? (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(initialMeal.id)}>
              Supprimer ce repas
            </button>
          ) : (
            <span />
          )}
          <div className="modal-footer-right">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
