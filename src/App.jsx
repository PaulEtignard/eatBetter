import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import HouseholdGate from './HouseholdGate'
import ProfileModal from './ProfileModal'
import PortionEditor from './PortionEditor'
import MealLibrary from './MealLibrary'
import WeekCalendar from './WeekCalendar'
import MobileWeekCalendar from './MobileWeekCalendar'
import MealEditor from './MealEditor'
import ShoppingList from './ShoppingList'
import CoachModal from './CoachModal'
import { cacheIngredientMacros } from './openFoodFacts'
import { getMonday, getWeekDays, addDays, formatWeekRange, toISODate, mealMacros } from './utils'

const SLOT_COLORS = {
  breakfast: '#e8b930',
  lunch: '#5b7a9d',
  snack: '#8fa998',
  dinner: '#c1502e',
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [household, setHousehold] = useState(null)
  const [currentMember, setCurrentMember] = useState(null)
  const [members, setMembers] = useState([])
  const [householdLoading, setHouseholdLoading] = useState(true)

  const [meals, setMeals] = useState([])
  const [plannedMeals, setPlannedMeals] = useState([])
  const [overrides, setOverrides] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()))
  const [editorState, setEditorState] = useState(null) // null | 'new' | meal object
  const [portionState, setPortionState] = useState(null) // null | { placement, meal }
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
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

  const loadHousehold = useCallback(async () => {
    if (!session) return
    setHouseholdLoading(true)
    try {
      const { data: memberRow, error: memberErr } = await supabase
        .from('household_members')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (memberErr) throw memberErr

      if (!memberRow) {
        setCurrentMember(null)
        setHousehold(null)
        setMembers([])
        return
      }

      const { data: householdRow, error: hErr } = await supabase
        .from('households')
        .select('*')
        .eq('id', memberRow.household_id)
        .single()
      if (hErr) throw hErr

      const { data: allMembers, error: membersErr } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', memberRow.household_id)
        .order('created_at', { ascending: true })
      if (membersErr) throw membersErr

      setCurrentMember(memberRow)
      setHousehold(householdRow)
      setMembers(allMembers || [])
    } catch (err) {
      setErrorMsg(err.message || 'Erreur de chargement du foyer')
    } finally {
      setHouseholdLoading(false)
    }
  }, [session])

  useEffect(() => {
    loadHousehold()
  }, [loadHousehold])

  const loadData = useCallback(async () => {
    if (!household) return
    setDataLoading(true)
    setErrorMsg('')
    try {
      const { data: mealsData, error: mealsErr } = await supabase
        .from('meals')
        .select('id, name, notes, color, category, ai_generated, meal_ingredients(*)')
        .order('created_at', { ascending: false })
      if (mealsErr) throw mealsErr

      const normalized = (mealsData || []).map((m) => ({
        id: m.id,
        name: m.name,
        notes: m.notes,
        color: m.color,
        category: m.category,
        ai_generated: m.ai_generated,
        ingredients: (m.meal_ingredients || []).sort((a, b) => a.position - b.position),
      }))
      setMeals(normalized)

      const { data: plannedData, error: plannedErr } = await supabase
        .from('planned_meals')
        .select('id, meal_id, member_id, plan_date, slot, position')
      if (plannedErr) throw plannedErr
      setPlannedMeals(plannedData || [])

      const { data: overrideData, error: overrideErr } = await supabase
        .from('planned_meal_ingredient_overrides')
        .select('id, planned_meal_id, meal_ingredient_id, quantity')
      if (overrideErr) throw overrideErr
      setOverrides(overrideData || [])
    } catch (err) {
      setErrorMsg(err.message || 'Erreur de chargement')
    } finally {
      setDataLoading(false)
    }
  }, [household])

  useEffect(() => {
    loadData()
  }, [loadData])

  const weekDays = useMemo(() => getWeekDays(weekMonday), [weekMonday])
  const mealsById = useMemo(() => Object.fromEntries(meals.map((m) => [m.id, m])), [meals])
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  const overridesByPlacementId = useMemo(() => {
    const map = {}
    overrides.forEach((o) => {
      if (!map[o.planned_meal_id]) map[o.planned_meal_id] = []
      map[o.planned_meal_id].push(o)
    })
    return map
  }, [overrides])

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
        .insert({ name, notes, color, category, user_id: userId, household_id: household.id })
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
        piece_weight_g: ing.unit === 'pièce' ? Number(ing.piece_weight_g) || 100 : null,
        position: idx,
      }))

    if (rows.length) {
      const { error: insErr } = await supabase.from('meal_ingredients').insert(rows)
      if (insErr) throw insErr
      cacheIngredientMacros(ingredients) // fire-and-forget: don't block saving on this
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

  function friendlyPlacementError(error) {
    if (error.code === '23505') {
      return 'Ce créneau est déjà occupé pour cette personne. Retire ou déplace le repas existant avant d\'en ajouter un autre.'
    }
    return error.message
  }

  async function handleDropOnSlot(payload, iso, slotKey) {
    const userId = session.user.id
    if (payload.type === 'library') {
      const { error } = await supabase.from('planned_meals').insert({
        user_id: userId,
        household_id: household.id,
        member_id: currentMember.id,
        meal_id: payload.mealId,
        plan_date: iso,
        slot: slotKey,
      })
      if (error) {
        setErrorMsg(friendlyPlacementError(error))
        return
      }
    } else if (payload.type === 'placed') {
      const { error } = await supabase
        .from('planned_meals')
        .update({ plan_date: iso, slot: slotKey })
        .eq('id', payload.plannedMealId)
      if (error) {
        setErrorMsg(friendlyPlacementError(error))
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

  async function handleDuplicateForMember(placement, memberId) {
    const { error } = await supabase.from('planned_meals').insert({
      user_id: session.user.id,
      household_id: household.id,
      member_id: memberId,
      meal_id: placement.meal_id,
      plan_date: placement.plan_date,
      slot: placement.slot,
    })
    if (error) {
      setErrorMsg(friendlyPlacementError(error))
      return
    }
    await loadData()
  }

  function handleOpenPortion(placement, meal) {
    setPortionState({ placement, meal })
  }

  async function handleSavePortion(overrideList) {
    const { placement } = portionState
    const { error: delErr } = await supabase
      .from('planned_meal_ingredient_overrides')
      .delete()
      .eq('planned_meal_id', placement.id)
    if (delErr) throw delErr

    if (overrideList.length > 0) {
      const rows = overrideList.map((o) => ({
        household_id: household.id,
        planned_meal_id: placement.id,
        meal_ingredient_id: o.meal_ingredient_id,
        quantity: o.quantity,
      }))
      const { error: insErr } = await supabase.from('planned_meal_ingredient_overrides').insert(rows)
      if (insErr) throw insErr
    }
    await loadData()
  }

  function handleEditRecipeFromPortion(meal) {
    setPortionState(null)
    setEditorState(meal)
  }


  if (authLoading || (session && householdLoading)) {
    return <div className="full-screen-center">Chargement…</div>
  }

  if (!session) {
    return <Auth />
  }

  if (!currentMember || !household) {
    return <HouseholdGate session={session} onReady={loadHousehold} />
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
          <button className="btn btn-ghost btn-small" onClick={() => setShowProfile(true)}>
            👤 {currentMember.display_name}
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => setShowShoppingList(true)}>
            🛒 Liste de courses
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => supabase.auth.signOut()}>
            Déconnexion
          </button>
        </div>
      </header>

      {errorMsg && <div className="global-error">{errorMsg}</div>}
      {infoMsg && <div className="global-info">{infoMsg}</div>}

      <main className="app-main">
        <MealLibrary
          meals={meals}
          onNewMeal={() => setEditorState('new')}
          onOpenMeal={(meal) => setEditorState(meal)}
          onOpenCoach={() => setShowCoach(true)}
        />

        {dataLoading ? (
          <div className="full-screen-center">Chargement du planning…</div>
        ) : (
          <>
            <div className="desktop-only">
              <WeekCalendar
                weekDays={weekDays}
                placementsByDayAndSlot={placementsByDayAndSlot}
                mealsById={mealsById}
                membersById={membersById}
                members={members}
                currentMemberId={currentMember.id}
                overridesByPlacementId={overridesByPlacementId}
                onDropOnSlot={handleDropOnSlot}
                onOpenPortion={handleOpenPortion}
                onRemovePlacement={handleRemovePlacement}
                onDuplicateForMember={handleDuplicateForMember}
                dragOverKey={dragOverKey}
                setDragOverKey={setDragOverKey}
              />
            </div>
            <div className="mobile-only">
              <MobileWeekCalendar
                weekDays={weekDays}
                placementsByDayAndSlot={placementsByDayAndSlot}
                mealsById={mealsById}
                membersById={membersById}
                members={members}
                currentMemberId={currentMember.id}
                overridesByPlacementId={overridesByPlacementId}
                meals={meals}
                onAddMeal={(mealId, iso, slotKey) => handleDropOnSlot({ type: 'library', mealId }, iso, slotKey)}
                onMoveMeal={(plannedMealId, iso, slotKey) =>
                  handleDropOnSlot({ type: 'placed', plannedMealId }, iso, slotKey)
                }
                onOpenPortion={handleOpenPortion}
                onRemovePlacement={handleRemovePlacement}
                onDuplicateForMember={handleDuplicateForMember}
              />
            </div>
          </>
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
          overridesByPlacementId={overridesByPlacementId}
          onClose={() => setShowShoppingList(false)}
        />
      )}

      {showCoach && (
        <CoachModal
          member={currentMember}
          weekDays={weekDays}
          weekLabel={formatWeekRange(weekMonday)}
          plannedMeals={plannedMeals}
          mealsById={mealsById}
          overridesByPlacementId={overridesByPlacementId}
          onClose={() => setShowCoach(false)}
        />
      )}

      {showProfile && (
        <ProfileModal
          member={currentMember}
          household={household}
          members={members}
          onClose={() => setShowProfile(false)}
          onSaved={loadHousehold}
        />
      )}

      {portionState && (
        <PortionEditor
          placement={portionState.placement}
          meal={portionState.meal}
          memberName={membersById[portionState.placement.member_id]?.display_name || '?'}
          initialOverrides={overridesByPlacementId[portionState.placement.id] || []}
          onClose={() => setPortionState(null)}
          onSave={handleSavePortion}
          onEditRecipe={handleEditRecipeFromPortion}
        />
      )}
    </div>
  )
}
