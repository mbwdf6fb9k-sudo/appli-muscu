import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon, PlusIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import type { Supplement, SupplementMoment } from '../db/database'
import { deleteSupplement, saveSupplement, useSupplements } from '../db/supplements'
import { MOMENT_ORDER, MOMENTS } from '../lib/supplements'

const NONE = 'aucun'
const momentLabel = (moment: SupplementMoment | null) => (moment ? MOMENTS[moment].label : 'pas ce jour-là')

export function ComplementsListe() {
  const navigate = useNavigate()
  const supplements = useSupplements()
  // undefined = fermé, null = nouveau complément
  const [editing, setEditing] = useState<Supplement | null | undefined>(undefined)

  if (!supplements) return null

  return (
    <Screen
      title="Mes compléments"
      leading={
        <button className="icon-btn icon-btn-back" onClick={() => navigate('/complements')} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      <div className="card list-card">
        {supplements.map((s) => (
          <button key={s.id} className="list-row supp-manage-row" onClick={() => setEditing(s)}>
            <span className="history-text">
              <span className="history-name">
                {s.name}
                {s.dose && <span className="muted"> ({s.dose})</span>}
              </span>
              <span className="muted small">Entraînement : {momentLabel(s.training)}</span>
              <span className="muted small">Repos : {momentLabel(s.rest)}</span>
            </span>
          </button>
        ))}
        {supplements.length === 0 && <p className="muted small hint">Aucun complément.</p>}
      </div>
      <div className="session-tools session-tools-stack">
        <button className="btn btn-secondary" onClick={() => setEditing(null)}>
          <PlusIcon /> Ajouter un complément
        </button>
      </div>

      {editing !== undefined && <SupplementSheet supplement={editing} onClose={() => setEditing(undefined)} />}
    </Screen>
  )
}

function SupplementSheet({ supplement, onClose }: { supplement: Supplement | null; onClose: () => void }) {
  const [name, setName] = useState(supplement?.name ?? '')
  const [dose, setDose] = useState(supplement?.dose ?? '')
  const [note, setNote] = useState(supplement?.note ?? '')
  const [training, setTraining] = useState<SupplementMoment | null>(supplement ? supplement.training : 'breakfast')
  const [rest, setRest] = useState<SupplementMoment | null>(supplement ? supplement.rest : 'breakfast')
  const [caffeine, setCaffeine] = useState(supplement?.caffeine ?? false)

  async function save() {
    if (!name.trim()) return
    await saveSupplement({ name, dose, note, training, rest, caffeine }, supplement?.id)
    onClose()
  }

  async function remove() {
    if (!supplement || !confirm(`Supprimer « ${supplement.name} » de ta liste ?`)) return
    await deleteSupplement(supplement.id)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={supplement ? 'Modifier le complément' : 'Nouveau complément'}>
      <label className="field">
        <span className="field-label">Nom</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Dose (facultatif)</span>
        <input className="text-input" placeholder="ex. 3 à 5 g" value={dose} onChange={(e) => setDose(e.target.value)} />
      </label>
      <MomentSelect label="Jour d’entraînement" value={training} onChange={setTraining} withSession />
      <MomentSelect label="Jour de repos" value={rest} onChange={setRest} />
      <label className="field">
        <span className="field-label">Rappel (facultatif)</span>
        <input className="text-input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="check-field">
        <input type="checkbox" checked={caffeine} onChange={(e) => setCaffeine(e.target.checked)} />
        <span>
          Contient de la caféine
          <span className="muted small"> : avertissement si la séance est après 18 h</span>
        </span>
      </label>
      <div className="sheet-actions">
        <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
          Enregistrer
        </button>
        {supplement && (
          <button className="btn btn-ghost btn-danger" onClick={remove}>
            Supprimer le complément
          </button>
        )}
      </div>
    </Sheet>
  )
}

function MomentSelect(props: {
  label: string
  value: SupplementMoment | null
  onChange: (value: SupplementMoment | null) => void
  /** Proposer les moments liés à la séance (jour d'entraînement seulement) */
  withSession?: boolean
}) {
  const options = MOMENT_ORDER.filter((m) => props.withSession || !MOMENTS[m].session)
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <select
        className="text-input select-input"
        value={props.value ?? NONE}
        onChange={(e) => props.onChange(e.target.value === NONE ? null : (e.target.value as SupplementMoment))}
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {MOMENTS[m].label}
          </option>
        ))}
        <option value={NONE}>Pas ce jour-là</option>
      </select>
    </label>
  )
}
