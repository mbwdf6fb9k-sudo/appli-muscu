import { useState } from 'react'
import type { Exercise, Session } from '../db/database'
import { formatNumber } from '../lib/format'
import { AVERAGE_WEEKS, isBehind, MUSCLE_LABELS, muscleVolume, WEEKLY_SETS_RANGE } from '../lib/muscleVolume'

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
export function MuscleVolume(props: { sessions: Session[]; exercisesById: Map<string, Exercise>; now: Date }) {
  const [chosen, setChosen] = useState<Mode>(readMode)
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
    </div>
  )
}
