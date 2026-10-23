import type { ExerciseType, SetEntry, Target } from '../db/database'

export interface Suggestion {
  /** Charge (ou lest) proposée */
  kg: number
  /** Charge (ou lest) de la dernière fois */
  from: number
  kind: 'charge' | 'lest'
  /** Haut de fourchette atteint sur toutes les séries */
  reps: number
}

/**
 * Double progression (programme) : si, la dernière fois, toutes les séries prévues ont atteint le haut
 * de la fourchette, on monte d'un palier (pas de charge de l'exercice) et on revient au bas de la fourchette.
 * Le RIR n'est pas noté : la suggestion ne regarde que les reps.
 */
export function suggestProgression(
  type: ExerciseType,
  lastSets: SetEntry[],
  target: Target | undefined,
  step: number,
): Suggestion | null {
  if (!target || type === 'duration' || lastSets.length < target.sets) return null
  const planned = lastSets.slice(0, target.sets)
  if (!planned.every((s) => (s.reps ?? 0) >= target.max)) return null
  // La charge que TOUTES les séries ont tenue
  const from = Math.min(...planned.map((s) => s.kg ?? 0))
  return {
    kg: Math.round((from + step) * 100) / 100,
    from,
    kind: type === 'bodyweight' ? 'lest' : 'charge',
    reps: target.max,
  }
}
