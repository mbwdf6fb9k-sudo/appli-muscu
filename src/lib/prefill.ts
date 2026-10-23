import type { ExerciseType, SetEntry, Target } from '../db/database'
import { workSets } from './sets'

export interface SetValues {
  reps?: number
  kg?: number
  seconds?: number
  warmup?: boolean
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
 * Valeurs proposées pour la prochaine série de travail (les échauffements sont ignorés).
 * - Avec un objectif du jour : série par série, tant que tu gardes la charge prévue ;
 *   si tu changes de charge, la suite reprend ta dernière série.
 * - Sans objectif : 1re série = 1re série de la dernière fois (ou bas de la fourchette la première fois),
 *   puis la série suivante de la dernière fois tant que tu la refais à l'identique, sinon ta dernière série.
 */
export function prefillNextSet(
  type: ExerciseType,
  todayAll: SetEntry[],
  lastAll: SetEntry[],
  target?: Target,
  plan?: SetValues[],
): SetValues {
  const todaySets = workSets(todayAll)
  const lastSets = workSets(lastAll)
  const index = todaySets.length

  if (plan && plan.length > 0) {
    if (index === 0) return { ...plan[0] }
    const planned = plan[Math.min(index - 1, plan.length - 1)]
    const previous = todaySets[index - 1]
    const keptLoad = type === 'duration' || (previous.kg ?? 0) === (planned.kg ?? 0)
    return keptLoad ? { ...plan[Math.min(index, plan.length - 1)] } : values(type, previous)!
  }

  if (index === 0) {
    const last = values(type, lastSets[0])
    if (last) return last
    // Première fois : bas de la fourchette du programme
    if (target) return type === 'duration' ? { seconds: target.min } : { ...DEFAULT_VALUES[type], reps: target.min }
    return DEFAULT_VALUES[type]
  }

  const followingLastTime = todaySets.every((set, i) => lastSets[i] && sameValues(type, set, lastSets[i]))
  if (followingLastTime && lastSets[index]) return values(type, lastSets[index])!
  return values(type, todaySets[index - 1])!
}
