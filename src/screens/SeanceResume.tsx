import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon, TrophyIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import type { ExerciseType, Session } from '../db/database'
import { useExercisesById } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import { previousSets, useSession } from '../db/sessions'
import { formatLongDate } from '../lib/dates'
import { formatDuration, formatNumber, formatSeconds, formatSetsLine, formatVolume } from '../lib/format'
import { findBrokenRecords, RECORD_LABELS, type BrokenRecord, type RecordKind } from '../lib/records'
import { sessionStats } from '../lib/sessionStats'

interface Highlights {
  records: { exerciseId: string; records: BrokenRecord[] }[]
  firstTimes: string[]
}

async function computeHighlights(session: Session): Promise<Highlights> {
  const result: Highlights = { records: [], firstTimes: [] }
  for (const entry of session.exercises) {
    if (entry.sets.length === 0) continue
    const before = await previousSets(entry.exerciseId, session.startedAt)
    if (before.length === 0) {
      result.firstTimes.push(entry.exerciseId)
      continue
    }
    const records = findBrokenRecords(entry.type, before, entry.sets)
    if (records.length > 0) result.records.push({ exerciseId: entry.exerciseId, records })
  }
  return result
}

export function formatRecordValue(kind: RecordKind, value: number): string {
  if (kind === 'maxReps') return `${value} reps`
  if (kind === 'maxSeconds') return formatSeconds(value)
  if (kind === 'maxLest' && value === 0) return 'poids du corps'
  return `${formatNumber(Math.round(value * 10) / 10)} kg`
}

export function SeanceResume() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSession(id)
  const exercisesById = useExercisesById()
  const highlights = useLiveQuery(async () => (session ? computeHighlights(session) : undefined), [session])

  if (session === null) return <Navigate to="/" replace />
  if (!session || !exercisesById) return null

  const stats = sessionStats(session)
  const name = (exerciseId: string) => exercisesById.get(exerciseId)?.name ?? 'Exercice supprimé'
  const typeOf = (exerciseId: string): ExerciseType =>
    session.exercises.find((e) => e.exerciseId === exerciseId)?.type ?? 'weight'

  return (
    <Screen
      title={TEMPLATE_NAMES[session.templateId]}
      subtitle={formatLongDate(new Date(session.startedAt))}
      leading={
        <button className="icon-btn icon-btn-back" onClick={() => navigate('/')} aria-label="Retour à l’accueil">
          <ChevronLeftIcon />
        </button>
      }
    >
      <div className="stat-grid">
        <Stat label="Durée" value={formatDuration(stats.durationMs)} />
        <Stat label="Séries" value={String(stats.setCount)} />
        <Stat label="Volume" value={formatVolume(stats.volume)} />
      </div>

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
            <span className="muted small">{formatSetsLine(typeOf(entry.exerciseId), entry.sets)}</span>
            {entry.note && <span className="detail-note">« {entry.note} »</span>}
          </div>
        ))}
        {session.exercises.length === 0 && <p className="muted small">Aucune série.</p>}
      </div>

      <button className="btn btn-primary resume-done" onClick={() => navigate('/')}>
        Retour à l’accueil
      </button>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
