import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { exportToFile } from '../lib/backupFile'
import { compareExercise, compareSession, type SessionComparison } from '../lib/compare'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon, PlusIcon, ShieldIcon, TrophyIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { SetEditSheet, withoutTime } from '../components/SetEditSheet'
import type { Exercise, Session, SessionExercise } from '../db/database'
import { useExercisesById } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import {
  addSet,
  bestPreviousVolume,
  changeSessionDate,
  previousSets,
  setNote,
  useDoneSessions,
  useSession,
} from '../db/sessions'
import { deleteSessionUndoable, deleteSetUndoable, removeExerciseUndoable, updateSetUndoable } from '../db/undoable'
import { useSettings } from '../db/settings'
import { daysSince, formatDaysAgo, formatLongDate, localDateStamp } from '../lib/dates'
import { formatDuration, formatNumber, formatSet, formatSetsLine, formatShortDate, formatVolume } from '../lib/format'
import { DEFAULT_VALUES, type SetValues } from '../lib/prefill'
import { findBrokenRecords, formatRecord, RECORD_LABELS, type BrokenRecord, type RecordKind } from '../lib/records'
import { sessionStats } from '../lib/sessionStats'
import { canBeDrop, effortSets, setLabel, setTitle } from '../lib/sets'

interface Highlights {
  records: { exerciseId: string; records: BrokenRecord[] }[]
  firstTimes: string[]
}

async function computeHighlights(session: Session): Promise<Highlights> {
  const result: Highlights = { records: [], firstTimes: [] }
  for (const entry of session.exercises) {
    if (entry.sets.length === 0) continue
    const before = await previousSets(entry.exerciseId, session.startedAt, entry.type)
    if (before.length === 0) {
      result.firstTimes.push(entry.exerciseId)
      continue
    }
    const records = findBrokenRecords(
      entry.type,
      before,
      entry.sets,
      await bestPreviousVolume(entry.exerciseId, session.startedAt, entry.type),
    )
    if (records.length > 0) result.records.push({ exerciseId: entry.exerciseId, records })
  }
  return result
}

/**
 * Détail d'une séance terminée.
 * - « resume » : juste après « Terminer » (sans barre d'onglets, retour à l'accueil)
 * - « history » : depuis l'onglet Progrès
 * Dans les deux cas, « Modifier » permet de corriger la séance.
 */
