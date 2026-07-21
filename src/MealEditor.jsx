import { useState } from 'react'
import { searchOpenFoodFacts } from './openFoodFacts'
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
  const [lookupFor, setLookupFor] = useState(null) // ingredient id currently searching
  const [lookupResults, setLookupResults] = useState([])
  const [lookupLoading, setLookupLoading] = useState(false)
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

  async function runLookup(ing) {
    setLookupFor(ing.id)
    setLookupResults([])
    setLookupLoading(true)
    try {
      const results = await searchOpenFoodFacts(ing.name)
      setLookupResults(results)
    } catch (e) {
      setLookupResults([])
    } finally {
      setLookupLoading(false)
    }
  }

  function applyLookupResult(ingId, result) {
    updateIngredient(ingId, {
      calories_per_100g: result.calories_per_100g ?? '',
      protein_per_100g: result.protein_per_100g ?? '',
      carbs_per_100g: result.carbs_per_100g ?? '',
      fat_per_100g: result.fat_per_100g ?? '',
      off_code: result.code || null,
    })
    setLookupFor(null)
    setLookupResults([])
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
          <button className="icon-btn" onClick={onCancel} aria-label="Fermer">✕</button>
        </div>

        <div className="modal-body">
          <label className="field">
            Nom du repas
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Poulet rôti & légumes"
              autoFocus
            />
          </label>

          <div className="field">
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
                {round(totals.calories)} kcal · {round(totals.protein)}g prot · {round(totals.carbs)}g gluc · {round(totals.fat)}g lip
              </span>
            </div>

            {ingredients.map((ing) => (
              <div key={ing.id} className="ingredient-row">
                <input
                  className="ing-name"
                  placeholder="Ingrédient (ex. riz basmati)"
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                />
                <input
                  className="ing-qty"
                  type="number"
                  min="0"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(ing.id, { quantity: e.target.value })}
                />
                <select
                  className="ing-unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="pièce">pièce</option>
                  <option value="cs">c. à soupe</option>
                  <option value="cc">c. à café</option>
                </select>

                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => runLookup(ing)}
                  disabled={!ing.name.trim()}
                  title="Chercher les macros sur Open Food Facts"
                >
                  🔎 Macros
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeIngredient(ing.id)}
                  aria-label="Retirer l'ingrédient"
                >
                  🗑
                </button>

                {(ing.calories_per_100g !== '' && ing.calories_per_100g != null) && (
                  <div className="ing-macro-readout">
                    {round(ing.calories_per_100g)} kcal/100g · P {round(ing.protein_per_100g) || 0} · G{' '}
                    {round(ing.carbs_per_100g) || 0} · L {round(ing.fat_per_100g) || 0}
                  </div>
                )}

                {lookupFor === ing.id && (
                  <div className="lookup-panel">
                    {lookupLoading && <p className="lookup-loading">Recherche en cours…</p>}
                    {!lookupLoading && lookupResults.length === 0 && (
                      <p className="lookup-empty">Aucun résultat. Tu peux saisir les macros à la main ci-dessous.</p>
                    )}
                    {!lookupLoading &&
                      lookupResults.map((r, idx) => (
                        <button
                          type="button"
                          key={r.code || idx}
                          className="lookup-result"
                          onClick={() => applyLookupResult(ing.id, r)}
                        >
                          <span className="lookup-result-name">{r.name}</span>
                          <span className="lookup-result-macro">{round(r.calories_per_100g)} kcal/100g</span>
                        </button>
                      ))}
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => setLookupFor(null)}>
                      Fermer
                    </button>
                  </div>
                )}

                <div className="ing-manual-macros">
                  <input
                    type="number"
                    placeholder="kcal/100g"
                    value={ing.calories_per_100g}
                    onChange={(e) => updateIngredient(ing.id, { calories_per_100g: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="prot/100g"
                    value={ing.protein_per_100g}
                    onChange={(e) => updateIngredient(ing.id, { protein_per_100g: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="gluc/100g"
                    value={ing.carbs_per_100g}
                    onChange={(e) => updateIngredient(ing.id, { carbs_per_100g: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="lip/100g"
                    value={ing.fat_per_100g}
                    onChange={(e) => updateIngredient(ing.id, { fat_per_100g: e.target.value })}
                  />
                </div>
              </div>
            ))}

            <button type="button" className="btn btn-ghost" onClick={addIngredient}>
              + Ajouter un ingrédient
            </button>
          </div>

          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="modal-footer">
          {initialMeal && (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(initialMeal.id)}>
              Supprimer ce repas
            </button>
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
