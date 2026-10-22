import type { ExerciseType, SetEntry } from '../db/database'

export interface SetValues {
  reps?: number
  kg?: number
  seconds?: number
}

export const DEFAULT_VALUES: Record<ExerciseType, SetValues> = {
  weight: { reps: 10, kg: 20 },
  bodyweight: { reps: 8, kg: 0 },
  duration: { seconds: 30 },
}

function values(type: ExerciseType, set: SetEntry | undefined): SetValues | undefined {
  if (!set) return undefined
  return type === 'duration' ? { seconds: set.seconds } : { reps: set.reps, kg: set.kg ?? 0 }
}

function sameValues(type: ExerciseType, a: SetEntry, b: SetEntry): boolean {
  return type === 'duration' ? a.seconds === b.seconds : a.reps === b.reps && (a.kg ?? 0) === (b.kg ?? 0)
}

/**
 * Valeurs proposées pour la prochaine série.
 * - 1re série : la 1re série de la dernière fois.
 * - Tant que tu refais exactement la dernière fois : la série suivante de la dernière fois.
 * - Dès que tu t'en écartes : ta dernière série du jour.
 */
export function prefillNextSet(type: ExerciseType, todaySets: SetEntry[], lastSets: SetEntry[]): SetValues {
  const index = todaySets.length
  if (index === 0) return values(type, lastSets[0]) ?? DEFAULT_VALUES[type]

  const followingLastTime = todaySets.every((set, i) => lastSets[i] && sameValues(type, set, lastSets[i]))
  if (followingLastTime && lastSets[index]) return values(type, lastSets[index])!
  return values(type, todaySets[index - 1])!
}
