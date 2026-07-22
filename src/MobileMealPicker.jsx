import { useMemo, useState } from 'react'
import { mealMacros, round } from './utils'

export default function MobileMealPicker({ meals, dayLabel, slotLabel, onPick, onClose }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return meals
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [meals, query])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal mobile-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Ajouter un repas</h2>
            <p className="portion-subtitle">
              {dayLabel} · {slotLabel}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <input
            className="meal-search"
            type="search"
            placeholder="Rechercher un repas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {meals.length === 0 && (
            <p className="meal-library-empty">Tu n'as pas encore de repas. Crée-en un depuis "Mes repas".</p>
          )}
          {meals.length > 0 && filtered.length === 0 && (
            <p className="meal-library-empty">Aucun repas ne correspond.</p>
          )}
          <div className="mobile-picker-list">
            {filtered.map((meal) => {
              const macros = mealMacros(meal.ingredients)
              return (
                <button
                  key={meal.id}
                  type="button"
                  className="mobile-picker-item"
                  style={{ "--card-accent": meal.color }}
                  onClick={() => onPick(meal.id)}
                >
                  <span className="library-meal-name">{meal.name}</span>
                  <span className="library-meal-kcal">{round(macros.calories)} kcal</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
