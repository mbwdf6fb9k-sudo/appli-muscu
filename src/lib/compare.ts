import type { ExerciseType, Session, SessionExercise, SetEntry } from '../db/database'
import { formatNumber } from './format'
import { sessionStats } from './sessionStats'
import { retainedSets } from './sets'

export type CompareTone = 'up' | 'down' | 'same' | 'new'

export interface ExerciseComparison {
  /** « +2,5 kg », « +2 reps », « −1 rep », « +5 s », « = », « nouveau » */
  label: string
  tone: CompareTone
}

export interface SessionComparison {
  /** Date de début de la séance de référence (ISO) */
  date: string
  /** Évolution du volume (0,08 = +8 %), null si la référence n'a pas de volume */
  volume: number | null
  /** Écart du nombre de séries */
  sets: number
}

/** Séances de référence : terminées, avant celle-ci, sans les semaines allégées ; la plus récente d'abord. */
function references(session: Session, sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.status === 'done' && !s.deload && s.id !== session.id && s.startedAt < session.startedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

const signed = (value: number, unit: string, plural = false) => {
  const abs = Math.abs(value)
  const word = plural && abs > 1 ? `${unit}s` : unit
  return `${value > 0 ? '+' : '−'}${formatNumber(abs)} ${word}`
}

function difference(type: ExerciseType, today: SetEntry[], before: SetEntry[]): ExerciseComparison {
  if (type === 'duration') {
    const diff = Math.max(...today.map((s) => s.seconds ?? 0)) - Math.max(...before.map((s) => s.seconds ?? 0))
    return diff === 0 ? { label: '=', tone: 'same' } : { label: signed(diff, 's'), tone: diff > 0 ? 'up' : 'down' }
  }
  const top = (sets: SetEntry[]) => Math.max(...sets.map((s) => s.kg ?? 0))
  const reps = (sets: SetEntry[], load: number) => sets.filter((s) => (s.kg ?? 0) === load).reduce((sum, s) => sum + (s.reps ?? 0), 0)
  const load = Math.round((top(today) - top(before)) * 100) / 100
  const diff = reps(today, top(today)) - reps(before, top(before))
  // Charge baissée mais plus de reps (10 × 42,5 contre 5 × 45) : ni mieux ni moins bien à coup sûr, on montre les deux
  if (load < 0 && diff > 0) return { label: `${signed(load, 'kg')}, ${signed(diff, 'rep', true)}`, tone: 'same' }
  if (load !== 0) return { label: signed(load, 'kg'), tone: load > 0 ? 'up' : 'down' }
  return diff === 0 ? { label: '=', tone: 'same' } : { label: signed(diff, 'rep', true), tone: diff > 0 ? 'up' : 'down' }
}

/**
 * Un exercice par rapport à sa dernière séance (même type, séries retenues : les N premières séries de travail).
 * Charge la plus lourde d'abord, puis reps totales à cette charge. null : séance allégée, ou aucune série de travail.
 */
export function compareExercise(session: Session, entry: SessionExercise, sessions: Session[]): ExerciseComparison | null {
  if (session.deload) return null
  const today = retainedSets(entry)
  if (today.length === 0) return null
  for (const previous of references(session, sessions)) {
    for (const old of previous.exercises) {
      if (old.exerciseId !== entry.exerciseId || old.type !== entry.type) continue
      const before = retainedSets(old)
      if (before.length > 0) return difference(entry.type, today, before)
    }
  }
  return { label: 'nouveau', tone: 'new' }
}

/** La séance par rapport à la dernière du même type. null : séance libre, allégée, ou pas de référence. */
export function compareSession(session: Session, sessions: Session[]): SessionComparison | null {
  if (session.deload || session.templateId === 'libre') return null
  const previous = references(session, sessions).find((s) => s.templateId === session.templateId)
  if (!previous) return null
  const now = sessionStats(session)
  const before = sessionStats(previous)
  return {
    date: previous.startedAt,
    volume: before.volume > 0 ? now.volume / before.volume - 1 : null,
    sets: now.setCount - before.setCount,
  }
}
