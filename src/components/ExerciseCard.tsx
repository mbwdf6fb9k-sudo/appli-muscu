import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import type { Exercise, ExerciseTips, Session, SessionExercise } from '../db/database'
import { addSet, bestPreviousVolume, deleteSet, lastNote, previousSets, setNote, updateSet, useLastPerformance } from '../db/sessions'
import { effortText, formatSet, formatSetsLine, formatShortDate, formatTarget } from '../lib/format'
import { haptic } from '../lib/haptics'
import { dailyObjective, warmupSets } from '../lib/objective'
import { prefillNextSet, type SetValues } from '../lib/prefill'
import { liveRecords, type BrokenRecord } from '../lib/records'
import { canBeDrop, effortSets, setLabel, setTitle, workSets } from '../lib/sets'
import { CheckIcon, ChevronDownIcon, CopyIcon, DropIcon, InfoIcon, PlusIcon, TrophyIcon } from './icons'
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
  /** Échauffement proposé : 1er exercice, ou 2e s'il est polyarticulaire */
  warmupPosition?: 'first' | 'second'
  /** N'a pas progressé sur 3 séances d'affilée : l'explication (« Pas de progrès depuis 3 séances (…) ») */
  stagnation?: string
}

export interface SupersetInfo {
  label: string
  /** Exercice suivant de la paire (absent pour le dernier) */
  next?: string
}

