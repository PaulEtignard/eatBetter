import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function HouseholdGate({ session, onReady }) {
  const [mode, setMode] = useState('create') // create | join
  const [householdName, setHouseholdName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function backfillLegacyData(householdId, memberId) {
    const userId = session.user.id
    await supabase
      .from('meals')
      .update({ household_id: householdId })
      .eq('user_id', userId)
      .is('household_id', null)
    await supabase
      .from('planned_meals')
      .update({ household_id: householdId, member_id: memberId })
      .eq('user_id', userId)
      .is('household_id', null)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!householdName.trim() || !displayName.trim()) {
      setError('Renseigne un nom de foyer et ton prénom.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: household, error: hErr } = await supabase
        .from('households')
        .insert({ name: householdName.trim(), created_by: session.user.id })
        .select()
        .single()
      if (hErr) throw hErr

      const { data: member, error: mErr } = await supabase
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: session.user.id,
          display_name: displayName.trim(),
        })
        .select()
        .single()
      if (mErr) throw mErr

      await backfillLegacyData(household.id, member.id)
      onReady()
    } catch (err) {
      setError(err.message || 'Impossible de créer le foyer')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!inviteCode.trim() || !displayName.trim()) {
      setError('Renseigne le code et ton prénom.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: found, error: rpcErr } = await supabase.rpc('find_household_by_invite_code', {
        code: inviteCode.trim(),
      })
      if (rpcErr) throw rpcErr
      if (!found || found.length === 0) {
        setError('Aucun foyer ne correspond à ce code.')
        setLoading(false)
        return
      }
      const householdId = found[0].id

      const { data: member, error: mErr } = await supabase
        .from('household_members')
        .insert({
          household_id: householdId,
          user_id: session.user.id,
          display_name: displayName.trim(),
        })
        .select()
        .single()
      if (mErr) throw mErr

      await backfillLegacyData(householdId, member.id)
      onReady()
    } catch (err) {
      setError(err.message || 'Impossible de rejoindre ce foyer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark">🏡</span>
          <h1>Ton foyer</h1>
          <p>Crée un foyer ou rejoins celui de ta famille pour partager les recettes.</p>
        </div>

        <div className="household-tabs">
          <button
            type="button"
            className={`household-tab ${mode === 'create' ? 'is-active' : ''}`}
            onClick={() => setMode('create')}
          >
            Créer un foyer
          </button>
          <button
            type="button"
            className={`household-tab ${mode === 'join' ? 'is-active' : ''}`}
            onClick={() => setMode('join')}
          >
            Rejoindre
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="auth-form">
            <label>
              Nom du foyer
              <input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Ex. Famille Étignard"
              />
            </label>
            <label>
              Ton prénom
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Paul" />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon foyer'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="auth-form">
            <label>
              Code d'invitation
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Ex. A1B2C3"
                maxLength={8}
              />
            </label>
            <label>
              Ton prénom
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Léa" />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connexion…' : 'Rejoindre le foyer'}
            </button>
          </form>
        )}

        <button type="button" className="auth-switch" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
