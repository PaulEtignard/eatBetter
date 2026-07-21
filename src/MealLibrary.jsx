import { mealMacros, round } from './utils'

export default function MealLibrary({ meals, onNewMeal, onOpenMeal }) {
  return (
    <aside className="meal-library">
      <div className="meal-library-header">
        <h2>Mes repas</h2>
        <button className="btn btn-primary btn-small" onClick={onNewMeal}>
          + Nouveau
        </button>
      </div>

      {meals.length === 0 && (
        <p className="meal-library-empty">
          Crée ton premier repas, puis glisse-le sur un jour de la semaine.
        </p>
      )}

      <div className="meal-library-list">
        {meals.map((meal) => {
          const macros = mealMacros(meal.ingredients)
          return (
            <div
              key={meal.id}
              className="library-meal-card"
              style={{ borderLeftColor: meal.color }}
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
