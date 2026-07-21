import { useMemo, useState } from 'react'
import { round } from './utils'

export default function ShoppingList({ weekDays, plannedMeals, mealsById, onClose }) {
  const [checked, setChecked] = useState({})

  const items = useMemo(() => {
    const isoSet = new Set(weekDays.map((d) => d.iso))
    const agg = {}
    plannedMeals
      .filter((p) => isoSet.has(p.plan_date))
      .forEach((p) => {
        const meal = mealsById[p.meal_id]
        if (!meal) return
        meal.ingredients.forEach((ing) => {
          const key = `${ing.name.trim().toLowerCase()}__${ing.unit}`
          if (!agg[key]) {
            agg[key] = { name: ing.name.trim(), unit: ing.unit, quantity: 0 }
          }
          agg[key].quantity += Number(ing.quantity) || 0
        })
      })
    return Object.values(agg).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [weekDays, plannedMeals, mealsById])

  function toggle(name) {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shopping-list" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Liste de courses</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="modal-body">
          {items.length === 0 && (
            <p className="meal-library-empty">Aucun repas planifié cette semaine pour le moment.</p>
          )}
          <ul className="shopping-items">
            {items.map((item) => (
              <li key={`${item.name}__${item.unit}`} className={checked[item.name] ? 'is-checked' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!checked[item.name]}
                    onChange={() => toggle(item.name)}
                  />
                  <span className="shopping-item-name">{item.name}</span>
                  <span className="shopping-item-qty">
                    {round(item.quantity)} {item.unit}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="modal-footer">
          <div />
          <div className="modal-footer-right">
            <button className="btn btn-primary" onClick={() => window.print()}>
              Imprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
