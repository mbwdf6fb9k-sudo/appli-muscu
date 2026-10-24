import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon, PlusIcon, TrophyIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { SetEditSheet, withoutTime } from '../components/SetEditSheet'
import type { Exercise, Session, SessionExercise } from '../db/database'
import { useExercisesById } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import {
  addSet,
  changeSessionDate,
  deleteSession,
  deleteSet,
  previousSets,
  removeExercise,
  setNote,
  updateSet,
  useSession,
} from '../db/sessions'
import { useSettings } from '../db/settings'
import { formatLongDate, localDateStamp } from '../lib/dates'
import { formatDuration, formatSet, formatSetsLine, formatVolume } from '../lib/format'
import { DEFAULT_VALUES, type SetValues } from '../lib/prefill'
import { findBrokenRecords, formatRecordValue, RECORD_LABELS, type BrokenRecord } from '../lib/records'
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
    const records = findBrokenRecords(entry.type, before, entry.sets)
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
  const [editing, setEditing] = useState(false)
  const highlights = useLiveQuery(async () => (session ? computeHighlights(session) : undefined), [session])

  const home = mode === 'resume' ? '/' : '/progres'
  if (session === null) return <Navigate to={home} replace />
  if (!session || !exercisesById || !settings) return null

  const stats = sessionStats(session)
  const name = (exerciseId: string) => exercisesById.get(exerciseId)?.name ?? 'Exercice supprimé'
  const back = () => (mode === 'history' && location.key !== 'default' ? navigate(-1) : navigate(home))

  async function handleDelete() {
    if (!confirm('Supprimer définitivement cette séance ?\n\nSes séries ne compteront plus dans tes records.')) return
    navigate(home, { replace: true })
    await deleteSession(session!.id)
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

      {editing ? (
        <EditSession session={session} exercisesById={exercisesById} defaultStep={settings.weightStep} onDelete={handleDelete} />
      ) : (
        <>
          {highlights && highlights.records.length > 0 && (
            <>
              <h2 className="section-title">Records battus</h2>
              <div className="record-list">
                {highlights.records.map(({ exerciseId, records }) => (
                  <div key={exerciseId} className="record-card">
                    <span className="record-icon">
                      <TrophyIcon />
                    </span>
                    <span className="record-text">
                      <span className="record-name">{name(exerciseId)}</span>
                      {records.map((r) => (
                        <span key={r.kind} className="record-line">
                          {RECORD_LABELS[r.kind]} : <strong>{formatRecordValue(r.kind, r.value)}</strong>{' '}
                          <span className="muted">(avant {formatRecordValue(r.kind, r.previous)})</span>
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
                <span className="detail-name">{name(entry.exerciseId)}</span>
                <span className="muted small">{detailLine(entry)}</span>
                {entry.note && <span className="detail-note">« {entry.note} »</span>}
              </div>
            ))}
            {session.exercises.length === 0 && <p className="muted small">Aucune série.</p>}
          </div>

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

/** « 10 × 60 · 8 × 62,5 → 5 × 50 kg · + 2 échauffements » (séries de travail et dégressives d'abord) */
function detailLine(entry: SessionExercise): string {
  const shown = effortSets(entry.sets)
  const warmups = entry.sets.length - shown.length
  const warmupText = warmups > 0 ? `${warmups} échauffement${warmups > 1 ? 's' : ''}` : ''
  if (shown.length === 0) return warmupText
  return warmupText ? `${formatSetsLine(entry.type, shown)} · + ${warmupText}` : formatSetsLine(entry.type, shown)
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
                removeExercise(session.id, index)
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
              : updateSet(session.id, sheet.index, sheet.setIndex, values)
          }
          onDelete={sheet.setIndex === null ? undefined : () => deleteSet(session.id, sheet.index, sheet.setIndex!)}
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
