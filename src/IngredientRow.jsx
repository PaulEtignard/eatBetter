import { useEffect, useRef, useState } from 'react'
import { searchIngredientMacros } from './openFoodFacts'
import { round, UNIT_GRAM_EQUIVALENTS } from './utils'

const DEBOUNCE_MS = 600

export default function IngredientRow({ ingredient, onChange, onRemove }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showManualMacros, setShowManualMacros] = useState(false)
  const skipNextSearch = useRef(true) // skip the initial mount so editing an existing recipe doesn't auto-trigger a lookup
  const debounceRef = useRef(null)

  // Debounced live search: fires ~600ms after the user stops typing
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return undefined
    }
    const term = ingredient.name.trim()
    clearTimeout(debounceRef.current)

    if (term.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchIngredientMacros(term)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient.name])

  function selectSuggestion(s) {
    skipNextSearch.current = true
    setShowSuggestions(false)
    setSuggestions([])
    onChange({
      name: s.name,
      calories_per_100g: s.calories_per_100g ?? '',
      protein_per_100g: s.protein_per_100g ?? '',
      carbs_per_100g: s.carbs_per_100g ?? '',
      fat_per_100g: s.fat_per_100g ?? '',
      off_code: s.code || null,
      source: s.source || null,
    })
    // AI-sourced values are estimates and can hallucinate: surface the editable fields
    // immediately so the person can eyeball and correct them right away if needed.
    if (s.source === 'ai') setShowManualMacros(true)
  }

  function handleUnitChange(newUnit) {
    const oldUnit = ingredient.unit
    const oldFactor = UNIT_GRAM_EQUIVALENTS[oldUnit]
    const newFactor = UNIT_GRAM_EQUIVALENTS[newUnit]
    // Only convert between units that both have a known grams-equivalent (g/ml/cs/cc).
    // "pièce" has no generic conversion (an egg and a lemon don't weigh the same), so
    // switching to/from it just changes the label and leaves the quantity as-is.
    if (oldFactor && newFactor && ingredient.quantity !== '' && ingredient.quantity != null) {
      const grams = Number(ingredient.quantity) * oldFactor
      const converted = Math.round((grams / newFactor) * 100) / 100
      onChange({ unit: newUnit, quantity: converted })
    } else {
      onChange({ unit: newUnit })
    }
  }

  const hasMacros = ingredient.calories_per_100g !== '' && ingredient.calories_per_100g != null

  return (
    <div className="ingredient-card">
      <div className="ingredient-card-main">
        <div className="ingredient-name-wrap">
          <input
            className="ing-name"
            placeholder="Ingrédient (ex. riz basmati)"
            value={ingredient.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />
          {loading && <span className="ing-spinner" aria-hidden="true" />}

          {showSuggestions && (
            <ul className="autocomplete-list">
              {suggestions.map((s, idx) => (
                <li key={s.code || `${s.source}-${idx}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                  >
                    <span className="autocomplete-name">
                      {s.name}
                      {s.source === 'local' && <span className="autocomplete-badge">aliment brut</span>}
                      {s.source === 'ai' && <span className="autocomplete-badge badge-ai">estimation IA</span>}
                      {s.source === 'cached-ai' && (
                        <span className="autocomplete-badge badge-ai">IA (déjà vue)</span>
                      )}
                      {s.source === 'cached' && <span className="autocomplete-badge">déjà vue</span>}
                    </span>
                    <span className="autocomplete-kcal">{round(s.calories_per_100g)} kcal/100g</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          className="ing-qty"
          type="number"
          min="0"
          value={ingredient.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          aria-label="Quantité"
        />
        <select
          className="ing-unit"
          value={ingredient.unit}
          onChange={(e) => handleUnitChange(e.target.value)}
          aria-label="Unité"
        >
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="pièce">pièce</option>
          <option value="cs">c. à soupe</option>
          <option value="cc">c. à café</option>
        </select>
        <button
          type="button"
          className="icon-btn ingredient-remove"
          onClick={onRemove}
          aria-label="Retirer l'ingrédient"
        >
          🗑
        </button>
      </div>

      <div className="ingredient-card-footer">
        {hasMacros ? (
          <span className="ing-macro-readout">
            {round(ingredient.calories_per_100g)} kcal · P {round(ingredient.protein_per_100g) || 0}g · G{' '}
            {round(ingredient.carbs_per_100g) || 0}g · L {round(ingredient.fat_per_100g) || 0}g
            <span className="ing-macro-unit"> / 100g</span>
          </span>
        ) : (
          <span className="ing-macro-missing">
            {loading ? 'Recherche des macros…' : 'Tape le nom pour trouver les macros automatiquement'}
          </span>
        )}
        <button type="button" className="ing-manual-toggle" onClick={() => setShowManualMacros((v) => !v)}>
          {showManualMacros ? 'Masquer' : 'Ajuster'} les macros
        </button>
      </div>

      {showManualMacros && (
        <div className="ing-manual-macros">
          <label>
            kcal/100g
            <input
              type="number"
              value={ingredient.calories_per_100g}
              onChange={(e) => onChange({ calories_per_100g: e.target.value })}
            />
          </label>
          <label>
            prot/100g
            <input
              type="number"
              value={ingredient.protein_per_100g}
              onChange={(e) => onChange({ protein_per_100g: e.target.value })}
            />
          </label>
          <label>
            gluc/100g
            <input
              type="number"
              value={ingredient.carbs_per_100g}
              onChange={(e) => onChange({ carbs_per_100g: e.target.value })}
            />
          </label>
          <label>
            lip/100g
            <input
              type="number"
              value={ingredient.fat_per_100g}
              onChange={(e) => onChange({ fat_per_100g: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
