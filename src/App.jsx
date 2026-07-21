import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import HouseholdGate from './HouseholdGate'
import ProfileModal from './ProfileModal'
import PortionEditor from './PortionEditor'
import MealLibrary from './MealLibrary'
import WeekCalendar from './WeekCalendar'
import MealEditor from './MealEditor'
import ShoppingList from './ShoppingList'
import GenerateMenuModal from './GenerateMenuModal'
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
  const [showGenerateMenu, setShowGenerateMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
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

  async function handleGenerateMenu(params, onProgress) {
    console.log('[handleGenerateMenu] called with params:', params)

    function normalizeName(str) {
      return str.trim().toLowerCase()
    }

    // Cap how many times any single recipe (existing or newly invented) can appear across
    // the whole generated period, so the AI is forced toward variety instead of always
    // reaching for the same "safe" match once it's in the known-recipes pool.
    const USAGE_CAP = 2

    // Give the AI a compact summary of existing household recipes so it can reuse them.
    // This list grows as the loop below discovers newly-invented recipes, so day 3 knows
    // about recipes invented on day 1 within the SAME generation run.
    const knownMeals = meals.map((m) => ({
      name: m.name,
      category: m.category,
      calories: Math.round(mealMacros(m.ingredients).calories),
    }))
    const usageCount = new Map()

    const userId = session.user.id
    const memberId = params.memberId
    const totalDays = params.days

    // Slots already occupied by this member's own placements: the AI still invents/creates
    // recipes for every day+slot (so the library grows), but we won't place a new meal on
    // top of a cell this member has already filled in. Query fresh instead of trusting
    // React state, which could be stale if this runs right after another change.
    const { data: freshPlanned, error: freshErr } = await supabase
      .from('planned_meals')
      .select('plan_date, slot, member_id')
      .eq('member_id', memberId)
    if (freshErr) throw freshErr
    const occupiedKeys = new Set(freshPlanned.map((p) => `${p.plan_date}__${p.slot}`))
    console.log('[handleGenerateMenu] occupied cells for this member:', occupiedKeys.size)

    // Generate one day at a time: a full week in one request risks exceeding the
    // serverless function's execution time limit and failing silently.
    const allDayResults = []
    for (let i = 0; i < totalDays; i += 1) {
      if (onProgress) onProgress(`Génération du jour ${i + 1} / ${totalDays}…`)
      console.log(`[generateMenu] requesting day ${i + 1}/${totalDays}…`)

      // Only offer recipes that haven't already hit the reuse cap
      const availableForReuse = knownMeals.filter(
        (km) => (usageCount.get(normalizeName(km.name)) || 0) < USAGE_CAP
      )

      let res
      try {
        res = await fetch('/api/generate-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            days: 1,
            dailyCalories: params.dailyCalories,
            dailyProtein: params.dailyProtein,
            dailyCarbs: params.dailyCarbs,
            dailyFat: params.dailyFat,
            slots: params.slots,
            preferences: params.preferences,
            existingMeals: availableForReuse,
          }),
        })
      } catch (networkErr) {
        console.error('[generateMenu] network error on fetch:', networkErr)
        throw new Error(`Impossible de contacter le serveur pour le jour ${i + 1} (erreur réseau). Vérifie ta connexion et réessaie.`)
      }

      console.log(`[generateMenu] day ${i + 1} response status:`, res.status)

      let data
      try {
        data = await res.json()
      } catch (parseErr) {
        console.error('[generateMenu] failed to parse JSON response:', parseErr)
        throw new Error(
          `Le serveur n'a pas répondu correctement pour le jour ${i + 1} (délai dépassé ou erreur réseau, statut ${res.status}). Réessaie.`
        )
      }

      console.log(`[generateMenu] day ${i + 1} data:`, data)

      if (data.error === 'missing_api_key') {
        throw new Error(
          "La clé OpenRouter n'est pas configurée côté serveur (variable OPENROUTER_API_KEY manquante sur Vercel)."
        )
      }
      if (data.error || !Array.isArray(data.days) || data.days.length === 0) {
        console.error(`[generateMenu] day ${i + 1} generation failed:`, data)
        throw new Error(`L'IA n'a pas réussi à générer le jour ${i + 1} (${data.error || 'réponse vide'}). Réessaie.`)
      }

      const dayResult = data.days[0]
      allDayResults.push(dayResult)

      // Track usage and feed newly-invented recipes into the pool for subsequent days
      ;(dayResult.meals || []).forEach((meal) => {
        const effectiveName = meal.reuse || meal.name
        const key = normalizeName(effectiveName)
        usageCount.set(key, (usageCount.get(key) || 0) + 1)
        if (!knownMeals.some((km) => normalizeName(km.name) === key)) {
          const cal = Array.isArray(meal.ingredients) ? Math.round(mealMacros(meal.ingredients).calories) : 0
          knownMeals.push({ name: effectiveName, category: meal.slot, calories: cal })
        }
      })
    }

    if (onProgress) onProgress('Enregistrement du menu…')

    // Flatten every generated meal across all days into one list
    const flatMeals = []
    allDayResults.forEach((day, dayIndex) => {
      ;(day.meals || []).forEach((meal) => {
        flatMeals.push({
          dayIndex,
          slot: meal.slot,
          name: meal.reuse || meal.name,
          ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
        })
      })
    })

    if (flatMeals.length === 0) {
      throw new Error("L'IA n'a généré aucun repas.")
    }

    // Dedupe by normalized recipe name: against the existing household library first,
    // then within this very batch (across days), so repeated/near-identical names collapse
    // into a single recipe instead of piling up duplicates.
    const dbMealByName = new Map(meals.map((m) => [normalizeName(m.name), m]))
    const batchKeyToMeal = new Map() // normalized name -> { name, ingredients } chosen for creation
    const toCreate = []

    flatMeals.forEach((m) => {
      const key = normalizeName(m.name)
      if (dbMealByName.has(key)) return // will resolve to existing DB meal later
      if (batchKeyToMeal.has(key)) {
        // Prefer an occurrence that actually has ingredients over an empty "reuse" stub
        const current = batchKeyToMeal.get(key)
        if (current.ingredients.length === 0 && m.ingredients.length > 0) {
          batchKeyToMeal.set(key, m)
        }
        return
      }
      batchKeyToMeal.set(key, m)
    })
    batchKeyToMeal.forEach((m) => toCreate.push(m))

    console.log(
      '[handleGenerateMenu] flat meals:', flatMeals.length,
      '| reused from existing library:', flatMeals.filter((m) => dbMealByName.has(normalizeName(m.name))).length,
      '| new unique recipes to create:', toCreate.length
    )

    // 1. Bulk create only the genuinely new meal rows
    let insertedMeals = []
    if (toCreate.length > 0) {
      console.log('[handleGenerateMenu] creating', toCreate.length, 'new meals')
      const mealRows = toCreate.map((m) => ({
        user_id: userId,
        household_id: household.id,
        name: m.name,
        color: SLOT_COLORS[m.slot] || '#e8b930',
        category: m.slot,
        ai_generated: true,
      }))
      const { data: created, error: mealsErr } = await supabase.from('meals').insert(mealRows).select()
      if (mealsErr) {
        console.error('[handleGenerateMenu] meals insert failed:', mealsErr)
        throw mealsErr
      }
      insertedMeals = created

      const ingredientRows = []
      toCreate.forEach((m, idx) => {
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
            piece_weight_g: ing.unit === 'pièce' ? Number(ing.piece_weight_g) || 100 : null,
            position,
          })
        })
      })
      if (ingredientRows.length > 0) {
        const { error: ingErr } = await supabase.from('meal_ingredients').insert(ingredientRows)
        if (ingErr) {
          console.error('[handleGenerateMenu] ingredients insert failed:', ingErr)
          throw ingErr
        }
        cacheIngredientMacros(ingredientRows.map((r) => ({ ...r, source: 'ai' })))
      }
    }

    // Build a normalized-name -> meal_id map covering both the existing DB library
    // and the recipes just created in this batch
    const keyToMealId = new Map()
    dbMealByName.forEach((meal, key) => keyToMealId.set(key, meal.id))
    toCreate.forEach((m, idx) => {
      keyToMealId.set(normalizeName(m.name), insertedMeals[idx].id)
    })

    // 2. Bulk place each meal on its target day/slot, for the chosen member —
    // skipping any cell that member has already filled in, and de-duplicating
    // within this batch as a safety net (e.g. if the AI ever returns two meals
    // for the same slot in one day)
    const skippedMeals = []
    const placementRows = []
    const placedKeysThisRun = new Set()
    flatMeals.forEach((m) => {
      const iso = toISODate(addDays(weekMonday, m.dayIndex))
      const key = `${iso}__${m.slot}`
      if (occupiedKeys.has(key) || placedKeysThisRun.has(key)) {
        skippedMeals.push(m)
        return
      }
      placedKeysThisRun.add(key)
      placementRows.push({
        user_id: userId,
        household_id: household.id,
        member_id: memberId,
        meal_id: keyToMealId.get(normalizeName(m.name)),
        plan_date: iso,
        slot: m.slot,
      })
    })

    if (skippedMeals.length > 0) {
      console.log(
        `[handleGenerateMenu] ${skippedMeals.length} recette(s) créée(s) mais non placée(s) (créneau déjà occupé):`,
        skippedMeals.map((m) => `${m.name} (jour ${m.dayIndex + 1}, ${m.slot})`)
      )
    }

    console.log('[handleGenerateMenu] placing', placementRows.length, 'meals on the calendar')
    if (placementRows.length > 0) {
      const { error: placeErr } = await supabase.from('planned_meals').insert(placementRows)
      if (placeErr) {
        console.error('[handleGenerateMenu] placements insert failed:', placeErr)
        throw placeErr
      }
    }

    console.log('[handleGenerateMenu] success, reloading data')
    setShowGenerateMenu(false)
    if (skippedMeals.length > 0) {
      setInfoMsg(
        `Menu généré : ${placementRows.length} repas placés. ${skippedMeals.length} recette(s) créée(s) et ajoutée(s) à ta bibliothèque, mais pas placées car ces créneaux étaient déjà occupés.`
      )
      setTimeout(() => setInfoMsg(''), 8000)
    }
    await loadData()
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
          onOpenGenerate={() => setShowGenerateMenu(true)}
        />

        {dataLoading ? (
          <div className="full-screen-center">Chargement du planning…</div>
        ) : (
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

      {showGenerateMenu && (
        <GenerateMenuModal
          members={members}
          onCancel={() => setShowGenerateMenu(false)}
          onGenerate={handleGenerateMenu}
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
