import { useState } from 'react'
import IngredientRow from './IngredientRow'
import { mealMacros, round } from './utils'

const COLORS = ['#e8b930', '#c1502e', '#8fa998', '#5b7a9d', '#a86fb0']

const CATEGORIES = [
  { key: '', label: 'Non catégorisé' },
  { key: 'breakfast', label: 'Petit-déj' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'snack', label: 'Collation' },
  { key: 'dinner', label: 'Dîner' },
]

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
    piece_weight_g: 100,
  }
}

export default function MealEditor({ initialMeal, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(initialMeal?.name || '')
  const [notes, setNotes] = useState(initialMeal?.notes || '')
  const [color, setColor] = useState(initialMeal?.color || COLORS[0])
  const [category, setCategory] = useState(initialMeal?.category || '')
  const [ingredients, setIngredients] = useState(
    initialMeal?.ingredients?.length ? initialMeal.ingredients.map((i) => ({ ...i })) : [emptyIngredient()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // AI: describe a dish in plain language, get a full recipe pre-filled
  const [aiDescription, setAiDescription] = useState('')
  const [aiServings, setAiServings] = useState(1)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  async function generateFromDescription() {
    if (aiDescription.trim().length < 3) {
      setAiError('Décris ton plat en quelques mots.')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/recipe-from-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription.trim(), servings: aiServings }),
      })
      const data = await res.json()
      if (data.error === 'missing_api_key') {
        setAiError("La clé OpenRouter n'est pas configurée côté serveur.")
        return
      }
      if (data.error || !data.recipe) {
        setAiError("L'IA n'a pas réussi à créer la recette. Reformule ou réessaie.")
        return
      }
      const r = data.recipe
      if (!name.trim() && r.name) setName(r.name)
      if (r.category && CATEGORIES.some((c) => c.key === r.category)) setCategory(r.category)
      const mapped = (r.ingredients || [])
        .filter((ing) => ing.name && ing.name.trim())
        .map((ing) => ({
          id: nextId(),
          name: ing.name.trim(),
          quantity: Number(ing.quantity) || 0,
          unit: ['g', 'ml', 'pièce', 'cs', 'cc'].includes(ing.unit) ? ing.unit : 'g',
          calories_per_100g: ing.calories_per_100g ?? '',
          protein_per_100g: ing.protein_per_100g ?? '',
          carbs_per_100g: ing.carbs_per_100g ?? '',
          fat_per_100g: ing.fat_per_100g ?? '',
          off_code: null,
          piece_weight_g: ing.piece_weight_g || 100,
          source: 'ai',
        }))
      if (mapped.length > 0) setIngredients(mapped)
      setAiDescription('')
    } catch {
      setAiError("Impossible de contacter l'IA. Vérifie ta connexion.")
    } finally {
      setAiLoading(false)
    }
  }

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
      await onSave({ name: name.trim(), notes, color, category: category || null, ingredients })
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
          <div className="ai-describe">
            <div className="ai-describe-header">
              <span className="ai-describe-title">✨ Décris ton plat, l'IA le construit</span>
            </div>
            <textarea
              className="ai-describe-input"
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="Ex. un bowl de poulet grillé, riz basmati, avocat et sauce yaourt citron"
              rows={2}
              disabled={aiLoading}
            />
            <div className="ai-describe-controls">
              <label className="ai-servings">
                Portions
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={aiServings}
                  onChange={(e) => setAiServings(Number(e.target.value) || 1)}
                  disabled={aiLoading}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={generateFromDescription}
                disabled={aiLoading}
              >
                {aiLoading ? 'Création…' : 'Générer la recette'}
              </button>
            </div>
            {aiError && <p className="auth-error ai-describe-error">{aiError}</p>}
            {aiLoading && (
              <p className="ai-describe-hint">L'IA compose les ingrédients et estime les macros…</p>
            )}
            {!aiLoading && !aiError && (
              <p className="ai-describe-hint">
                Les ingrédients générés sont modifiables juste en dessous — ajuste ce que tu veux avant
                d'enregistrer.
              </p>
            )}
          </div>

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

            <label className="field field-category">
              Type de repas
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
