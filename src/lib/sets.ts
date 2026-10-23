import type { SetEntry } from '../db/database'

/** Séries de travail : les échauffements ne comptent ni dans les records, ni le volume, ni l'objectif du jour. */
export function workSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => !s.warmup)
}
