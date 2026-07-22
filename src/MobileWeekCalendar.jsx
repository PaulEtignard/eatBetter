import { useState } from 'react'
import { SLOTS, mealMacros, applyOverrides, round } from './utils'
import MobileMealPicker from './MobileMealPicker'
import MobileMoveMeal from './MobileMoveMeal'

export default function MobileWeekCalendar({
  weekDays,
  placementsByDayAndSlot,
  mealsById,
  membersById,
  members,
  currentMemberId,
  overridesByPlacementId,
  meals,
  onAddMeal,
  onMoveMeal,
  onOpenPortion,
  onRemovePlacement,
  onDuplicateForMember,
}) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const now = new Date()
    const idx = weekDays.findIndex((d) => d.date.toDateString() === now.toDateString())
    return idx >= 0 ? idx : 0
  })
  const [pickerFor, setPickerFor] = useState(null) // { iso, slotKey, dayLabel, slotLabel }
  const [moveFor, setMoveFor] = useState(null) // placement object
  const [duplicateMenuFor, setDuplicateMenuFor] = useState(null)

  const day = weekDays[selectedIndex]

  function effectiveMacros(placement, meal) {
    const overrides = overridesByPlacementId[placement.id] || []
    return mealMacros(applyOverrides(meal.ingredients, overrides))
  }

  const dayTotals = SLOTS.reduce(
    (acc, slot) => {
      const placements = (placementsByDayAndSlot[day.iso]?.[slot.key] || []).filter(
        (p) => p.member_id === currentMemberId
      )
      placements.forEach((p) => {
        const meal = mealsById[p.meal_id]
        if (!meal) return
        const m = effectiveMacros(p, meal)
        acc.calories += m.calories
        acc.protein += m.protein
        acc.carbs += m.carbs
        acc.fat += m.fat
      })
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  return (
    <div className="mobile-calendar">
      <div className="mobile-day-strip">
        {weekDays.map((d, idx) => (
          <button
            key={d.iso}
            type="button"
            className={`mobile-day-chip ${idx === selectedIndex ? 'is-active' : ''}`}
            onClick={() => setSelectedIndex(idx)}
          >
            <span className="mobile-day-chip-label">{d.label.slice(0, 3)}</span>
            <span className="mobile-day-chip-date">{d.date.getDate()}</span>
          </button>
        ))}
      </div>

      <div className="mobile-day-header">
        <h2>{day.label}</h2>
        {dayTotals.calories > 0 && (
          <div className="mobile-day-totals">
            <span className="day-kcal">{round(dayTotals.calories)} kcal</span>
            <span className="day-macros">
              P {round(dayTotals.protein)} · G {round(dayTotals.carbs)} · L {round(dayTotals.fat)}
            </span>
          </div>
        )}
      </div>

      {SLOTS.map((slot) => {
        const placements = placementsByDayAndSlot[day.iso]?.[slot.key] || []
        return (
          <section className="mobile-slot-section" key={slot.key}>
            <h3 className="mobile-slot-title">{slot.label}</h3>

            {placements.map((p) => {
              const meal = mealsById[p.meal_id]
              if (!meal) return null
              const macros = effectiveMacros(p, meal)
              const memberName = membersById[p.member_id]?.display_name || '?'
              const isMine = p.member_id === currentMemberId
              const membersWithoutPlacement = members.filter(
                (m) => !placements.some((pl) => pl.member_id === m.id)
              )
              return (
                <div
                  key={p.id}
                  className={`mobile-placed-card ${isMine ? 'is-mine' : ''}`}
                  style={{ borderLeftColor: meal.color }}
                >
                  <button className="mobile-placed-main" onClick={() => onOpenPortion(p, meal)}>
                    <span className="placed-meal-member">{memberName}</span>
                    <span className="mobile-placed-name">{meal.name}</span>
                    <span className="placed-meal-kcal">{round(macros.calories)} kcal</span>
                  </button>
                  <div className="mobile-placed-actions">
                    {membersWithoutPlacement.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() =>
                          setDuplicateMenuFor(duplicateMenuFor === p.id ? null : p.id)
                        }
                      >
                        👤+
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setMoveFor(p)}
                    >
                      Déplacer
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onRemovePlacement(p.id)}
                      aria-label="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                  {duplicateMenuFor === p.id && (
                    <div className="duplicate-menu mobile-duplicate-menu">
                      {membersWithoutPlacement.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setDuplicateMenuFor(null)
                            onDuplicateForMember(p, m.id)
                          }}
                        >
                          {m.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              className="mobile-add-btn"
              onClick={() =>
                setPickerFor({ iso: day.iso, slotKey: slot.key, dayLabel: day.label, slotLabel: slot.label })
              }
            >
              + Ajouter
            </button>
          </section>
        )
      })}

      {pickerFor && (
        <MobileMealPicker
          meals={meals}
          dayLabel={pickerFor.dayLabel}
          slotLabel={pickerFor.slotLabel}
          onPick={(mealId) => {
            onAddMeal(mealId, pickerFor.iso, pickerFor.slotKey)
            setPickerFor(null)
          }}
          onClose={() => setPickerFor(null)}
        />
      )}

      {moveFor && (
        <MobileMoveMeal
          weekDays={weekDays}
          currentIso={moveFor.plan_date}
          currentSlot={moveFor.slot}
          onConfirm={(iso, slotKey) => {
            onMoveMeal(moveFor.id, iso, slotKey)
            setMoveFor(null)
          }}
          onClose={() => setMoveFor(null)}
        />
      )}
    </div>
  )
}
