import type { ExerciseType, SetEntry, Target } from '../db/database'
import { formatNumber } from './format'
import type { SetValues } from './prefill'
import { workSets } from './sets'

export type ObjectiveRule = 'first' | 'up' | 'down' | 'same' | 'deload'

export interface DailyObjective {
  rule: ObjectiveRule
  /** « Passe à 52,5 kg, vise 8+ » */
  text: string
  /** Valeurs proposées série de travail par série de travail (vide : pré-remplissage habituel) */
  plan: SetValues[]
}

/** Arrondi au palier le plus proche (2 décimales). */
export function roundToStep(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100
}

const kg = (value: number) => `${formatNumber(value)} kg`

/**
 * Objectif du jour (double progression), d'après la dernière séance NON allégée de l'exercice,
 * séries de travail uniquement, avec la fourchette et le nombre de séries du modèle :
 * 1. toutes les séries au haut de la fourchette → +1 palier, retour au bas de la fourchette ;
 * 2. au moins la moitié sous le bas → baisser de 10 % (arrondi au palier) ;
 * 3. sinon → même charge, +1 rep sur les séries qui n'étaient pas au haut.
 * Poids du corps : on joue sur le lest. Durée : +5 s.
 */
export function dailyObjective(
  type: ExerciseType,
  last: SetEntry[],
  target: Target | undefined,
  step: number,
  deload = false,
): DailyObjective | null {
  if (!target) return null
  const sets = workSets(last)

  if (deload) {
    return {
      rule: 'deload',
      text: `Semaine allégée : même charge, ${target.sets} série${target.sets > 1 ? 's' : ''}, arrête chaque série quand tu pourrais encore faire 3 à 4 reps`,
      plan: sets.length ? sets.slice(0, target.sets).map((s) => valuesOf(type, s, target.min)) : [],
    }
  }

  if (sets.length === 0) {
    return { rule: 'first', text: 'Première fois : choisis une charge où tu pourrais encore faire 2 à 3 reps à la fin de la série', plan: [] }
  }

  const planned = sets.slice(0, target.sets)
  const enough = sets.length >= target.sets

  if (type === 'duration') {
    const secs = planned.map((s) => s.seconds ?? 0)
    if (enough && secs.every((v) => v >= target.max)) {
      const next = Math.min(...secs) + 5
      return { rule: 'up', text: `Passe à ${next} s`, plan: fill(target.sets, { seconds: next }) }
    }
    const plan = padTo(
      target.sets,
      secs.map((v) => ({ seconds: v >= target.max ? v : Math.min(v + 5, target.max) })),
    )
    const lo = Math.min(...plan.map((p) => p.seconds!))
    const hi = Math.max(...plan.map((p) => p.seconds!))
    return { rule: 'same', text: `Même durée, vise ${lo === hi ? lo : `${lo}-${hi}`} s`, plan }
  }

  const loads = planned.map((s) => s.kg ?? 0)
  const reps = planned.map((s) => s.reps ?? 0)

  // Règle 1 : toutes les séries prévues au haut de la fourchette
  if (enough && reps.every((r) => r >= target.max)) {
    const from = Math.min(...loads)
    const next = Math.round((from + step) * 100) / 100
    const text =
      type === 'bodyweight'
        ? from === 0
          ? `Ajoute du lest : +${kg(step)}, vise ${target.min}+`
          : `Passe à ${kg(next)} de lest, vise ${target.min}+`
        : `Passe à ${kg(next)}, vise ${target.min}+`
    return { rule: 'up', text, plan: fill(target.sets, { reps: target.min, kg: next }) }
  }

  // Règle 2 : au moins la moitié des séries sous le bas de la fourchette
  const base = Math.max(...loads)
  const below = reps.filter((r) => r < target.min).length
  if (below * 2 >= planned.length && base > 0) {
    let lowered = roundToStep(base * 0.9, step)
    if (lowered >= base) lowered = Math.round((base - step) * 100) / 100
    lowered = Math.max(0, lowered)
    const what = type === 'bodyweight' ? `${kg(lowered)} de lest` : kg(lowered)
    return {
      rule: 'down',
      text: `Baisse à ${what} (−10 %), vise ${target.min}-${target.max}`,
      plan: fill(target.sets, { reps: target.min, kg: lowered }),
    }
  }

  // Règle 3 : même charge, +1 rep sur les séries qui n'étaient pas au haut
  const plan = padTo(
    target.sets,
    planned.map((s) => ({ reps: Math.min((s.reps ?? 0) + 1, Math.max(target.max, s.reps ?? 0)), kg: s.kg ?? 0 })),
  )
  const lo = Math.min(...plan.map((p) => p.reps!))
  const hi = Math.max(...plan.map((p) => p.reps!))
  return { rule: 'same', text: `Même charge, vise ${lo === hi ? lo : `${lo}-${hi}`} reps`, plan }
}

function valuesOf(type: ExerciseType, set: SetEntry, minReps: number): SetValues {
  return type === 'duration' ? { seconds: set.seconds } : { reps: set.reps ?? minReps, kg: set.kg ?? 0 }
}

const fill = (count: number, values: SetValues): SetValues[] => Array.from({ length: count }, () => ({ ...values }))

/** Complète jusqu'au nombre de séries prévu avec la dernière valeur. */
function padTo(count: number, plan: SetValues[]): SetValues[] {
  const out = [...plan]
  while (out.length < count && out.length > 0) out.push({ ...out.at(-1)! })
  return out
}

/**
 * Séries d'échauffement proposées, à partir de la charge de travail du jour, arrondies au palier :
 * 1er exercice ≈ 50 % × 10, 70 % × 5, 85 % × 3 ; 2e exercice (polyarticulaire) ≈ 70 % × 5.
 * Rien en durée ni au poids du corps sans lest.
 */
export function warmupSets(type: ExerciseType, workKg: number, step: number, position: 'first' | 'second'): SetValues[] {
  if (type === 'duration' || workKg <= 0) return []
  const scheme: [number, number][] = position === 'first' ? [[0.5, 10], [0.7, 5], [0.85, 3]] : [[0.7, 5]]
  return scheme
    .map(([ratio, reps]) => ({ reps, kg: roundToStep(workKg * ratio, step), warmup: true }))
    .filter((s) => s.kg > 0 && s.kg < workKg)
}
