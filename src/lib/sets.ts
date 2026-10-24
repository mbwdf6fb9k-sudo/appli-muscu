import type { SetEntry } from '../db/database'

/**
 * Séries de travail : sans les échauffements ni les suites dégressives.
 * C'est sur elles que se calculent l'objectif du jour, les records, la stagnation et le nombre de séries.
 */
export function workSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => !s.warmup && !s.drop)
}

/** Séries de travail avec leurs suites dégressives (volume et affichage). */
export function effortSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => !s.warmup)
}

/** Une série peut devenir dégressive si elle suit une série de travail ou une autre dégressive. */
export function canBeDrop(sets: SetEntry[], index: number): boolean {
  const previous = sets[index - 1]
  return index > 0 && !!previous && !previous.warmup
}

/**
 * Une dégressive suit toujours une série de travail (ou une autre dégressive) :
 * sinon (série principale supprimée ou passée en échauffement), elle redevient une série normale.
 */
export function normalizeDrops(sets: SetEntry[]): SetEntry[] {
  const out: SetEntry[] = []
  for (const set of sets) {
    const previous = out.at(-1)
    if (set.drop && (set.warmup || !previous || previous.warmup)) {
      const normal = { ...set }
      delete normal.drop
      out.push(normal)
    } else {
      out.push(set)
    }
  }
  return out
}

/** « É » pour un échauffement, « ↘ » pour une dégressive, sinon le numéro de la série de travail. */
export function setLabel(sets: SetEntry[], index: number): string {
  const set = sets[index]
  if (set.warmup) return 'É'
  if (set.drop) return '↘'
  return String(workSets(sets.slice(0, index + 1)).length)
}

/** Titre du panneau d'une série. */
export function setTitle(sets: SetEntry[], index: number): string {
  const set = sets[index]
  if (set.warmup) return 'Série d’échauffement'
  const number = Math.max(1, workSets(sets.slice(0, index + 1)).length)
  return set.drop ? `Dégressive de la série ${number}` : `Série ${number}`
}
