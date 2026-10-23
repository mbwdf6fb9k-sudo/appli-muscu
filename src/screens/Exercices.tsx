import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TYPE_LABELS } from '../components/ExercisePicker'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import type { Exercise, ExerciseType, MuscleGroup, TemplateId } from '../db/database'
import { createExercise, deleteExercise, updateExercise, useExercises, useTemplates } from '../db/exercises'
import { PROGRAM_RULES } from '../db/program'
import { TEMPLATE_NAMES } from '../db/seed'
import { setSetting, useSettings } from '../db/settings'
import { formatNumber, parseNumber } from '../lib/format'
import { MUSCLE_LABELS, MUSCLE_ORDER } from '../lib/muscleVolume'

const TEMPLATE_ORDER: TemplateId[] = ['dos-biceps', 'pecs-triceps', 'jambes', 'bras', 'abdos']

export function Exercices() {
  const navigate = useNavigate()
  const settings = useSettings()
  const exercises = useExercises()
  const templates = useTemplates()
  // undefined = fermé, null = nouvel exercice
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined)

  if (!settings || !exercises || !templates) return null
  const visible = exercises.filter((e) => !e.hidden).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return (
    <Screen
      title="Exercices"
      leading={
        <button className="icon-btn icon-btn-back" onClick={() => navigate('/reglages')} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      <h2 className="section-title">Règles du programme</h2>
      <div className="card rules">
        {PROGRAM_RULES.map((rule) => (
          <p key={rule.title}>
            <strong>{rule.title}</strong> : {rule.text}
          </p>
        ))}
      </div>

      <h2 className="section-title">Pas de charge par défaut</h2>
      <div className="card">
        <Stepper
          label="Kg ajoutés ou retirés par les boutons + / −"
          value={settings.weightStep}
          step={0.5}
          min={0.5}
          onChange={(value) => setSetting('weightStep', value)}
        />
      </div>

      <h2 className="section-title">Modèles de séance</h2>
      <div className="card list-card">
        {TEMPLATE_ORDER.map((id) => {
          const template = templates.find((t) => t.id === id)
          const count = template?.exerciseIds.length ?? 0
          return (
            <Link key={id} to={`/reglages/modeles/${id}`} className="list-row">
              <span>{template?.name ?? TEMPLATE_NAMES[id]}</span>
              <span className="list-row-end muted small">
                {count} exercice{count > 1 ? 's' : ''} <ChevronRightIcon />
              </span>
            </Link>
          )
        })}
      </div>

      <h2 className="section-title">Tous les exercices ({visible.length})</h2>
      <button className="btn btn-secondary" onClick={() => setEditing(null)}>
        <PlusIcon /> Nouvel exercice
      </button>
      <div className="card list-card exercise-index">
        {visible.map((exercise) => (
          <button key={exercise.id} className="list-row" onClick={() => setEditing(exercise)}>
            <span>{exercise.name}</span>
            <span className="muted small">{TYPE_LABELS[exercise.type]}</span>
          </button>
        ))}
      </div>

      {editing !== undefined && (
        <ExerciseEditSheet exercise={editing} defaultStep={settings.weightStep} onClose={() => setEditing(undefined)} />
      )}
    </Screen>
  )
}

function ExerciseEditSheet(props: { exercise: Exercise | null; defaultStep: number; onClose: () => void }) {
  const { exercise, defaultStep, onClose } = props
  const [name, setName] = useState(exercise?.name ?? '')
  const [type, setType] = useState<ExerciseType>(exercise?.type ?? 'weight')
  const [step, setStep] = useState(exercise?.step ? formatNumber(exercise.step) : '')
  const [technique, setTechnique] = useState(exercise?.tips?.technique ?? '')
  const [errors, setErrors] = useState(exercise?.tips?.errors ?? '')
  const [replacement, setReplacement] = useState(exercise?.tips?.replacement ?? '')
  const [compound, setCompound] = useState(!!exercise?.compound)
  const [muscle, setMuscle] = useState<MuscleGroup | ''>(exercise?.muscle ?? '')

  async function save() {
    if (!name.trim()) return
    const parsedStep = parseNumber(step)
    const changes = {
      name,
      type,
      step: parsedStep && parsedStep > 0 ? parsedStep : undefined,
      tips: { technique, errors, replacement },
      compound,
      muscle: muscle || null,
    }
    if (exercise) await updateExercise(exercise.id, changes)
    else {
      const created = await createExercise(name, type)
      await updateExercise(created.id, changes)
    }
    onClose()
  }

  async function remove() {
    if (!exercise) return
    if (!confirm(`Supprimer « ${exercise.name} » ?\n\nIl sera retiré des modèles. Ton historique est conservé.`)) return
    await deleteExercise(exercise.id)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={exercise ? 'Modifier l’exercice' : 'Nouvel exercice'}>
      <label className="field">
        <span className="field-label">Nom</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span className="field-label">Type</span>
        <div className="segmented segmented-3" role="group" aria-label="Type d’exercice">
          {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((value) => (
            <button key={value} aria-pressed={type === value} onClick={() => setType(value)}>
              {TYPE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field-label">Muscle principal</span>
        <select className="text-input" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | '')}>
          <option value="">Autre / non précisé</option>
          {MUSCLE_ORDER.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABELS[m]}
            </option>
          ))}
        </select>
        <span className="muted small">Sert au compte des séries par muscle (Progrès).</span>
      </label>
      {type !== 'duration' && (
        <label className="field">
          <span className="field-label">{type === 'bodyweight' ? 'Pas du lest (kg)' : 'Pas de charge (kg)'}</span>
          <input
            className="text-input"
            inputMode="decimal"
            placeholder={`Par défaut : ${formatNumber(defaultStep)}`}
            value={step}
            onChange={(e) => setStep(e.target.value)}
          />
        </label>
      )}
      {type !== 'duration' && (
        <label className="check-field">
          <input type="checkbox" checked={compound} onChange={(e) => setCompound(e.target.checked)} />
          <span>
            Polyarticulaire
            <span className="muted small"> : échauffement proposé aussi en 2e exercice de la séance</span>
          </span>
        </label>
      )}
      <label className="field">
        <span className="field-label">Technique (consignes)</span>
        <textarea className="text-input goal-input" rows={3} value={technique} onChange={(e) => setTechnique(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Erreurs à éviter</span>
        <textarea className="text-input goal-input" rows={2} value={errors} onChange={(e) => setErrors(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Remplacement</span>
        <input className="text-input" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
      </label>
      <div className="sheet-actions">
        <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
          Enregistrer
        </button>
        {exercise && (
          <button className="btn btn-ghost btn-danger" onClick={remove}>
            Supprimer l’exercice
          </button>
        )}
      </div>
    </Sheet>
  )
}
