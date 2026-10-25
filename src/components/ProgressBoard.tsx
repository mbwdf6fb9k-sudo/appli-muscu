import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exercise } from '../db/database'
import { formatShortDate } from '../lib/format'
import { MUSCLE_LABELS } from '../lib/muscleVolume'
import {
  formatEvolution,
  PERIOD_LABELS,
  sortRows,
  STATUS_LABELS,
  type Board,
  type BoardPeriod,
  type BoardRow,
  type BoardSort,
  type BoardStatus,
} from '../lib/progressBoard'
import { ChevronRightIcon } from './icons'

const SORT_KEY = 'appli-muscu-tableau-tri'

function readSort(): BoardSort {
  try {
    return localStorage.getItem(SORT_KEY) === 'stagnation' ? 'stagnation' : 'muscle'
  } catch {
    return 'muscle'
  }
}

const SUMMARY: [BoardStatus, string, string][] = [
  ['progress', 'en progression', 'en progression'],
  ['stable', 'stable', 'stables'],
  ['stagnation', 'en stagnation', 'en stagnation'],
  ['down', 'en baisse', 'en baisse'],
]

/** Tableau de progrès : résumé, période, tri et une ligne par exercice (Progrès → Exercices). */
export function ProgressBoard(props: {
  board: Board
  period: BoardPeriod
  onPeriod: (period: BoardPeriod) => void
  exercisesById: Map<string, Exercise>
}) {
  const { board, period, exercisesById } = props
  const [sort, setSortState] = useState<BoardSort>(readSort)
  const setSort = (next: BoardSort) => {
    setSortState(next)
    try {
      localStorage.setItem(SORT_KEY, next)
    } catch {
      // pas grave : on reviendra au tri par muscle
    }
  }
  const name = (id: string) => exercisesById.get(id)?.name ?? 'Exercice supprimé'
  const rows = sortRows(board.rows, sort, name)
  const summary = SUMMARY.filter(([status]) => board.counts[status] > 0).map(
    ([status, one, many]) => `${board.counts[status]} ${board.counts[status] > 1 ? many : one}`,
  )

  // Par muscle : un titre par groupe ; « stagnations d'abord » : une seule liste
  const groups: { title: string | null; rows: BoardRow[] }[] = []
  for (const row of rows) {
    const title = sort === 'muscle' ? MUSCLE_LABELS[row.muscle] : null
    if (groups.at(-1)?.title === title && groups.length > 0) groups.at(-1)!.rows.push(row)
    else groups.push({ title, rows: [row] })
  }

  return (
    <div className="board">
      <div className="segmented segmented-3" role="group" aria-label="Période">
        {(Object.keys(PERIOD_LABELS) as BoardPeriod[]).map((p) => (
          <button key={p} aria-pressed={period === p} onClick={() => props.onPeriod(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="segmented board-sort" role="group" aria-label="Tri">
        <button aria-pressed={sort === 'muscle'} onClick={() => setSort('muscle')}>
          Par muscle
        </button>
        <button aria-pressed={sort === 'stagnation'} onClick={() => setSort('stagnation')}>
          Stagnations d’abord
        </button>
      </div>

      <p className="board-summary">
        {summary.length > 0 ? summary.join(' · ') : 'Pas encore assez de séances sur la période pour un statut.'}
        {board.counts.insufficient > 0 && (
          <span className="muted small">
            {' '}
            · {board.counts.insufficient} avec moins de 3 séances
          </span>
        )}
      </p>

      {rows.length === 0 && <p className="muted hint">Aucun exercice fait sur cette période.</p>}
      {groups.map((group, i) => (
        <section key={`${group.title}-${i}`}>
          {group.title && <h2 className="section-title">{group.title}</h2>}
          <div className={group.title ? 'card list-card' : 'card list-card board-flat'}>
            {group.rows.map((row) => (
              <Link key={row.exerciseId} to={`/progres/exercice/${row.exerciseId}`} className="list-row board-row">
                <span className="history-text">
                  <span className="history-name">{name(row.exerciseId)}</span>
                  <span className="muted small">
                    {[row.best, row.evolution !== null ? formatEvolution(row.evolution) : null, formatShortDate(new Date(row.lastDate))]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="list-row-end">
                  <span className={`status status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
                  <ChevronRightIcon />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
