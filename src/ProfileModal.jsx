import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ProfileModal({ member, household, members, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(member.display_name || '')
  const [calories, setCalories] = useState(member.daily_calories_target || '')
  const [protein, setProtein] = useState(member.daily_protein_target || '')
  const [carbs, setCarbs] = useState(member.daily_carbs_target || '')
  const [fat, setFat] = useState(member.daily_fat_target || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { error } = await supabase
        .from('household_members')
        .update({
          display_name: displayName.trim() || member.display_name,
          daily_calories_target: calories ? Number(calories) : null,
          daily_protein_target: protein ? Number(protein) : null,
          daily_carbs_target: carbs ? Number(carbs) : null,
          daily_fat_target: fat ? Number(fat) : null,
        })
        .eq('id', member.id)
      if (error) throw error
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Impossible d\'enregistrer ton profil')
    } finally {
      setSaving(false)
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mon profil</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="household-invite-box">
              <div>
                <strong>{household.name}</strong>
                <p className="household-invite-hint">
                  Partage ce code pour que le reste de la famille rejoigne le foyer et voie les mêmes recettes.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-small" onClick={copyInviteCode}>
                {copied ? 'Copié ✓' : household.invite_code}
              </button>
            </div>

            <div className="household-members-list">
              {members.map((m) => (
                <span key={m.id} className="household-member-chip">
                  {m.display_name}
                  {m.id === member.id ? ' (toi)' : ''}
                </span>
              ))}
            </div>

            <label className="field">
              Ton prénom
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>

            <p className="generate-intro">
              Tes objectifs quotidiens serviront de valeurs par défaut lors de la génération de menu par IA.
            </p>

            <div className="macro-target-grid">
              <label className="field">
                Calories / jour
                <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="optionnel" />
              </label>
              <label className="field">
                Protéines / jour (g)
                <input type="number" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="optionnel" />
              </label>
              <label className="field">
                Glucides / jour (g)
                <input type="number" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="optionnel" />
              </label>
              <label className="field">
                Lipides / jour (g)
                <input type="number" min="0" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="optionnel" />
              </label>
            </div>

            {error && <p className="auth-error">{error}</p>}
          </div>

          <div className="modal-footer">
            <span />
            <div className="modal-footer-right">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