export function ExerciseCard(props: ExerciseCardProps) {
  const { session, index, entry, exercise, open, onToggle, defaultStep, onRecord, superset } = props
  const name = exercise?.name ?? 'Exercice supprimé'
  const work = workSets(entry.sets)
  const summary =
    work.length > 0 ? formatSetsLine(entry.type, effortSets(entry.sets)) : entry.target ? formatTarget(entry.type, entry.target) : null

  return (
    <section className={open ? 'exercise-card open' : 'exercise-card'}>
      <button className="exercise-head" onClick={onToggle} aria-expanded={open}>
        {superset && <span className="superset-badge">{superset.label}</span>}
        <span className="exercise-head-text">
          <span className="exercise-name">{name}</span>
          {summary && !open && <span className="exercise-sub">{summary}</span>}
        </span>
        {props.stagnation && <span className="stagnation-badge">stagnation</span>}
        {work.length > 0 && <span className="set-count">{work.length}</span>}
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
          warmupPosition={props.warmupPosition}
          stagnation={props.stagnation}
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
  warmupPosition?: 'first' | 'second'
  stagnation?: string
}

function ExerciseBody(props: ExerciseBodyProps) {
  const { session, index, entry, step, onRecord, tips, superset, warmupPosition, stagnation } = props
  // « La dernière fois » : dernière séance, allégée ou non. Objectif du jour : dernière séance NON allégée.
  const last = useLastPerformance(entry.exerciseId, session.startedAt)
  const lastNormal = useLastPerformance(entry.exerciseId, session.startedAt, true)
  const history = useLiveQuery(
    () => previousSets(entry.exerciseId, session.startedAt, entry.type),
    [entry.exerciseId, session.startedAt, entry.type],
  )
  const bestVolume = useLiveQuery(
    () => bestPreviousVolume(entry.exerciseId, session.startedAt, entry.type),
    [entry.exerciseId, session.startedAt, entry.type],
  )
  // Séries record (recalculées si une série est corrigée ou supprimée ; jamais un échauffement ni une dégressive)
  const records = liveRecords(entry.type, history ?? [], entry.sets, bestVolume ?? 0)

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
  const [editing, setEditing] = useState<number | null>(null)
  // Dernière note non vide de l'exercice (toutes séances confondues) ; « Reprendre » la copie dans celle du jour
  const previousNote = useLiveQuery(() => lastNote(entry.exerciseId, session.startedAt), [entry.exerciseId, session.startedAt])
  const [copiedNote, setCopiedNote] = useState<string | null>(null)

  const target = entry.target
  const lastSets = last && last.type === entry.type ? last.sets : []
  const objectiveSets = lastNormal && lastNormal.type === entry.type ? lastNormal.sets : []
  const loading = last === undefined || lastNormal === undefined
  const objective = loading ? null : dailyObjective(entry.type, objectiveSets, target, step, !!session.deload)

  const work = workSets(entry.sets)
  const warmups = entry.sets.filter((s) => s.warmup).length

  // Valeurs proposées : recalculées dès qu'une série est ajoutée ou que l'historique est chargé
  const prefillKey = `${entry.sets.length}|${loading ? 'loading' : `${last?.date ?? 'none'}|${lastNormal?.date ?? 'none'}`}`
  const prefill = () => prefillNextSet(entry.type, entry.sets, lastSets, target, objective?.plan)
  const [draft, setDraft] = useState({ key: prefillKey, values: prefill() })
  if (draft.key !== prefillKey) setDraft({ key: prefillKey, values: prefill() })
  const setValues = (values: SetValues) => setDraft({ key: prefillKey, values })

  // Échauffement proposé d'après la charge de travail du champ kg (pré-rempli avec l'objectif)
  const proposals = warmupPosition && work.length === 0 ? warmupSets(entry.type, draft.values.kg ?? 0, step, warmupPosition) : []
  const lastWork = work.at(-1)
  // Dégressive : seulement juste après une série de travail (ou une autre dégressive), jamais en durée
  const dropOf = entry.type !== 'duration' && canBeDrop(entry.sets, entry.sets.length) ? work.length : null

  return (
    <div className="exercise-body">
      {previousNote && (
        <p className="last-note">
          <span className="last-note-text">
            Dernière note ({formatShortDate(new Date(previousNote.date))}) : {previousNote.note}
          </span>
          {(copiedNote ?? entry.note).trim() !== previousNote.note && (
            <button
              className="btn btn-ghost btn-small last-note-copy"
              onClick={async () => {
                await setNote(session.id, index, previousNote.note)
                setCopiedNote(previousNote.note)
              }}
            >
              Reprendre
            </button>
          )}
        </p>
      )}
      {target && (
        <div className="target-row">
          <span className="target-text">
            <strong>{formatTarget(entry.type, target)}</strong>
            {target.rest && ` · repos ${target.rest}`}
          </span>
          <span className={work.length >= target.sets ? 'target-progress done' : 'target-progress'}>
            {work.length} / {target.sets}
          </span>
        </div>
      )}
      {target?.rir && <p className="effort-hint">{effortText(target.rir)}</p>}
      {superset && (
        <p className="hint-chip">
          Superset {superset.label} :{' '}
          {superset.next ? `enchaîne avec ${superset.next}, sans pause.` : 'repos après la paire.'}
        </p>
      )}
      {stagnation && (
        <p className="hint-chip hint-stagnation">
          {stagnation} : baisse de 10 % et remonte
          {tips?.replacement ? `, ou passe à l’exercice de remplacement : ${tips.replacement.replace(/\.$/, '')}.` : '.'}
        </p>
      )}
      {tips && <TipsToggle tips={tips} />}

      <div className="last-time">
        {loading ? (
          <span className="muted">…</span>
        ) : last && lastSets.length > 0 ? (
          <>
            <span className="last-time-label">Dernière fois · {formatShortDate(new Date(last.date))}</span>
            <span className="last-time-sets">{formatSetsLine(entry.type, lastSets)}</span>
          </>
        ) : objective?.rule === 'first' ? null : (
          // L'objectif du jour dit déjà « Première fois » : pas de doublon
          <span className="last-time-label">Première fois</span>
        )}
        {objective && (
          <span className={`objective objective-${objective.rule}`}>
            <span className="objective-label">Objectif du jour</span>
            <strong>{objective.text}</strong>
            <span className="objective-reason">{objective.reason}</span>
          </span>
        )}
      </div>

      {proposals.length > 0 && (
        <div className="warmup-box">
          <span className="warmup-title">Échauffement proposé · non compté</span>
          <div className="warmup-list">
            {proposals.map((p, i) => {
              const done = i < warmups
              return (
                <button
                  key={i}
                  className={done ? 'warmup-chip done' : 'warmup-chip'}
                  disabled={done || i > warmups}
                  onClick={() => add(p)}
                  aria-label={`Ajouter l’échauffement ${formatSet(entry.type, { ...p, at: '' })}`}
                >
                  {done ? <CheckIcon /> : <PlusIcon />}
                  {formatSet(entry.type, { ...p, at: '' })}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {entry.sets.length > 0 && (
        <ol className="set-list">
          {entry.sets.map((set, i) => {
            const label = setLabel(entry.sets, i)
            return (
              <li key={set.at + i}>
                <button
                  className={['set-chip', set.warmup ? 'warmup' : '', set.drop ? 'drop' : '', records.has(i) ? 'record' : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setEditing(i)}
                  aria-label={`${setTitle(entry.sets, i)} : ${formatSet(entry.type, set)}`}
                >
                  <span className="set-num">{label}</span>
                  {formatSet(entry.type, set)}
                  {records.has(i) && (
                    <span className="set-trophy" aria-label="Record">
                      <TrophyIcon />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <SetInputs type={entry.type} values={draft.values} onChange={setValues} step={step} />

      <div className="set-actions">
        <button className="btn btn-primary" onClick={() => add({ ...draft.values, warmup: undefined, drop: undefined })} aria-label="Valider la série">
          <CheckIcon /> Valider
        </button>
        <button
          className="btn btn-secondary btn-duplicate"
          disabled={!lastWork}
          onClick={() => lastWork && add({ ...withoutTime(lastWork), drop: undefined })}
          aria-label="Dupliquer la série précédente"
        >
          <CopyIcon /> Dupliquer
        </button>
      </div>
      {dropOf !== null && (
        <button
          className="btn btn-ghost btn-drop"
          onClick={() => add({ ...draft.values, warmup: undefined, drop: true })}
          aria-label={`Ajouter ${formatSet(entry.type, { ...draft.values, at: '' })} en dégressive de la série ${dropOf}`}
        >
          <DropIcon /> En dégressive de la série {dropOf}
        </button>
      )}

      {/* Après « Reprendre », le champ repart de la note copiée */}
      <NoteField key={copiedNote ?? ''} sessionId={session.id} index={index} initial={copiedNote ?? entry.note} />

      {editing !== null && entry.sets[editing] && (
        <SetEditSheet
          type={entry.type}
          title={setTitle(entry.sets, editing)}
          canDrop={canBeDrop(entry.sets, editing)}
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
