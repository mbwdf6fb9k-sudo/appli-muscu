import type { Exercise, ExerciseType, Session, SetEntry } from '../db/database'
import { formatNumber, formatSeconds } from './format'
import { MUSCLE_ORDER, type MuscleKey } from './muscleVolume'
import { exerciseHistory, sessionRecords, type HistoryEntry } from './progress'
import { exerciseStagnates } from './stagnation'

export type BoardPeriod = '4w' | '3m' | 'all'

export const PERIOD_LABELS: Record<BoardPeriod, string> = { '4w': '4 semaines', '3m': '3 mois', all: 'Depuis le début' }
const PERIOD_DAYS: Record<BoardPeriod, number> = { '4w': 28, '3m': 92, all: Infinity }

export type BoardStatus = 'progress' | 'stable' | 'stagnation' | 'down' | 'insufficient'

export const STATUS_LABELS: Record<BoardStatus, string> = {
  progress: '↑ Progression',
  stable: '→ Stable',
  stagnation: '⚠ Stagnation',
  down: '↓ En baisse',
  insufficient: 'Pas assez de données',
}

/** Seuils : +2 % pour progresser, −5 % du meilleur pour une baisse, 3 séances au moins. */
const PROGRESS_GAIN = 0.02
const DROP_FROM_BEST = 0.05
const MIN_SESSIONS = 3

/** Score d'une série : 1RM estimé (Epley, sans limite de reps), poids du corps + lest, ou secondes. */
function setScore(type: ExerciseType, set: SetEntry, bodyweight: number): number {
  if (type === 'duration') return set.seconds ?? 0
  const reps = set.reps ?? 0
  const load = type === 'bodyweight' ? bodyweight + (set.kg ?? 0) : (set.kg ?? 0)
  if (reps <= 0 || load <= 0) return 0
  return load * (1 + reps / 30)
}

/**
 * Score de performance d'une séance (séries retenues : les N premières séries de travail) :
 * charge → meilleur 1RM estimé ; poids du corps → même formule avec (dernière pesée + lest) ; durée → meilleure durée.
 */
export function sessionScore(type: ExerciseType, retained: SetEntry[], bodyweight: number): number | null {
  const best = Math.max(0, ...retained.map((s) => setScore(type, s, bodyweight)))
  return best > 0 ? best : null
}

