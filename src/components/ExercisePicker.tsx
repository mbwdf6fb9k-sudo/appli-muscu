import { useMemo, useState } from 'react'
import type { ExerciseType } from '../db/database'
import { createExercise, useExercises } from '../db/exercises'
import { PlusIcon } from './icons'
import { Sheet } from './Sheet'

export const TYPE_LABELS: Record<ExerciseType, string> = {
  weight: 'Charge × reps',
  bodyweight: 'Poids du corps',
  duration: 'Durée',
}

interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  /** Exercices déjà présents, non proposés */
  excludeIds: string[]
  onPick: (exerciseId: string) => void
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Choisir un exercice existant, ou en créer un nouveau. */
export function ExercisePicker({ open, onClose, excludeIds, onPick }: ExercisePickerProps) {
  const exercises = useExercises()
  const [search, setSearch] = useState('')
  const [newType, setNewType] = useState<ExerciseType>('weight')

  const query = normalize(search)
  const results = useMemo(
    () =>
      (exercises ?? [])
        .filter((e) => !e.hidden && !excludeIds.includes(e.id) && normalize(e.name).includes(query))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [exercises, excludeIds, query],
  )
  const exactMatch = (exercises ?? []).some((e) => !e.hidden && normalize(e.name) === query)

  const close = () => {
    setSearch('')
    onClose()
  }
  const pick = (id: string) => {
    onPick(id)
    close()
  }
  const create = async () => {
    const exercise = await createExercise(search, newType)
    pick(exercise.id)
  }

  return (
    <Sheet open={open} onClose={close} title="Ajouter un exercice">
      <input
        className="text-input"
        type="search"
        placeholder="Rechercher ou créer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />

      {query && !exactMatch && (
        <div className="card create-box">
          <p className="card-lead">Créer « {search.trim()} »</p>
          <div className="segmented segmented-3" role="group" aria-label="Type d’exercice">
            {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((type) => (
              <button key={type} aria-pressed={newType === type} onClick={() => setNewType(type)}>
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={create}>
            <PlusIcon /> Créer et ajouter
          </button>
        </div>
      )}

      <div className="picker-list">
        {results.map((exercise) => (
          <button key={exercise.id} className="list-row" onClick={() => pick(exercise.id)}>
            <span>{exercise.name}</span>
            <span className="muted small">{TYPE_LABELS[exercise.type]}</span>
          </button>
        ))}
        {results.length === 0 && !query && <p className="muted small hint">Tous tes exercices sont déjà là.</p>}
      </div>
    </Sheet>
  )
}
