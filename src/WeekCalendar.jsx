import { Fragment } from 'react'
import { SLOTS, mealMacros, round } from './utils'

export default function WeekCalendar({
  weekDays,
  placementsByDayAndSlot,
  mealsById,
  onDropOnSlot,
  onOpenMeal,
  onRemovePlacement,
  dragOverKey,
  setDragOverKey,
}) {
  function handleDragOver(e, key) {
    e.preventDefault()
    if (dragOverKey !== key) setDragOverKey(key)
  }

  function handleDrop(e, iso, slotKey) {
    e.preventDefault()
    setDragOverKey(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw) return
    try {
      const payload = JSON.parse(raw)
      onDropOnSlot(payload, iso, slotKey)
    } catch (err) {
      /* ignore malformed drag payload */
    }
  }

  return (
    <div className="calendar-grid">
      <div className="calendar-corner" />
      {weekDays.map((day) => {
        const dayTotal = SLOTS.reduce((sum, slot) => {
          const placements = placementsByDayAndSlot[day.iso]?.[slot.key] || []
          return (
            sum +
            placements.reduce((s, p) => {
              const meal = mealsById[p.meal_id]
              return s + (meal ? mealMacros(meal.ingredients).calories : 0)
            }, 0)
          )
        }, 0)
        return (
          <div className="calendar-day-header" key={day.iso}>
            <div className="day-name">{day.label}</div>
            <div className="day-date">{day.date.getDate()}</div>
            {dayTotal > 0 && <div className="day-kcal">{round(dayTotal)} kcal</div>}
          </div>
        )
      })}

      {SLOTS.map((slot) => (
        <Fragment key={slot.key}>
          <div className="calendar-slot-label">{slot.label}</div>
          {weekDays.map((day) => {
            const key = `${day.iso}__${slot.key}`
            const placements = placementsByDayAndSlot[day.iso]?.[slot.key] || []
            return (
              <div
                key={key}
                className={`calendar-cell ${dragOverKey === key ? 'is-drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => setDragOverKey((prev) => (prev === key ? null : prev))}
                onDrop={(e) => handleDrop(e, day.iso, slot.key)}
              >
                {placements.map((p) => {
                  const meal = mealsById[p.meal_id]
                  if (!meal) return null
                  const macros = mealMacros(meal.ingredients)
                  return (
                    <div
                      key={p.id}
                      className="placed-meal-card"
                      style={{ borderLeftColor: meal.color }}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          'text/plain',
                          JSON.stringify({ type: 'placed', plannedMealId: p.id, mealId: meal.id })
                        )
                      }
                      onClick={() => onOpenMeal(meal)}
                    >
                      <span className="placed-meal-name">{meal.name}</span>
                      <span className="placed-meal-kcal">{round(macros.calories)} kcal</span>
                      <button
                        type="button"
                        className="placed-meal-remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemovePlacement(p.id)
                        }}
                        aria-label="Retirer du planning"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