/** « 60 kg × 8 », « +5 kg × 8 », « 12 reps », « 45 s » : la meilleure série retenue. */
export function bestSetLabel(type: ExerciseType, retained: SetEntry[], bodyweight: number): string {
  const best = [...retained].sort((a, b) => setScore(type, b, bodyweight) - setScore(type, a, bodyweight))[0]
  if (!best) return ''
  if (type === 'duration') return formatSeconds(best.seconds ?? 0)
  if (type === 'bodyweight') return best.kg ? `+${formatNumber(best.kg)} kg × ${best.reps ?? 0}` : `${best.reps ?? 0} reps`
  return `${formatNumber(best.kg ?? 0)} kg × ${best.reps ?? 0}`
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

export interface BoardRow {
  exerciseId: string
  type: ExerciseType
  muscle: MuscleKey
  status: BoardStatus
  /** Évolution : moyenne des 2 dernières séances / moyenne des 2 premières de la période − 1 */
  evolution: number | null
  /** Meilleure série de la dernière séance */
  best: string
  lastDate: string
  sessions: number
}

export interface Board {
  rows: BoardRow[]
  counts: Record<BoardStatus, number>
}

/**
 * Tableau de progrès : un statut par exercice fait sur la période (séances allégées mises de côté).
 * 1. moins de 3 séances → pas assez de données ;
 * 2. moyenne des 2 dernières ≤ −5 % du meilleur score de la période → en baisse
 *    (avant la stagnation : un exercice qui baisse ne bat plus rien, il serait sinon toujours « en stagnation ») ;
 * 3. stagnation (règle existante) ;
 * 4. moyenne des 2 dernières ≥ +2 % de celle des 2 premières, ou record battu sur les 3 dernières (hors volume) → progression ;
 * 5. sinon → stable.
 */
export function progressBoard(
  sessions: Session[],
  exercisesById: Map<string, Exercise>,
  period: BoardPeriod,
  now: Date,
  bodyweight: number,
): Board {
  const from = now.getTime() - PERIOD_DAYS[period] * 86_400_000
  const records = sessionRecords(sessions)
  const ids = new Set(sessions.flatMap((s) => (s.status === 'done' ? s.exerciseIds : [])))
  const rows: BoardRow[] = []

  for (const exerciseId of ids) {
    const all = exerciseHistory(sessions, exerciseId).filter((h) => !h.deload)
    const type = all.at(-1)?.type
    if (!type) continue
    const inPeriod = all.filter((h) => h.type === type && new Date(h.startedAt).getTime() >= from)
    if (inPeriod.length === 0) continue
    const scored = inPeriod
      .map((h) => ({ h, score: sessionScore(type, h.retained, bodyweight) }))
      .filter((x): x is { h: HistoryEntry; score: number } => x.score !== null)
    const scores = scored.map((x) => x.score)
    const evolution = scores.length >= 2 ? average(scores.slice(-2)) / average(scores.slice(0, 2)) - 1 : null

    let status: BoardStatus
    if (scored.length < MIN_SESSIONS) status = 'insufficient'
    else if (average(scores.slice(-2)) <= Math.max(...scores) * (1 - DROP_FROM_BEST)) status = 'down'
    else if (exerciseStagnates(sessions, exerciseId)) status = 'stagnation'
    else {
      // Record de force (pas le volume, qui monte dès qu'on fait une série de plus)
      const recentRecord = scored
        .slice(-3)
        .some(({ h }) =>
          (records.get(h.sessionId) ?? []).some((r) => r.exerciseId === exerciseId && r.records.some((x) => x.kind !== 'maxVolume')),
        )
      if ((evolution !== null && evolution >= PROGRESS_GAIN) || recentRecord) status = 'progress'
      else status = 'stable'
    }

    const last = inPeriod.at(-1)!
    rows.push({
      exerciseId,
      type,
      muscle: exercisesById.get(exerciseId)?.muscle ?? 'autre',
      status,
      evolution,
      best: bestSetLabel(type, last.retained, bodyweight),
      lastDate: last.startedAt,
      sessions: inPeriod.length,
    })
  }

  const counts: Record<BoardStatus, number> = { progress: 0, stable: 0, stagnation: 0, down: 0, insufficient: 0 }
  for (const row of rows) counts[row.status]++
  return { rows, counts }
}

export type BoardSort = 'muscle' | 'stagnation'

const MUSCLE_RANK = [...MUSCLE_ORDER, 'autre'] as MuscleKey[]
const STATUS_RANK: BoardStatus[] = ['stagnation', 'down', 'stable', 'progress', 'insufficient']

/** Par muscle (ordre habituel), ou « stagnations d'abord » (puis baisses, stables, progressions). */
export function sortRows(rows: BoardRow[], sort: BoardSort, name: (id: string) => string): BoardRow[] {
  const byMuscle = (a: BoardRow, b: BoardRow) =>
    MUSCLE_RANK.indexOf(a.muscle) - MUSCLE_RANK.indexOf(b.muscle) || name(a.exerciseId).localeCompare(name(b.exerciseId), 'fr')
  return [...rows].sort((a, b) =>
    sort === 'stagnation' ? STATUS_RANK.indexOf(a.status) - STATUS_RANK.indexOf(b.status) || byMuscle(a, b) : byMuscle(a, b),
  )
}

/** Tendance d'un muscle : évolution moyenne de ses exercices (hors « pas assez de données »). */
export function muscleTrends(rows: BoardRow[]): Map<MuscleKey, number> {
  const groups = new Map<MuscleKey, number[]>()
  for (const row of rows) {
    if (row.status === 'insufficient' || row.evolution === null) continue
    groups.set(row.muscle, [...(groups.get(row.muscle) ?? []), row.evolution])
  }
  return new Map([...groups].map(([muscle, values]) => [muscle, average(values)]))
}

/** « ↑ +4 % », « → +1 % », « ↓ −3 % » */
export function formatTrend(evolution: number): string {
  const pct = Math.round(evolution * 100)
  const arrow = evolution >= PROGRESS_GAIN ? '↑' : evolution <= -PROGRESS_GAIN ? '↓' : '→'
  return `${arrow} ${formatEvolution(pct / 100)}`
}

/** « +7 % », « −3 % », « 0 % » */
export function formatEvolution(evolution: number): string {
  const pct = Math.round(evolution * 100)
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)} %`
}

/** Poids du corps pour le score : dernière pesée, sinon le poids de départ. */
export function currentBodyweight(weighIns: { date: string; kg: number }[], fallback: number): number {
  const last = [...weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  return last?.kg ?? fallback
}
