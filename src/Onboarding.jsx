import { useState } from 'react'
import { supabase } from './supabaseClient'
import { round } from './utils'

const STEPS = ['welcome', 'goals', 'demo']

// A small preset picker to make goal-setting effortless
const PRESETS = [
  { key: 'cut', label: 'Perte de poids', calories: 1800, protein: 140, carbs: 150, fat: 60 },
  { key: 'maintain', label: 'Maintien', calories: 2200, protein: 130, carbs: 230, fat: 75 },
  { key: 'bulk', label: 'Prise de masse', calories: 2800, protein: 180, carbs: 300, fat: 90 },
]

export default function Onboarding({ member, onDone }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [calories, setCalories] = useState(member.daily_calories_target || 2200)
  const [protein, setProtein] = useState(member.daily_protein_target || 130)
  const [carbs, setCarbs] = useState(member.daily_carbs_target || 230)
  const [fat, setFat] = useState(member.daily_fat_target || 75)
  const [activePreset, setActivePreset] = useState('maintain')
  const [saving, setSaving] = useState(false)

  const step = STEPS[stepIndex]

  function applyPreset(p) {
    setActivePreset(p.key)
    setCalories(p.calories)
    setProtein(p.protein)
    setCarbs(p.carbs)
    setFat(p.fat)
  }

  async function finish() {
    setSaving(true)
    try {
      await supabase
        .from('household_members')
        .update({
          daily_calories_target: Number(calories) || null,
          daily_protein_target: Number(protein) || null,
          daily_carbs_target: Number(carbs) || null,
          daily_fat_target: Number(fat) || null,
          onboarded: true,
        })
        .eq('id', member.id)
      await onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onb-screen">
      <div className="onb-card">
        <div className="onb-progress">
          {STEPS.map((s, i) => (
            <span key={s} className={`onb-dot ${i <= stepIndex ? 'is-done' : ''}`} />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="onb-step onb-welcome">
            <div className="onb-mark">🥗</div>
            <h1>Bienvenue sur eatBetter, {member.display_name}.</h1>
            <p className="onb-lede">
              Planifie tes repas de la semaine, suis tes macros sans effort, et laisse ton coach t'aider à
              tenir tes objectifs. On configure ça en une minute.
            </p>
            <div className="onb-features">
              <div className="onb-feature">
                <span className="onb-feature-icon">◎</span>
                <div>
                  <strong>Des objectifs clairs</strong>
                  <span>Calories et macros suivis jour par jour.</span>
                </div>
              </div>
              <div className="onb-feature">
                <span className="onb-feature-icon">✦</span>
                <div>
                  <strong>Des repas en un geste</strong>
                  <span>Décris un plat, l'IA le construit pour toi.</span>
                </div>
              </div>
              <div className="onb-feature">
                <span className="onb-feature-icon">↗</span>
                <div>
                  <strong>Un coach qui te pousse</strong>
                  <span>Une analyse de ta semaine, des conseils concrets.</span>
                </div>
              </div>
            </div>
            <button className="btn btn-primary onb-cta" onClick={() => setStepIndex(1)}>
              Commencer
            </button>
          </div>
        )}

        {step === 'goals' && (
          <div className="onb-step">
            <h1>Tes objectifs quotidiens</h1>
            <p className="onb-lede">Choisis un point de départ — tu pourras l'ajuster à tout moment.</p>

            <div className="onb-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`onb-preset ${activePreset === p.key ? 'is-active' : ''}`}
                  onClick={() => applyPreset(p)}
                >
                  <span className="onb-preset-label">{p.label}</span>
                  <span className="onb-preset-kcal">{p.calories} kcal</span>
                </button>
              ))}
            </div>

            <div className="onb-goals-grid">
              <label className="field">
                Calories
                <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
              </label>
              <label className="field">
                Protéines (g)
                <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
              </label>
              <label className="field">
                Glucides (g)
                <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
              </label>
              <label className="field">
                Lipides (g)
                <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
              </label>
            </div>

            <div className="onb-nav">
              <button className="btn btn-ghost" onClick={() => setStepIndex(0)}>
                Retour
              </button>
              <button className="btn btn-primary" onClick={() => setStepIndex(2)}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === 'demo' && (
          <DemoStep
            targets={{ calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: Number(fat) }}
            onBack={() => setStepIndex(1)}
            onFinish={finish}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}

// Interactive demo: add sample meals to a fake day and watch the rings fill toward the goal
const DEMO_MEALS = [
  { name: 'Porridge avoine & fruits', slot: 'Petit-déj', calories: 420, protein: 18, carbs: 62, fat: 10 },
  { name: 'Poulet, riz & légumes', slot: 'Déjeuner', calories: 620, protein: 48, carbs: 65, fat: 16 },
  { name: 'Skyr & amandes', slot: 'Collation', calories: 240, protein: 22, carbs: 14, fat: 9 },
  { name: 'Saumon & patate douce', slot: 'Dîner', calories: 560, protein: 42, carbs: 45, fat: 22 },
]

function DemoStep({ targets, onBack, onFinish, saving }) {
  const [added, setAdded] = useState([])

  const totals = added.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  function toggle(meal) {
    setAdded((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]))
  }

  const calPct = targets.calories ? Math.min(100, (totals.calories / targets.calories) * 100) : 0
  const proPct = targets.protein ? Math.min(100, (totals.protein / targets.protein) * 100) : 0

  return (
    <div className="onb-step">
      <h1>Comment ça marche</h1>
      <p className="onb-lede">
        Ajoute des repas à ta journée, et regarde ta progression avancer vers tes objectifs. Essaie :
      </p>

      <div className="onb-demo">
        <div className="onb-demo-rings">
          <DemoRing label="Calories" value={totals.calories} target={targets.calories} pct={calPct} />
          <DemoRing label="Protéines" value={totals.protein} target={targets.protein} pct={proPct} />
        </div>

        <div className="onb-demo-meals">
          {DEMO_MEALS.map((m) => {
            const on = added.includes(m)
            return (
              <button key={m.name} className={`onb-demo-meal ${on ? 'is-added' : ''}`} onClick={() => toggle(m)}>
                <div className="onb-demo-meal-info">
                  <span className="onb-demo-meal-slot">{m.slot}</span>
                  <span className="onb-demo-meal-name">{m.name}</span>
                </div>
                <span className="onb-demo-meal-kcal">
                  {m.calories} kcal
                  <span className="onb-demo-meal-toggle">{on ? '✓' : '+'}</span>
                </span>
              </button>
            )
          })}
        </div>

        {calPct >= 85 && (
          <p className="onb-demo-success">Parfait — c'est exactement comme ça que tu suivras tes vraies journées.</p>
        )}
      </div>

      <div className="onb-nav">
        <button className="btn btn-ghost" onClick={onBack}>
          Retour
        </button>
        <button className="btn btn-primary" onClick={onFinish} disabled={saving}>
          {saving ? 'Un instant…' : "C'est parti"}
        </button>
      </div>
    </div>
  )
}

function DemoRing({ label, value, target, pct }) {
  const size = 92
  const radius = (size - 9) / 2
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ
  const stroke = pct >= 85 ? '#8fa998' : '#e8b930'
  return (
    <div className="onb-demo-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(242,239,226,0.12)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="onb-demo-ring-center">
        <span className="onb-demo-ring-value">{round(value)}</span>
        <span className="onb-demo-ring-target">/ {round(target)}</span>
      </div>
      <span className="onb-demo-ring-label">{label}</span>
    </div>
  )
}