export function SeanceResume({ mode }: { mode: 'resume' | 'history' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSession(id)
  const exercisesById = useExercisesById()
  const settings = useSettings()
  const doneSessions = useDoneSessions()
  const [editing, setEditing] = useState(false)
  const highlights = useLiveQuery(async () => (session ? computeHighlights(session) : undefined), [session])

  const home = mode === 'resume' ? '/' : '/progres'
  if (session === null) return <Navigate to={home} replace />
  if (!session || !exercisesById || !settings) return null

  const stats = sessionStats(session)
  const comparison = doneSessions ? compareSession(session, doneSessions) : null
  const name = (exerciseId: string) => exercisesById.get(exerciseId)?.name ?? 'Exercice supprimé'
  const back = () => (mode === 'history' && location.key !== 'default' ? navigate(-1) : navigate(home))

  async function handleDelete() {
    if (!confirm('Supprimer définitivement cette séance ?\n\nSes séries ne compteront plus dans tes records.')) return
    navigate(home, { replace: true })
    await deleteSessionUndoable(session!.id)
  }

  return (
    <Screen
      title={TEMPLATE_NAMES[session.templateId]}
      subtitle={`${formatLongDate(new Date(session.startedAt))}${session.deload ? ' · allégée' : ''}`}
      leading={
        <button className="icon-btn icon-btn-back" onClick={back} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
      trailing={
        <button className={editing ? 'btn btn-primary btn-small' : 'btn btn-secondary btn-small'} onClick={() => setEditing(!editing)}>
          {editing ? 'Terminé' : 'Modifier'}
        </button>
      }
    >
      <div className="stat-grid">
        <Stat label="Durée" value={formatDuration(stats.durationMs)} />
        <Stat label="Séries" value={String(stats.setCount)} />
        <Stat label="Volume" value={formatVolume(stats.volume)} />
      </div>
      {comparison && !editing && <SessionCompareLine session={session} comparison={comparison} />}

      {editing ? (
        <EditSession session={session} exercisesById={exercisesById} defaultStep={settings.weightStep} onDelete={handleDelete} />
      ) : (
        <>
          {highlights && highlights.records.length > 0 && (
            <>
              <h2 className="section-title">Records battus</h2>
              <div className="record-list">
                {byKind(highlights.records).map(({ kind, items }) => (
                  <div key={kind} className="record-card">
                    <span className="record-icon">
                      <TrophyIcon />
                    </span>
                    <span className="record-text">
                      <span className="record-name">{RECORD_LABELS[kind]}</span>
                      {items.map(({ exerciseId, record }) => (
                        <span key={exerciseId} className="record-line">
                          {name(exerciseId)} : <strong>{formatRecord(record).value}</strong>{' '}
                          <span className="muted">(avant {formatRecord(record).previous})</span>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {highlights && highlights.firstTimes.length > 0 && (
            <>
              <h2 className="section-title">Première fois</h2>
              <p className="muted small hint first-times">{highlights.firstTimes.map(name).join(' · ')}</p>
            </>
          )}

          <h2 className="section-title">Détail</h2>
          <div className="card detail-list">
            {session.exercises.map((entry) => (
              <div key={entry.exerciseId} className="detail-row">
                <span className="detail-head">
                  <span className="detail-name">{name(entry.exerciseId)}</span>
                  {doneSessions && <CompareBadge session={session} entry={entry} sessions={doneSessions} />}
                </span>
                <span className="muted small">{detailLine(entry)}</span>
                {entry.note && <span className="detail-note">« {entry.note} »</span>}
              </div>
            ))}
            {session.exercises.length === 0 && <p className="muted small">Aucune série.</p>}
          </div>

          {mode === 'resume' && <BackupNow lastExportAt={settings.lastExportAt} />}

          {mode === 'resume' && (
            <button className="btn btn-primary resume-done" onClick={() => navigate('/')}>
              Retour à l’accueil
            </button>
          )}
        </>
      )}
    </Screen>
  )
}

/** « Par rapport à ta dernière Pecs-Triceps (24 oct.) : volume +8 % · +2 séries » */
function SessionCompareLine({ session, comparison }: { session: Session; comparison: SessionComparison }) {
  const pct = comparison.volume === null ? null : Math.round(comparison.volume * 100)
  const tone = (value: number) => (value > 0 ? 'compare-up' : value < 0 ? 'compare-down' : '')
  const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`
  return (
    <p className="muted small session-compare">
      Par rapport à ta dernière {TEMPLATE_NAMES[session.templateId]} ({formatShortDate(new Date(comparison.date))}) :{' '}
      {pct !== null && (
        <>
          volume <strong className={tone(pct)}>{pct === 0 ? 'identique' : `${signed(pct)} %`}</strong> ·{' '}
        </>
      )}
      <strong className={tone(comparison.sets)}>
        {comparison.sets === 0 ? 'même nombre de séries' : `${signed(comparison.sets)} série${Math.abs(comparison.sets) > 1 ? 's' : ''}`}
      </strong>
    </p>
  )
}

/** « +2,5 kg », « −1 rep », « = », « nouveau » */
function CompareBadge({ session, entry, sessions }: { session: Session; entry: SessionExercise; sessions: Session[] }) {
  const result = compareExercise(session, entry, sessions)
  if (!result) return null
  return <span className={`compare-badge compare-${result.tone}`}>{result.label}</span>
}

/** Sauvegarde en un geste, juste après la séance (même export que dans les Réglages). */
function BackupNow({ lastExportAt }: { lastExportAt: string | null }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  async function save() {
    setState('busy')
    try {
      setState((await exportToFile()) === 'cancelled' ? 'idle' : 'done')
    } catch {
      setState('error')
    }
  }
  return (
    <div className="resume-backup">
      <button className="btn btn-secondary" onClick={save} disabled={state === 'busy'}>
        <ShieldIcon /> {state === 'done' ? 'Sauvegardé ✓' : 'Sauvegarder mes données'}
      </button>
      <p className={state === 'error' ? 'feedback feedback-error' : 'muted small'}>
        {state === 'error'
          ? 'La sauvegarde a échoué. Réessaie.'
          : lastExportAt
            ? `Dernière sauvegarde ${formatDaysAgo(daysSince(lastExportAt))}`
            : 'Aucune sauvegarde pour l’instant'}
      </p>
    </div>
  )
}

/** « 10 × 60 · 8 × 62,5 → 5 × 50 kg · + 2 échauffements » (séries de travail et dégressives d'abord) */
function detailLine(entry: SessionExercise): string {
  const shown = effortSets(entry.sets)
  const warmups = entry.sets.length - shown.length
  const warmupText = warmups > 0 ? `${warmups} échauffement${warmups > 1 ? 's' : ''}` : ''
  if (shown.length === 0) return warmupText
  return warmupText ? `${formatSetsLine(entry.type, shown)} · + ${warmupText}` : formatSetsLine(entry.type, shown)
}

/** Records de la séance rangés par type : « Charge max », « 1RM estimé », « Reps à charge », « Volume (séance) »… */
function byKind(list: Highlights['records']): { kind: RecordKind; items: { exerciseId: string; record: BrokenRecord }[] }[] {
  const order = Object.keys(RECORD_LABELS) as RecordKind[]
  return order
    .map((kind) => ({
      kind,
      items: list.flatMap(({ exerciseId, records }) =>
        records.filter((r) => r.kind === kind).map((record) => ({ exerciseId, record })),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

type SheetState = { index: number; setIndex: number | null } | null

function EditSession(props: {
  session: Session
  exercisesById: Map<string, Exercise>
  defaultStep: number
  onDelete: () => void
}) {
  const { session, exercisesById, defaultStep } = props
  const [sheet, setSheet] = useState<SheetState>(null)
  const entry = sheet ? session.exercises[sheet.index] : undefined
  const step = (e: SessionExercise) => exercisesById.get(e.exerciseId)?.step ?? defaultStep

  const initialFor = (e: SessionExercise, setIndex: number | null): SetValues =>
    setIndex !== null
      ? withoutTime(e.sets[setIndex])
      : e.sets.length
        ? { ...withoutTime(e.sets.at(-1)!), drop: undefined }
        : DEFAULT_VALUES[e.type]

  return (
    <>
      <h2 className="section-title">Date</h2>
      <div className="card time-field">
        <label htmlFor="session-date">Jour de la séance</label>
        <input
          id="session-date"
          type="date"
          value={session.date}
          max={localDateStamp(new Date())}
          onChange={(e) => e.target.value && changeSessionDate(session.id, e.target.value)}
        />
      </div>

      <h2 className="section-title">Exercices</h2>
      <div className="edit-list">
        {session.exercises.map((e, index) => (
          <div key={e.exerciseId} className="card edit-exercise">
            <span className="detail-name">{exercisesById.get(e.exerciseId)?.name ?? 'Exercice supprimé'}</span>
            <ol className="set-list">
              {e.sets.map((set, setIndex) => (
                <li key={set.at + setIndex}>
                  <button
                    className={set.warmup ? 'set-chip warmup' : set.drop ? 'set-chip drop' : 'set-chip'}
                    onClick={() => setSheet({ index, setIndex })}
                  >
                    <span className="set-num">{setLabel(e.sets, setIndex)}</span>
                    {formatSet(e.type, set)}
                  </button>
                </li>
              ))}
              <li>
                <button className="set-chip set-chip-add" onClick={() => setSheet({ index, setIndex: null })}>
                  <PlusIcon /> Série
                </button>
              </li>
            </ol>
            <NoteEditor sessionId={session.id} index={index} initial={e.note} />
            <button
              className="btn btn-ghost btn-danger btn-small"
              onClick={() =>
                confirm(`Retirer ${exercisesById.get(e.exerciseId)?.name ?? 'cet exercice'} de cette séance ?`) &&
                removeExerciseUndoable(session.id, index)
              }
            >
              Retirer l’exercice
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn-secondary btn-danger resume-done" onClick={props.onDelete}>
        Supprimer la séance
      </button>

      {sheet && entry && (
        <SetEditSheet
          key={`${sheet.index}-${sheet.setIndex}`}
          type={entry.type}
          title={sheet.setIndex === null ? 'Ajouter une série' : setTitle(entry.sets, sheet.setIndex)}
          canDrop={sheet.setIndex !== null && canBeDrop(entry.sets, sheet.setIndex)}
          initial={initialFor(entry, sheet.setIndex)}
          step={step(entry)}
          onClose={() => setSheet(null)}
          onSave={(values) =>
            sheet.setIndex === null
              ? addSet(session.id, sheet.index, values)
              : updateSetUndoable(session.id, sheet.index, sheet.setIndex, values)
          }
          onDelete={sheet.setIndex === null ? undefined : () => deleteSetUndoable(session.id, sheet.index, sheet.setIndex!)}
        />
      )}
    </>
  )
}

function NoteEditor({ sessionId, index, initial }: { sessionId: string; index: number; initial: string }) {
  const [text, setText] = useState(initial)
  return (
    <textarea
      className="text-input note-input"
      placeholder="Note (réglage de machine, sensation…)"
      rows={1}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== initial && setNote(sessionId, index, text)}
    />
  )
}
