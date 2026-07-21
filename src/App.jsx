import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import MealLibrary from './MealLibrary'
import WeekCalendar from './WeekCalendar'
import MealEditor from './MealEditor'
import ShoppingList from './ShoppingList'
import GenerateMenuModal from './GenerateMenuModal'
import { getMonday, getWeekDays, addDays, formatWeekRange, toISODate } from './utils'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [meals, setMeals] = useState([])
  const [plannedMeals, setPlannedMeals] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()))
  const [editorState, setEditorState] = useState(null) // null | 'new' | meal object
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [showGenerateMenu, setShowGenerateMenu] = useState(false)
  const [dragOverKey, setDragOverKey] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    if (!session) return
    setDataLoading(true)
    setErrorMsg('')
    try {
      const { data: mealsData, error: mealsErr } = await supabase
        .from('meals')
        .select('id, name, notes, color, category, meal_ingredients(*)')
        .order('created_at', { ascending: false })
      if (mealsErr) throw mealsErr

      const normalized = (mealsData || []).map((m) => ({
        id: m.id,
        name: m.name,
        notes: m.notes,
        color: m.color,
        category: m.category,
        ingredients: (m.meal_ingredients || []).sort((a, b) => a.position - b.position),
      }))
      setMeals(normalized)

      const { data: plannedData, error: plannedErr } = await supabase
        .from('planned_meals')
        .select('id, meal_id, plan_date, slot, position')
      if (plannedErr) throw plannedErr
      setPlannedMeals(plannedData || [])
    } catch (err) {
      setErrorMsg(err.message || 'Erreur de chargement')
    } finally {
      setDataLoading(false)
    }
  }, [session])

  useEffect(() => {
    loadData()
  }, [loadData])

  const weekDays = useMemo(() => getWeekDays(weekMonday), [weekMonday])
  const mealsById = useMemo(() => Object.fromEntries(meals.map((m) => [m.id, m])), [meals])

  const placementsByDayAndSlot = useMemo(() => {
    const map = {}
    plannedMeals.forEach((p) => {
      if (!map[p.plan_date]) map[p.plan_date] = {}
      if (!map[p.plan_date][p.slot]) map[p.plan_date][p.slot] = []
      map[p.plan_date][p.slot].push(p)
    })
    return map
  }, [plannedMeals])

  async function handleSaveMeal({ name, notes, color, category, ingredients }) {
    const userId = session.user.id
    let mealId = editorState && editorState !== 'new' ? editorState.id : null

    if (mealId) {
      const { error } = await supabase.from('meals').update({ name, notes, color, category }).eq('id', mealId)
      if (error) throw error
      const { error: delErr } = await supabase.from('meal_ingredients').delete().eq('meal_id', mealId)
      if (delErr) throw delErr
    } else {
      const { data, error } = await supabase
        .from('meals')
        .insert({ name, notes, color, category, user_id: userId })
        .select()
        .single()
      if (error) throw error
      mealId = data.id
    }

    const rows = ingredients
      .filter((ing) => ing.name.trim())
      .map((ing, idx) => ({
        meal_id: mealId,
        name: ing.name.trim(),
        quantity: Number(ing.quantity) || 0,
        unit: ing.unit,
        calories_per_100g: ing.calories_per_100g === '' ? null : Number(ing.calories_per_100g),
        protein_per_100g: ing.protein_per_100g === '' ? null : Number(ing.protein_per_100g),
        carbs_per_100g: ing.carbs_per_100g === '' ? null : Number(ing.carbs_per_100g),
        fat_per_100g: ing.fat_per_100g === '' ? null : Number(ing.fat_per_100g),
        off_code: ing.off_code || null,
        position: idx,
      }))

    if (rows.length) {
      const { error: insErr } = await supabase.from('meal_ingredients').insert(rows)
      if (insErr) throw insErr
    }

    setEditorState(null)
    await loadData()
  }

  async function handleDeleteMeal(mealId) {
    const { error } = await supabase.from('meals').delete().eq('id', mealId)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setEditorState(null)
    await loadData()
  }

  async function handleDropOnSlot(payload, iso, slotKey) {
    const userId = session.user.id
    if (payload.type === 'library') {
      const { error } = await supabase.from('planned_meals').insert({
        user_id: userId,
        meal_id: payload.mealId,
        plan_date: iso,
        slot: slotKey,
      })
      if (error) {
        setErrorMsg(error.message)
        return
      }
    } else if (payload.type === 'placed') {
      const { error } = await supabase
        .from('planned_meals')
        .update({ plan_date: iso, slot: slotKey })
        .eq('id', payload.plannedMealId)
      if (error) {
        setErrorMsg(error.message)
        return
      }
    }
    await loadData()
  }

  async function handleRemovePlacement(plannedMealId) {
    const { error } = await supabase.from('planned_meals').delete().eq('id', plannedMealId)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    await loadData()
  }

  const SLOT_COLORS = {
    breakfast: '#e8b930',
    lunch: '#5b7a9d',
    snack: '#8fa998',
    dinner: '#c1502e',
  }

  async function handleGenerateMenu(params) {
    const res = await fetch('/api/generate-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = await res.json()

    if (data.error === 'missing_api_key') {
      throw new Error(
        "La clé OpenRouter n'est pas configurée côté serveur (variable OPENROUTER_API_KEY manquante sur Vercel)."
      )
    }
    if (data.error || !Array.isArray(data.days)) {
      throw new Error("L'IA n'a pas réussi à générer un menu valide. Réessaie.")
    }

    const userId = session.user.id

    // Flatten every generated meal across all days into one list
    const flatMeals = []
    data.days.forEach((day, dayIndex) => {
      ;(day.meals || []).forEach((meal) => {
        flatMeals.push({
          dayIndex,
          slot: meal.slot,
          name: meal.name,
          ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
        })
      })
    })

    if (flatMeals.length === 0) {
      throw new Error("L'IA n'a généré aucun repas.")
    }

    // 1. Bulk create the meal rows
    const mealRows = flatMeals.map((m) => ({
      user_id: userId,
      name: m.name,
      color: SLOT_COLORS[m.slot] || '#e8b930',
      category: m.slot,
    }))
    const { data: insertedMeals, error: mealsErr } = await supabase.from('meals').insert(mealRows).select()
    if (mealsErr) throw mealsErr

    // 2. Bulk create ingredient rows for all meals at once
    const ingredientRows = []
    flatMeals.forEach((m, idx) => {
      const mealId = insertedMeals[idx].id
      m.ingredients.forEach((ing, position) => {
        if (!ing.name || !ing.name.trim()) return
        ingredientRows.push({
          meal_id: mealId,
          name: ing.name.trim(),
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit || 'g',
          calories_per_100g: ing.calories_per_100g != null ? Number(ing.calories_per_100g) : null,
          protein_per_100g: ing.protein_per_100g != null ? Number(ing.protein_per_100g) : null,
          carbs_per_100g: ing.carbs_per_100g != null ? Number(ing.carbs_per_100g) : null,
          fat_per_100g: ing.fat_per_100g != null ? Number(ing.fat_per_100g) : null,
          position,
        })
      })
    })
    if (ingredientRows.length > 0) {
      const { error: ingErr } = await supabase.from('meal_ingredients').insert(ingredientRows)
      if (ingErr) throw ingErr
    }

    // 3. Bulk place each meal on its target day/slot
    const placementRows = flatMeals.map((m, idx) => ({
      user_id: userId,
      meal_id: insertedMeals[idx].id,
      plan_date: toISODate(addDays(weekMonday, m.dayIndex)),
      slot: m.slot,
    }))
    const { error: placeErr } = await supabase.from('planned_meals').insert(placementRows)
    if (placeErr) throw placeErr

    setShowGenerateMenu(false)
    await loadData()
  }

  if (authLoading) {
    return <div className="full-screen-center">Chargement…</div>
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-mark">🍲</span>
          <h1>Le Menu</h1>
        </div>
        <div className="week-nav">
          <button className="btn btn-ghost btn-small" onClick={() => setWeekMonday((d) => addDays(d, -7))}>
            ← Semaine préc.
          </button>
          <span className="week-range">{formatWeekRange(weekMonday)}</span>
          <button className="btn btn-ghost btn-small" onClick={() => setWeekMonday((d) => addDays(d, 7))}>
            Semaine suiv. →
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setWeekMonday(getMonday(new Date()))}>
            Aujourd'hui
          </button>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-small" onClick={() => setShowShoppingList(true)}>
            🛒 Liste de courses
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => supabase.auth.signOut()}>
            Déconnexion
          </button>
        </div>
      </header>

      {errorMsg && <div className="global-error">{errorMsg}</div>}

      <main className="app-main">
        <MealLibrary
          meals={meals}
          onNewMeal={() => setEditorState('new')}
          onOpenMeal={(meal) => setEditorState(meal)}
          onOpenGenerate={() => setShowGenerateMenu(true)}
        />

        {dataLoading ? (
          <div className="full-screen-center">Chargement du planning…</div>
        ) : (
          <WeekCalendar
            weekDays={weekDays}
            placementsByDayAndSlot={placementsByDayAndSlot}
            mealsById={mealsById}
            onDropOnSlot={handleDropOnSlot}
            onOpenMeal={(meal) => setEditorState(meal)}
            onRemovePlacement={handleRemovePlacement}
            dragOverKey={dragOverKey}
            setDragOverKey={setDragOverKey}
          />
        )}
      </main>

      {editorState && (
        <MealEditor
          initialMeal={editorState === 'new' ? null : editorState}
          onCancel={() => setEditorState(null)}
          onSave={handleSaveMeal}
          onDelete={handleDeleteMeal}
        />
      )}

      {showShoppingList && (
        <ShoppingList
          weekDays={weekDays}
          plannedMeals={plannedMeals}
          mealsById={mealsById}
          onClose={() => setShowShoppingList(false)}
        />
      )}

      {showGenerateMenu && (
        <GenerateMenuModal onCancel={() => setShowGenerateMenu(false)} onGenerate={handleGenerateMenu} />
      )}
    </div>
  )
}
