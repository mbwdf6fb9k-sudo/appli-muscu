import type { Session } from '../db/database'

export interface SessionStats {
  durationMs: number
  setCount: number
  /** Somme kg × reps (lest pour le poids du corps ; le gainage ne compte pas) */
  volume: number
}

export function sessionStats(session: Session, now = new Date()): SessionStats {
  const end = session.endedAt ? new Date(session.endedAt) : now
  let setCount = 0
  let volume = 0
  for (const exercise of session.exercises) {
    setCount += exercise.sets.length
    if (exercise.type === 'duration') continue
    for (const set of exercise.sets) volume += (set.kg ?? 0) * (set.reps ?? 0)
  }
  return {
    durationMs: Math.max(0, end.getTime() - new Date(session.startedAt).getTime()),
    setCount,
    volume,
  }
}
