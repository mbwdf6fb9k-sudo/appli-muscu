import type { Exercise, MuscleGroup, Session } from '../db/database'
import { startOfWeek } from './progress'
import { workSets } from './sets'

export type MuscleKey = MuscleGroup | 'autre'

export const MUSCLE_LABELS: Record<MuscleKey, string> = {
  dos: 'Dos',
  pecs: 'Pecs',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quadriceps',
  ischios: 'Ischios-fessiers',
  mollets: 'Mollets',
  abdos: 'Abdos',
  autre: 'Autre',
}

export const MUSCLE_ORDER: MuscleGroup[] = [
  'dos',
  'pecs',
  'epaules',
  'biceps',
  'triceps',
  'quadriceps',
  'ischios',
  'mollets',
  'abdos',
]

/** Repère indicatif : séries de travail par muscle et par semaine. */
export const WEEKLY_SETS_RANGE = { low: 10, high: 20 }
/** Nombre de semaines terminées pour la moyenne. */
export const AVERAGE_WEEKS = 4

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/** Séries de travail par muscle (muscle actuel de l'exercice) des séances terminées entre from (inclus) et to (exclu). */
export function setsByMuscle(
  sessions: Session[],
  exercisesById: Map<string, Exercise>,
  from: Date,
  to: Date,
): Map<MuscleKey, number> {
  const counts = new Map<MuscleKey, number>()
  for (const session of sessions) {
    if (session.status !== 'done') continue
    const start = new Date(session.startedAt)
    if (start < from || start >= to) continue
    for (const exercise of session.exercises) {
      const sets = workSets(exercise.sets).length
      if (sets === 0) continue
      const muscle = exercisesById.get(exercise.exerciseId)?.muscle ?? 'autre'
      counts.set(muscle, (counts.get(muscle) ?? 0) + sets)
    }
  }
  return counts
}

export interface MuscleRow {
  muscle: MuscleKey
  week: number
  /** Moyenne des semaines terminées (null s'il n'y en a pas encore) */
  average: number | null
}

export interface MuscleVolume {
  rows: MuscleRow[]
  /** Semaines terminées prises dans la moyenne (0 à 4) */
  averageWeeks: number
}

/**
 * Séries par muscle : semaine en cours, et moyenne des 4 dernières semaines terminées
 * (seulement celles depuis la première séance, pour ne pas compter des semaines d'avant l'appli).
 */
export function muscleVolume(sessions: Session[], exercisesById: Map<string, Exercise>, now = new Date()): MuscleVolume {
  const monday = startOfWeek(now)
  const week = setsByMuscle(sessions, exercisesById, monday, addDays(monday, 7))

  const done = sessions.filter((s) => s.status === 'done')
  const firstMonday = done.length > 0 ? startOfWeek(new Date(done.map((s) => s.startedAt).sort()[0])) : monday
  let weeks = 0
  while (weeks < AVERAGE_WEEKS && addDays(monday, -7 * (weeks + 1)) >= firstMonday) weeks++
  const past = setsByMuscle(sessions, exercisesById, addDays(monday, -7 * weeks), monday)

  const muscles: MuscleKey[] = [...MUSCLE_ORDER]
  if (week.has('autre') || past.has('autre')) muscles.push('autre')
  return {
    averageWeeks: weeks,
    rows: muscles.map((muscle) => ({
      muscle,
      week: week.get(muscle) ?? 0,
      average: weeks > 0 ? Math.round(((past.get(muscle) ?? 0) / weeks) * 10) / 10 : null,
    })),
  }
}

/** Un muscle « en retard » : moyenne sous le repère (pas les abdos ni « Autre », hors repère). */
export function isBehind(row: MuscleRow): boolean {
  return row.average !== null && row.muscle !== 'abdos' && row.muscle !== 'autre' && row.average < WEEKLY_SETS_RANGE.low
}
