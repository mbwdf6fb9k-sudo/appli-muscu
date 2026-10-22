import type { ExerciseType, SetEntry } from '../db/database'

/** 1RM estimé (formule d'Epley), seulement pour les séries de 1 à 12 reps avec une charge. */
export function epley1RM(kg: number | undefined, reps: number | undefined): number | undefined {
  if (!kg || !reps || kg <= 0 || reps < 1 || reps > 12) return undefined
  // Arrondi au centième : évite les faux records dus aux décimales (62,00000000001 > 62)
  return Math.round(kg * (30 + reps) * 100 / 30) / 100
}

export type RecordKind = 'maxKg' | 'best1RM' | 'maxReps' | 'maxLest' | 'maxSeconds'

export type Bests = Partial<Record<RecordKind, number>>

export const RECORD_LABELS: Record<RecordKind, string> = {
  maxKg: 'Charge max',
  best1RM: '1RM estimé',
  maxReps: 'Reps max',
  maxLest: 'Lest max',
  maxSeconds: 'Meilleure durée',
}

/** Records suivis selon le type d'exercice. */
export const RECORD_KINDS: Record<ExerciseType, RecordKind[]> = {
  weight: ['maxKg', 'best1RM'],
  bodyweight: ['maxReps', 'maxLest'],
  duration: ['maxSeconds'],
}

function max(values: (number | undefined)[]): number | undefined {
  const numbers = values.filter((v): v is number => v !== undefined && v > 0)
  return numbers.length > 0 ? Math.max(...numbers) : undefined
}

export function computeBests(type: ExerciseType, sets: SetEntry[]): Bests {
  switch (type) {
    case 'weight':
      return {
        maxKg: max(sets.map((s) => s.kg)),
        best1RM: max(sets.map((s) => epley1RM(s.kg, s.reps))),
      }
    case 'bodyweight':
      return { maxReps: max(sets.map((s) => s.reps)), maxLest: max(sets.map((s) => s.kg)) }
    case 'duration':
      return { maxSeconds: max(sets.map((s) => s.seconds)) }
  }
}

export interface BrokenRecord {
  kind: RecordKind
  value: number
  /** Ancien record (0 = poids du corps sans lest jusqu'ici) */
  previous: number
}

/**
 * Records battus par les séries du jour par rapport à tout l'historique.
 * Aucun record la première fois qu'on fait l'exercice.
 */
export function findBrokenRecords(type: ExerciseType, previousSets: SetEntry[], currentSets: SetEntry[]): BrokenRecord[] {
  if (previousSets.length === 0) return []
  const before = computeBests(type, previousSets)
  const now = computeBests(type, currentSets)
  const broken: BrokenRecord[] = []
  for (const kind of RECORD_KINDS[type]) {
    const value = now[kind]
    if (value === undefined) continue
    const previous = before[kind]
    // Lest : passer de « poids du corps » à du lest compte comme un record
    if (previous === undefined && kind !== 'maxLest') continue
    if (value > (previous ?? 0)) broken.push({ kind, value, previous: previous ?? 0 })
  }
  return broken
}
