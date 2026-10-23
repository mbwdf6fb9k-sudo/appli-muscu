import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { EditableRow } from '../components/EditableRow'
import { ExercisePicker, TYPE_LABELS } from '../components/ExercisePicker'
import { ChevronLeftIcon, PlusIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import type { Exercise, Target, TemplateId } from '../db/database'
import { setTemplateExercises, setTemplateTarget, useExercisesById, useTemplate } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import { formatTarget } from '../lib/format'

export function ModeleEdition() {
  const { id } = useParams()
  const navigate = useNavigate()
  const templateId = id && id in TEMPLATE_NAMES ? (id as TemplateId) : undefined
  const template = useTemplate(templateId)
  const exercisesById = useExercisesById()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)

  if (!templateId || template === null) return <Navigate to="/reglages/exercices" replace />
  if (!template || !exercisesById) return null

  const list = template.exerciseIds.filter((x) => exercisesById.has(x) && !exercisesById.get(x)?.hidden)
  const save = (ids: string[]) => setTemplateExercises(templateId, ids)

  const move = (index: number, direction: -1 | 1) => {
    const next = [...list]
    const [moved] = next.splice(index, 1)
    next.splice(index + direction, 0, moved)
    void save(next)
  }

  const detail = (exercise: Exercise) => {
    const target = template.targets?.[exercise.id]
    if (!target) return `${TYPE_LABELS[exercise.type]} · pas d’objectif`
    const parts = [formatTarget(exercise.type, target)]
    if (target.rir) parts.push(`RIR ${target.rir}`)
    if (target.superset) parts.push(`superset ${target.superset}`)
    return parts.join(' · ')
  }

  return (
    <Screen
      title={template.name}
      subtitle={[template.duration, 'touche un exercice pour ses objectifs'].filter(Boolean).join(' · ')}
      leading={
        <button className="icon-btn icon-btn-back" onClick={() => navigate('/reglages/exercices')} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      <div className="card editable-list">
        {list.map((exerciseId, index) => {
          const exercise = exercisesById.get(exerciseId)!
          return (
            <EditableRow
              key={exerciseId}
              label={exercise.name}
              detail={detail(exercise)}
              isFirst={index === 0}
              isLast={index === list.length - 1}
              onMove={(direction) => move(index, direction)}
              onRemove={() => save(list.filter((x) => x !== exerciseId))}
              onOpen={() => setEditing(exercise)}
            />
          )
        })}
        {list.length === 0 && <p className="muted small hint">Aucun exercice dans ce modèle.</p>}
      </div>
      <div className="session-tools session-tools-stack">
        <button className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
          <PlusIcon /> Ajouter un exercice
        </button>
      </div>
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={list}
        onPick={(exerciseId) => save([...list, exerciseId])}
      />
      {editing && (
        <TargetSheet
          exercise={editing}
          target={template.targets?.[editing.id]}
          onClose={() => setEditing(null)}
          onSave={(target) => setTemplateTarget(templateId, editing.id, target)}
        />
      )}
    </Screen>
  )
}

/** Objectifs d'un exercice dans le modèle : séries, fourchette, RIR, repos, superset. */
function TargetSheet(props: {
  exercise: Exercise
  target: Target | undefined
  onClose: () => void
  onSave: (target: Target | null) => void
}) {
  const { exercise, target } = props
  const duration = exercise.type === 'duration'
  const [sets, setSets] = useState(target?.sets ?? 3)
  const [min, setMin] = useState(target?.min ?? (duration ? 30 : 8))
  const [max, setMax] = useState(target?.max ?? (duration ? 60 : 12))
  const [rir, setRir] = useState(target?.rir ?? '')
  const [rest, setRest] = useState(target?.rest ?? '')
  const [superset, setSuperset] = useState(target?.superset ?? '')
  const unit = duration ? 'Secondes' : 'Reps'

  const save = () => {
    const next: Target = { sets, min: Math.min(min, max), max: Math.max(min, max) }
    if (rir.trim()) next.rir = rir.trim()
    if (rest.trim()) next.rest = rest.trim()
    if (superset.trim()) next.superset = superset.trim().toUpperCase().slice(0, 2)
    props.onSave(next)
    props.onClose()
  }

  return (
    <Sheet open onClose={props.onClose} title={exercise.name}>
      <div className="field-grid field-grid-3">
        <Stepper label="Séries" value={sets} step={1} min={1} integer onChange={setSets} />
        <Stepper label={`${unit} min`} value={min} step={duration ? 5 : 1} min={1} integer onChange={setMin} />
        <Stepper label={`${unit} max`} value={max} step={duration ? 5 : 1} min={1} integer onChange={setMax} />
      </div>
      <div className="field-grid">
        <label className="field">
          <span className="field-label">RIR</span>
          <input className="text-input" placeholder="ex. 1-2" value={rir} onChange={(e) => setRir(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Repos</span>
          <input className="text-input" placeholder="ex. 2 min" value={rest} onChange={(e) => setRest(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Superset (lettre, facultatif)</span>
        <input
          className="text-input"
          placeholder="ex. A : les exercices de même lettre s’enchaînent"
          value={superset}
          maxLength={2}
          onChange={(e) => setSuperset(e.target.value)}
        />
      </label>
      <div className="sheet-actions">
        <button className="btn btn-primary" onClick={save}>
          Enregistrer
        </button>
        {target && (
          <button
            className="btn btn-ghost btn-danger"
            onClick={() => {
              props.onSave(null)
              props.onClose()
            }}
          >
            Retirer l’objectif
          </button>
        )}
      </div>
    </Sheet>
  )
}
