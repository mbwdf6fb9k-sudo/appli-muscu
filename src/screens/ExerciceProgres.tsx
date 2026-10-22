import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { LineChart } from '../components/charts/LineChart'
import { TYPE_LABELS } from '../components/ExercisePicker'
import { ChevronLeftIcon, ChevronRightIcon, TrophyIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { useExercisesById } from '../db/exercises'
import { useDoneSessions } from '../db/sessions'
import { formatSetsLine, formatShortDate } from '../lib/format'
import { exerciseHistory, exerciseRecords } from '../lib/progress'
import type { ExerciseType } from '../db/database'
import { formatRecordValue, RECORD_LABELS, type RecordKind } from '../lib/records'

/** Mesures du graphique, la première affichée par défaut (1RM estimé, avec bascule vers la charge max). */
const CHART_KINDS: Record<ExerciseType, RecordKind[]> = {
  weight: ['best1RM', 'maxKg'],
  bodyweight: ['maxReps', 'maxLest'],
  duration: ['maxSeconds'],
}

export function ExerciceProgres() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const sessions = useDoneSessions()
  const exercisesById = useExercisesById()
  const [chosen, setChosen] = useState<RecordKind | null>(null)

  if (!sessions || !exercisesById) return null

  const exercise = exercisesById.get(id)
  const history = exerciseHistory(sessions, id)
  const type = history.at(-1)?.type ?? exercise?.type ?? 'weight'
  const records = exerciseRecords(history, type)
  const kinds = CHART_KINDS[type]
  const metric = chosen && kinds.includes(chosen) ? chosen : kinds[0]

  const entries = history.filter((h) => h.type === type && h.bests[metric] !== undefined)
  const points = entries.map((h) => ({ date: new Date(h.startedAt), value: h.bests[metric]! }))
  const record = records.find((r) => r.kind === metric)
  const highlight = record ? entries.findIndex((h) => h.sessionId === record.sessionId) : undefined

  const back = () => (location.key === 'default' ? navigate('/progres') : navigate(-1))

  return (
    <Screen
      title={exercise?.name ?? 'Exercice supprimé'}
      subtitle={`${TYPE_LABELS[type]} · ${history.length} séance${history.length > 1 ? 's' : ''}`}
      leading={
        <button className="icon-btn icon-btn-back" onClick={back} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      {history.length === 0 ? (
        <p className="muted hint">Aucune séance terminée avec cet exercice pour l’instant.</p>
      ) : (
        <>
          <div className="record-grid">
            {records.map((r) => (
              <div key={r.kind} className="record-tile">
                <span className="record-tile-label">
                  <TrophyIcon /> {RECORD_LABELS[r.kind]}
                </span>
                <span className="record-tile-value">{formatRecordValue(r.kind, r.value)}</span>
                <span className="muted small">le {formatShortDate(new Date(r.date))}</span>
              </div>
            ))}
          </div>

          <h2 className="section-title">Progression</h2>
          <div className="card chart-card">
            {kinds.length > 1 && (
              <div className="segmented" role="group" aria-label="Mesure affichée">
                {kinds.map((kind) => (
                  <button key={kind} aria-pressed={metric === kind} onClick={() => setChosen(kind)}>
                    {RECORD_LABELS[kind]}
                  </button>
                ))}
              </div>
            )}
            {points.length > 0 ? (
              <LineChart
                points={points}
                format={(v) => formatRecordValue(metric, v)}
                formatDate={formatShortDate}
                highlight={highlight}
              />
            ) : (
              <p className="muted small hint">
                {metric === 'maxLest' ? 'Pas encore de série avec du lest.' : 'Pas encore de donnée pour cette mesure.'}
              </p>
            )}
            {points.length === 1 && <p className="muted small hint">La courbe se dessinera au fil de tes séances.</p>}
            {metric === 'best1RM' && (
              <p className="muted small hint">1RM estimé : charge × (1 + reps / 30), séries de 12 reps ou moins.</p>
            )}
          </div>

          <h2 className="section-title">Séances</h2>
          <div className="card list-card">
            {[...history].reverse().map((h) => (
              <Link key={h.sessionId} to={`/progres/seance/${h.sessionId}`} className="list-row history-row">
                <span className="history-text">
                  <span className="history-name">
                    {new Date(h.startedAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="muted small">{formatSetsLine(h.type, h.sets)}</span>
                </span>
                <ChevronRightIcon />
              </Link>
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}
