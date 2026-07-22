import { round } from './utils'

// Small circular progress ring (SVG), monochrome with a subtle fill
function Ring({ value, target, label, unit, size = 64 }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target > 0 && value > target * 1.08
  const radius = (size - 8) / 2
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ
  const stroke = over ? '#c1502e' : pct >= 85 ? '#8fa998' : '#e8b930'
  return (
    <div className="goal-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(242,239,226,0.12)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="goal-ring-center">
        <span className="goal-ring-value">{round(value)}</span>
        {target > 0 && <span className="goal-ring-target">/{round(target)}</span>}
      </div>
      <span className="goal-ring-label">{label}</span>
    </div>
  )
}

// Encouraging one-liner based on how the day is shaping up vs. calorie + protein targets
function encouragement(totals, targets, mealCount) {
  if (mealCount === 0) return "Planifie ta journée pour rester sur ta lancée."
  const calPct = targets.calories ? (totals.calories / targets.calories) * 100 : null
  const proPct = targets.protein ? (totals.protein / targets.protein) * 100 : null

  if (proPct != null && proPct >= 90 && calPct != null && calPct >= 85 && calPct <= 110) {
    return "Journée équilibrée — c'est exactement ça. 💪"
  }
  if (proPct != null && proPct < 70) return "Ajoute une source de protéines pour compléter ta journée."
  if (calPct != null && calPct > 115) return "Journée copieuse — allège un repas si tu veux rester dans ta cible."
  if (calPct != null && calPct < 60) return "Il te reste de la marge : n'oublie pas de bien manger."
  return "Tu es sur la bonne voie, continue comme ça."
}

export default function DailyGoalBar({ totals, targets, mealCount, variant = 'desktop' }) {
  const hasTargets = targets && (targets.calories || targets.protein)
  if (!hasTargets) return null

  return (
    <div className={`goal-bar goal-bar-${variant}`}>
      <div className="goal-rings">
        {targets.calories ? (
          <Ring value={totals.calories} target={targets.calories} label="kcal" size={variant === 'mobile' ? 58 : 66} />
        ) : null}
        {targets.protein ? (
          <Ring value={totals.protein} target={targets.protein} label="protéines" unit="g" size={variant === 'mobile' ? 58 : 66} />
        ) : null}
        {targets.carbs ? (
          <Ring value={totals.carbs} target={targets.carbs} label="glucides" unit="g" size={variant === 'mobile' ? 58 : 66} />
        ) : null}
        {targets.fat ? (
          <Ring value={totals.fat} target={targets.fat} label="lipides" unit="g" size={variant === 'mobile' ? 58 : 66} />
        ) : null}
      </div>
      <p className="goal-encouragement">{encouragement(totals, targets, mealCount)}</p>
    </div>
  )
}
