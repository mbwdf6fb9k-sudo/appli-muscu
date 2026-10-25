import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exercise, MuscleGroup, Session } from '../db/database'
import { formatNumber } from '../lib/format'
import { AVERAGE_WEEKS, isBehind, MUSCLE_LABELS, muscleVolume, WEEKLY_SETS_RANGE, type MuscleKey } from '../lib/muscleVolume'
import { formatTrend, muscleTrends, STATUS_LABELS, type Board } from '../lib/progressBoard'
import { BodyMap } from './BodyMap'
import { ChevronRightIcon } from './icons'
import { Sheet } from './Sheet'

type Mode = 'week' | 'average'
const MODE_KEY = 'appli-muscu-muscles-vue'

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'average' ? 'average' : 'week'
  } catch {
    return 'week'
  }
}

/** Séries de travail par muscle : semaine en cours ou moyenne des semaines terminées, avec le repère 10-20. */
export function MuscleVolume(props: { sessions: Session[]; exercisesById: Map<string, Exercise>; now: Date; board: Board }) {
  const [chosen, setChosen] = useState<Mode>(readMode)
  const [picked, setPicked] = useState<MuscleGroup | null>(null)
  const trends = muscleTrends(props.board.rows)
  const volume = muscleVolume(props.sessions, props.exercisesById, props.now)
  const mode: Mode = volume.averageWeeks === 0 ? 'week' : chosen
  const setMode = (next: Mode) => {
    setChosen(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // pas grave : on reviendra sur la semaine
    }
  }

  const value = (row: (typeof volume.rows)[number]) => (mode === 'week' ? row.week : (row.average ?? 0))
  const scale = Math.max(WEEKLY_SETS_RANGE.high + 4, ...volume.rows.map(value))
  const pct = (v: number) => `${(v / scale) * 100}%`
  const behind = mode === 'average' ? volume.rows.filter(isBehind) : []
  const mapValues = new Map(volume.rows.filter((r) => r.muscle !== 'autre').map((r) => [r.muscle as MuscleGroup, value(r)]))
  const pickedRow = picked ? volume.rows.find((r) => r.muscle === picked) : undefined

  return (
    <div className="card muscle-card">
      <div className="muscle-head">
        <span className="card-lead">Séries par muscle</span>
        <span className="muted small">séries de travail</span>
      </div>
      <div className="segmented" role="group" aria-label="Période">
        <button aria-pressed={mode === 'week'} onClick={() => setMode('week')}>
          Cette semaine
        </button>
        <button aria-pressed={mode === 'average'} onClick={() => setMode('average')} disabled={volume.averageWeeks === 0}>
          Moyenne {volume.averageWeeks > 1 ? `${volume.averageWeeks} sem.` : volume.averageWeeks === 1 ? '1 sem.' : `${AVERAGE_WEEKS} sem.`}
        </button>
      </div>

      <BodyMap values={mapValues} onPick={setPicked} />

      <ul className="muscle-list">
        {volume.rows.map((row) => {
          const v = value(row)
          const late = behind.includes(row)
          const ranged = row.muscle !== 'abdos' && row.muscle !== 'autre'
          return (
            <li
              key={row.muscle}
              className="muscle-row"
              aria-label={`${MUSCLE_LABELS[row.muscle]} : ${formatNumber(v)} série${v > 1 ? 's' : ''}${late ? ', en retard' : ''}`}
            >
              <span className="muscle-name" aria-hidden="true">
                {MUSCLE_LABELS[row.muscle]}
                {trends.has(row.muscle) && <span className="muscle-trend">{formatTrend(trends.get(row.muscle)!)}</span>}
                {late && <span className="muscle-late">en retard</span>}
              </span>
              <span className="muscle-track" aria-hidden="true">
                {ranged && (
                  <span
                    className="muscle-band"
                    style={{ left: pct(WEEKLY_SETS_RANGE.low), width: pct(WEEKLY_SETS_RANGE.high - WEEKLY_SETS_RANGE.low) }}
                  />
                )}
                {v > 0 && <span className="muscle-bar" style={{ width: pct(v) }} />}
              </span>
              <span className="muscle-value" aria-hidden="true">
                {formatNumber(v)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="muted small muscle-legend">
        <span className="muscle-band-swatch" aria-hidden="true" /> Repère indicatif : {WEEKLY_SETS_RANGE.low} à{' '}
        {WEEKLY_SETS_RANGE.high} séries par semaine et par muscle (hors abdos).
        {volume.averageWeeks === 0 && ' La moyenne arrive après ta première semaine complète.'}
      </p>
      {picked && pickedRow && (
        <MuscleSheet
          muscle={picked}
          week={pickedRow.week}
          average={pickedRow.average}
          trend={trends.get(picked)}
          board={props.board}
          exercisesById={props.exercisesById}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

/** Détail d'un muscle touché sur la carte : séries, tendance, exercices et leur statut (4 semaines). */
function MuscleSheet(props: {
  muscle: MuscleKey
  week: number
  average: number | null
  trend: number | undefined
  board: Board
  exercisesById: Map<string, Exercise>
  onClose: () => void
}) {
  const rows = props.board.rows.filter((r) => r.muscle === props.muscle)
  return (
    <Sheet open onClose={props.onClose} title={MUSCLE_LABELS[props.muscle]}>
      <div className="stat-grid muscle-stats">
        <div className="stat">
          <span className="stat-value">{formatNumber(props.week)}</span>
          <span className="stat-label">séries cette semaine</span>
        </div>
        <div className="stat">
          <span className="stat-value">{props.average !== null ? formatNumber(props.average) : '—'}</span>
          <span className="stat-label">moyenne / semaine</span>
        </div>
        <div className="stat">
          <span className="stat-value">{props.trend !== undefined ? formatTrend(props.trend) : '—'}</span>
          <span className="stat-label">tendance 4 sem.</span>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="card list-card muscle-exercises">
          {rows.map((row) => (
            <Link key={row.exerciseId} to={`/progres/exercice/${row.exerciseId}`} className="list-row board-row" onClick={props.onClose}>
              <span className="history-text">
                <span className="history-name">{props.exercisesById.get(row.exerciseId)?.name ?? 'Exercice supprimé'}</span>
                <span className="muted small">{row.best}</span>
              </span>
              <span className="list-row-end">
                <span className={`status status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
                <ChevronRightIcon />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted hint">Aucun exercice de ce muscle sur les 4 dernières semaines.</p>
      )}
    </Sheet>
  )
}
