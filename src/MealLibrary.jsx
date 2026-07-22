import { useMemo, useState } from 'react'
import { mealMacros, round } from './utils'

const CATEGORY_TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'breakfast', label: 'Petit-déj' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'snack', label: 'Collation' },
  { key: 'dinner', label: 'Dîner' },
  { key: 'none', label: 'Autre' },
]

export default function MealLibrary({ meals, onNewMeal, onOpenMeal, onOpenCoach }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const filteredMeals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return meals
      .filter((m) => {
        if (activeCategory === 'all') return true
        if (activeCategory === 'none') return !m.category
        return m.category === activeCategory
      })
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [meals, query, activeCategory])

  return (
    <aside className="meal-library">
      <div className="meal-library-header">
        <h2>Mes repas</h2>
        <button className="btn btn-primary btn-small" onClick={onNewMeal}>
          + Nouveau
        </button>
      </div>

      {onOpenCoach && (
        <button type="button" className="btn btn-secondary btn-small ai-generate-btn" onClick={onOpenCoach}>
          ✨ Coach de la semaine
        </button>
      )}

      {meals.length > 0 && (
        <>
          <input
            className="meal-search"
            type="search"
            placeholder="Rechercher un repas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="category-tabs">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`category-tab ${activeCategory === tab.key ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}

      {meals.length === 0 && (
        <p className="meal-library-empty">
          Crée ton premier repas, puis glisse-le sur un jour de la semaine.
        </p>
      )}

      {meals.length > 0 && filteredMeals.length === 0 && (
        <p className="meal-library-empty">Aucun repas ne correspond à ce filtre.</p>
      )}

      <div className="meal-library-list">
        {filteredMeals.map((meal) => {
          const macros = mealMacros(meal.ingredients)
          return (
            <div
              key={meal.id}
              className="library-meal-card"
              style={{ "--card-accent": meal.color }}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'library', mealId: meal.id }))
              }
              onClick={() => onOpenMeal(meal)}
            >
              <span className="library-meal-name">{meal.name}</span>
              <span className="library-meal-kcal">{round(macros.calories)} kcal</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
