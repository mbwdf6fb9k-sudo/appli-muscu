import type { ExerciseType, Session, SetEntry } from '../db/database'
import { exerciseHistory } from './progress'
import { workSets } from './sets'

/** Nombre de séances d'affilée sans progrès pour parler de stagnation. */
export const STAGNATION_SESSIONS = 3

interface Performance {
  /** Charge (ou lest) max de travail, ou durée max */
  top: number
  /** Reps au total à cette charge (0 pour la durée) */
  reps: number
}

function performance(type: ExerciseType, sets: SetEntry[]): Performance | null {
  const work = workSets(sets)
  if (work.length === 0) return null
  if (type === 'duration') return { top: Math.max(...work.map((s) => s.seconds ?? 0)), reps: 0 }
  const top = Math.max(...work.map((s) => s.kg ?? 0))
  const reps = work.filter((s) => (s.kg ?? 0) === top).reduce((sum, s) => sum + (s.reps ?? 0), 0)
  return { top, reps }
}

/**
 * Progresser : charge max plus haute, ou même charge max avec plus de reps au total à cette charge
 * (poids du corps : plus de lest, ou même lest avec plus de reps ; durée : plus de secondes).
 */
function beats(a: Performance, b: Performance): boolean {
  return a.top > b.top || (a.top === b.top && a.reps > b.reps)
}

/**
 * En stagnation : aucune des 3 dernières séances (de travail, hors semaine allégée) ne bat
 * la meilleure performance des séances d'avant. Il faut donc au moins 4 séances.
 */
export function isStagnating(type: ExerciseType, sessionsSets: SetEntry[][]): boolean {
  const perfs = sessionsSets.map((sets) => performance(type, sets)).filter((p): p is Performance => p !== null)
  if (perfs.length <= STAGNATION_SESSIONS) return false
  const before = perfs.slice(0, -STAGNATION_SESSIONS)
  const best = before.reduce((acc, p) => (beats(p, acc) ? p : acc))
  return !perfs.slice(-STAGNATION_SESSIONS).some((p) => beats(p, best))
}

/**
 * Stagnation d'un exercice d'après l'historique (séances allégées exclues, type actuel seulement),
 * sur les N premières séries de travail de chaque séance.
 */
export function exerciseStagnates(sessions: Session[], exerciseId: string): boolean {
  const history = exerciseHistory(sessions, exerciseId).filter((h) => !h.deload)
  const type = history.at(-1)?.type
  if (!type) return false
  return isStagnating(
    type,
    history.filter((h) => h.type === type).map((h) => h.retained),
  )
}

/** Tous les exercices actuellement en stagnation. */
export function stagnatingExercises(sessions: Session[]): Set<string> {
  const ids = new Set(sessions.flatMap((s) => (s.status === 'done' ? s.exerciseIds : [])))
  return new Set([...ids].filter((id) => exerciseStagnates(sessions, id)))
}
