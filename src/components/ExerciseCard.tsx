import { useEffect, useRef, useState } from 'react'
import type { Exercise, Session, SessionExercise } from '../db/database'
import { addSet, deleteSet, setNote, updateSet, useLastPerformance } from '../db/sessions'
import { formatSet, formatSetsLine, formatShortDate } from '../lib/format'
import { prefillNextSet, type SetValues } from '../lib/prefill'
import { CheckIcon, ChevronDownIcon, CopyIcon } from './icons'
import { SetEditSheet, SetInputs, withoutTime } from './SetEditSheet'

interface ExerciseCardProps {
  session: Session
  index: number
  entry: SessionExercise
  exercise: Exercise | undefined
  open: boolean
  onToggle: () => void
  defaultStep: number
}

export function ExerciseCard({ session, index, entry, exercise, open, onToggle, defaultStep }: ExerciseCardProps) {
  const name = exercise?.name ?? 'Exercice supprimé'
  const count = entry.sets.length

  return (
    <section className={open ? 'exercise-card open' : 'exercise-card'}>
      <button className="exercise-head" onClick={onToggle} aria-expanded={open}>
        <span className="exercise-head-text">
          <span className="exercise-name">{name}</span>
          {count > 0 && !open && <span className="exercise-sub">{formatSetsLine(entry.type, entry.sets)}</span>}
        </span>
        {count > 0 && <span className="set-count">{count}</span>}
        <span className="exercise-chevron">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <ExerciseBody
          session={session}
          index={index}
          entry={entry}
          step={exercise?.step ?? defaultStep}
        />
      )}
    </section>
  )
}

function ExerciseBody({ session, index, entry, step }: { session: Session; index: number; entry: SessionExercise; step: number }) {
  const last = useLastPerformance(entry.exerciseId, session.startedAt)
  const lastSets = last && last.type === entry.type ? last.sets : []
  const [editing, setEditing] = useState<number | null>(null)

  // Valeurs proposées : recalculées dès qu'une série est ajoutée ou que « la dernière fois » est chargée
  const prefillKey = `${entry.sets.length}|${last === undefined ? 'loading' : (last?.date ?? 'none')}`
  const [draft, setDraft] = useState({ key: prefillKey, values: prefillNextSet(entry.type, entry.sets, lastSets) })
  if (draft.key !== prefillKey) setDraft({ key: prefillKey, values: prefillNextSet(entry.type, entry.sets, lastSets) })
  const setValues = (values: SetValues) => setDraft({ key: prefillKey, values })

  const lastToday = entry.sets.at(-1)

  return (
    <div className="exercise-body">
      <div className="last-time">
        {last === undefined ? (
          <span className="muted">…</span>
        ) : last && lastSets.length > 0 ? (
          <>
            <span className="last-time-label">Dernière fois · {formatShortDate(new Date(last.date))}</span>
            <span className="last-time-sets">{formatSetsLine(entry.type, lastSets)}</span>
          </>
        ) : (
          <span className="last-time-label">Première fois</span>
        )}
      </div>

      {entry.sets.length > 0 && (
        <ol className="set-list">
          {entry.sets.map((set, i) => (
            <li key={set.at + i}>
              <button className="set-chip" onClick={() => setEditing(i)}>
                <span className="set-num">{i + 1}</span>
                {formatSet(entry.type, set)}
              </button>
            </li>
          ))}
        </ol>
      )}

      <SetInputs type={entry.type} values={draft.values} onChange={setValues} step={step} />

      <div className="set-actions">
        <button
          className="btn btn-primary"
          onClick={() => addSet(session.id, index, draft.values)}
          aria-label="Valider la série"
        >
          <CheckIcon /> Valider
        </button>
        <button
          className="btn btn-secondary btn-duplicate"
          disabled={!lastToday}
          onClick={() => lastToday && addSet(session.id, index, withoutTime(lastToday))}
          aria-label="Dupliquer la série précédente"
        >
          <CopyIcon /> Dupliquer
        </button>
      </div>

      <NoteField sessionId={session.id} index={index} initial={entry.note} />

      {editing !== null && entry.sets[editing] && (
        <SetEditSheet
          type={entry.type}
          title={`Série ${editing + 1}`}
          initial={withoutTime(entry.sets[editing])}
          step={step}
          onClose={() => setEditing(null)}
          onSave={(values) => updateSet(session.id, index, editing, values)}
          onDelete={() => deleteSet(session.id, index, editing)}
        />
      )}
    </div>
  )
}

/** Note libre, enregistrée automatiquement pendant la frappe. */
function NoteField({ sessionId, index, initial }: { sessionId: string; index: number; initial: string }) {
  const [text, setText] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const save = (value: string) => {
    clearTimeout(timer.current)
    void setNote(sessionId, index, value)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <textarea
      className="text-input note-input"
      placeholder="Note (réglage de machine, sensation…)"
      rows={1}
      value={text}
      onChange={(e) => {
        const value = e.target.value
        setText(value)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => save(value), 500)
      }}
      onBlur={(e) => save(e.target.value)}
    />
  )
}
