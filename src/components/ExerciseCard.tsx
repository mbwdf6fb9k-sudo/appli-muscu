import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import type { Exercise, ExerciseTips, Session, SessionExercise } from '../db/database'
import { addSet, deleteSet, previousSets, setNote, updateSet, useLastPerformance } from '../db/sessions'
import { formatNumber, formatSet, formatSetsLine, formatShortDate, formatTarget } from '../lib/format'
import { haptic } from '../lib/haptics'
import { prefillNextSet, type SetValues } from '../lib/prefill'
import { suggestProgression, type Suggestion } from '../lib/progression'
import { liveRecords, type BrokenRecord } from '../lib/records'
import { CheckIcon, ChevronDownIcon, CopyIcon, InfoIcon, TrophyIcon } from './icons'
import { SetEditSheet, SetInputs, withoutTime } from './SetEditSheet'

interface ExerciseCardProps {
  session: Session
  index: number
  entry: SessionExercise
  exercise: Exercise | undefined
  open: boolean
  onToggle: () => void
  defaultStep: number
  /** Appelé quand une série qui vient d'être validée bat un record */
  onRecord: (exerciseName: string, records: BrokenRecord[]) => void
  /** Place dans un superset : « A1 », avec l'exercice à enchaîner */
  superset?: SupersetInfo
  /** Rappel d'échauffement (1er et 2e exercices) */
  warmup?: string
}

export interface SupersetInfo {
  label: string
  /** Exercice suivant de la paire (absent pour le dernier) */
  next?: string
}

export function ExerciseCard(props: ExerciseCardProps) {
  const { session, index, entry, exercise, open, onToggle, defaultStep, onRecord, superset, warmup } = props
  const name = exercise?.name ?? 'Exercice supprimé'
  const count = entry.sets.length
  const summary = count > 0 ? formatSetsLine(entry.type, entry.sets) : entry.target ? formatTarget(entry.type, entry.target) : null

  return (
    <section className={open ? 'exercise-card open' : 'exercise-card'}>
      <button className="exercise-head" onClick={onToggle} aria-expanded={open}>
        {superset && <span className="superset-badge">{superset.label}</span>}
        <span className="exercise-head-text">
          <span className="exercise-name">{name}</span>
          {summary && !open && <span className="exercise-sub">{summary}</span>}
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
          onRecord={(records) => onRecord(name, records)}
          tips={exercise?.tips}
          superset={superset}
          warmup={warmup}
        />
      )}
    </section>
  )
}

interface ExerciseBodyProps {
  session: Session
  index: number
  entry: SessionExercise
  step: number
  onRecord: (records: BrokenRecord[]) => void
  tips?: ExerciseTips
  superset?: SupersetInfo
  warmup?: string
}

