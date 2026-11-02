import type { Session } from '../db/database'

/** Fourchette de repos conseillée, en secondes. */
export interface RestRange {
  min: number
  max: number
}

const toNumber = (text: string) => Number(text.replace(',', '.'))

/** « 2-3 min » → 120-180 s ; « 1,5 min après la paire » → 90-90 s ; « 90 s » → 90-90 s ; sinon null. */
export function parseRest(rest: string | undefined): RestRange | null {
  if (!rest) return null
  const minutes = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|à)?\s*(\d+(?:[.,]\d+)?)?\s*min/)
  if (minutes) {
    const low = Math.round(toNumber(minutes[1]) * 60)
    const high = minutes[2] ? Math.round(toNumber(minutes[2]) * 60) : low
    return { min: low, max: Math.max(low, high) }
  }
  const seconds = rest.match(/(\d+)\s*(?:-|–|à)?\s*(\d+)?\s*s\b/)
  if (seconds) {
    const low = Number(seconds[1])
    return { min: low, max: Math.max(low, seconds[2] ? Number(seconds[2]) : low) }
  }
  return null
}

/**
 * resting : avant le repos minimum · ready : minimum atteint · over : au-delà du maximum ·
 * chain : superset, enchaîner avec l'exercice suivant de la paire · free : pas de repos conseillé.
 */
export type RestPhase = 'resting' | 'ready' | 'over' | 'chain' | 'free'

export interface RestState {
  /** Heure de la dernière série (ISO) : le chrono part de là */
  lastAt: string
  exerciseIndex: number
  /** Secondes écoulées depuis la dernière série */
  elapsed: number
  range: RestRange | null
  phase: RestPhase
  /** Superset : l'exercice à enchaîner */
  nextExerciseId?: string
}

/** Le repos en cours, d'après l'heure de la dernière série validée (rien n'est enregistré en plus). */
export function restState(session: Session, now: Date): RestState | null {
  let lastAt = ''
  let exerciseIndex = -1
  session.exercises.forEach((entry, i) => {
    for (const set of entry.sets) {
      if (set.at > lastAt) {
        lastAt = set.at
        exerciseIndex = i
      }
    }
  })
  const start = Date.parse(lastAt)
  if (exerciseIndex < 0 || Number.isNaN(start)) return null

  const entry = session.exercises[exerciseIndex]
  const elapsed = Math.max(0, Math.floor((now.getTime() - start) / 1000))
  const letter = entry.target?.superset
  if (letter) {
    const group = session.exercises.filter((e) => e.target?.superset === letter)
    const next = group[group.indexOf(entry) + 1]
    if (next) return { lastAt, exerciseIndex, elapsed, range: null, phase: 'chain', nextExerciseId: next.exerciseId }
  }
  const range = parseRest(entry.target?.rest)
  const phase: RestPhase = !range ? 'free' : elapsed < range.min ? 'resting' : elapsed <= range.max ? 'ready' : 'over'
  return { lastAt, exerciseIndex, elapsed, range, phase }
}

/** 83 → « 1:23 » */
export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** 120-180 → « 2-3 min » ; 90 → « 1 min 30 » */
export function formatRange(range: RestRange): string {
  const label = (s: number) => (s % 60 === 0 ? `${s / 60}` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`)
  if (range.min === range.max) return range.min % 60 === 0 ? `${range.min / 60} min` : label(range.min)
  if (range.min % 60 === 0 && range.max % 60 === 0) return `${range.min / 60}-${range.max / 60} min`
  return `${formatClock(range.min)}-${formatClock(range.max)}`
}
