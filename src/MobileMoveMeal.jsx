import { useState } from 'react'
import { SLOTS } from './utils'

export default function MobileMoveMeal({ weekDays, currentIso, currentSlot, onConfirm, onClose }) {
  const [iso, setIso] = useState(currentIso)
  const [slot, setSlot] = useState(currentSlot)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal mobile-move" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Déplacer ce repas</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <span>Jour</span>
            <div className="mobile-move-chips">
              {weekDays.map((day) => (
                <button
                  key={day.iso}
                  type="button"
                  className={`mobile-move-chip ${iso === day.iso ? 'is-active' : ''}`}
                  onClick={() => setIso(day.iso)}
                >
                  {day.shortLabel}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Repas</span>
            <div className="mobile-move-chips">
              {SLOTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`mobile-move-chip ${slot === s.key ? 'is-active' : ''}`}
                  onClick={() => setSlot(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <span />
          <div className="modal-footer-right">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onConfirm(iso, slot)}>
              Déplacer ici
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