function ExerciseBody({ session, index, entry, step, onRecord, tips, superset, warmup }: ExerciseBodyProps) {
  const last = useLastPerformance(entry.exerciseId, session.startedAt)
  const history = useLiveQuery(
    () => previousSets(entry.exerciseId, session.startedAt, entry.type),
    [entry.exerciseId, session.startedAt, entry.type],
  )
  // Séries record (recalculées si une série est corrigée ou supprimée)
  const records = liveRecords(entry.type, history ?? [], entry.sets)

  // Célébration : seulement pour la série qu'on vient de valider, pas au chargement ni à la correction
  const celebrateAt = useRef<number | null>(null)
  useEffect(() => {
    const at = celebrateAt.current
    if (at === null || history === undefined || entry.sets.length <= at) return
    celebrateAt.current = null
    const broken = records.get(at)
    if (broken) {
      haptic()
      onRecord(broken)
    }
  })
  const add = (values: SetValues) => {
    celebrateAt.current = entry.sets.length
    void addSet(session.id, index, values)
  }
  const lastSets = last && last.type === entry.type ? last.sets : []
  const [editing, setEditing] = useState<number | null>(null)

  const target = entry.target
  const suggestion = suggestProgression(entry.type, lastSets, target, step)

  // Valeurs proposées : recalculées dès qu'une série est ajoutée ou que « la dernière fois » est chargée
  const prefillKey = `${entry.sets.length}|${last === undefined ? 'loading' : (last?.date ?? 'none')}`
  const prefill = () => prefillNextSet(entry.type, entry.sets, lastSets, target, suggestion)
  const [draft, setDraft] = useState({ key: prefillKey, values: prefill() })
  if (draft.key !== prefillKey) setDraft({ key: prefillKey, values: prefill() })
  const setValues = (values: SetValues) => setDraft({ key: prefillKey, values })

  const lastToday = entry.sets.at(-1)

  return (
    <div className="exercise-body">
      {target && (
        <div className="target-row">
          <span className="target-text">
            <strong>{formatTarget(entry.type, target)}</strong>
            {target.rir && ` · RIR ${target.rir}`}
            {target.rest && ` · repos ${target.rest}`}
          </span>
          <span className={entry.sets.length >= target.sets ? 'target-progress done' : 'target-progress'}>
            {entry.sets.length} / {target.sets}
          </span>
        </div>
      )}
      {superset && (
        <p className="hint-chip">
          Superset {superset.label} :{' '}
          {superset.next ? `enchaîne avec ${superset.next}, sans pause.` : 'repos après la paire.'}
        </p>
      )}
      {warmup && entry.sets.length === 0 && <p className="hint-chip">{warmup}</p>}
      {tips && <TipsToggle tips={tips} />}

      <div className="last-time">
        {last === undefined ? (
          <span className="muted">…</span>
        ) : last && lastSets.length > 0 ? (
          <>
            <span className="last-time-label">Dernière fois · {formatShortDate(new Date(last.date))}</span>
            <span className="last-time-sets">{formatSetsLine(entry.type, lastSets)}</span>
            {suggestion && <SuggestionLine suggestion={suggestion} />}
          </>
        ) : (
          <span className="last-time-label">Première fois</span>
        )}
      </div>

      {entry.sets.length > 0 && (
        <ol className="set-list">
          {entry.sets.map((set, i) => (
            <li key={set.at + i}>
              <button className={records.has(i) ? 'set-chip record' : 'set-chip'} onClick={() => setEditing(i)}>
                <span className="set-num">{i + 1}</span>
                {formatSet(entry.type, set)}
                {records.has(i) && (
                  <span className="set-trophy" aria-label="Record">
                    <TrophyIcon />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}

      <SetInputs type={entry.type} values={draft.values} onChange={setValues} step={step} />

      <div className="set-actions">
        <button
          className="btn btn-primary"
          onClick={() => add(draft.values)}
          aria-label="Valider la série"
        >
          <CheckIcon /> Valider
        </button>
        <button
          className="btn btn-secondary btn-duplicate"
          disabled={!lastToday}
          onClick={() => lastToday && add(withoutTime(lastToday))}
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

function SuggestionLine({ suggestion }: { suggestion: Suggestion }) {
  const value =
    suggestion.kind === 'lest'
      ? suggestion.from === 0
        ? `Ajoute du lest : +${formatNumber(suggestion.kg)} kg`
        : `Monte le lest : ${formatNumber(suggestion.kg)} kg`
      : `Monte d’un palier : ${formatNumber(suggestion.kg)} kg`
  return (
    <span className="suggestion">
      <strong>↑ {value}</strong> — la dernière fois, toutes tes séries ont atteint {suggestion.reps} reps.
    </span>
  )
}

/** Consignes du programme, repliées par défaut. */
function TipsToggle({ tips }: { tips: ExerciseTips }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="tips">
      <button className="tips-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <InfoIcon /> Consignes
        <span className={open ? 'tips-chevron open' : 'tips-chevron'}>
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <dl className="tips-body">
          {tips.technique && (
            <>
              <dt>Technique</dt>
              <dd>{tips.technique}</dd>
            </>
          )}
          {tips.errors && (
            <>
              <dt>Erreurs</dt>
              <dd>{tips.errors}</dd>
            </>
          )}
          {tips.replacement && (
            <>
              <dt>Remplacement</dt>
              <dd>{tips.replacement}</dd>
            </>
          )}
        </dl>
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
