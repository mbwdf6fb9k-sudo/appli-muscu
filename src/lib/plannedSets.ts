import type { Exercise, Template } from '../db/database'
import { SESSION_TEMPLATE_IDS } from '../db/seed'
import type { MuscleKey } from './muscleVolume'

/**
 * Séries prévues par semaine et par muscle : chaque modèle de séance (Dos-Biceps, Pecs-Triceps, Jambes, Bras)
 * compte une fois par semaine, sans les abdos ; les séries viennent des objectifs du modèle.
 */
export function plannedWeeklySets(templates: Template[], exercisesById: Map<string, Exercise>): Map<MuscleKey, number> {
  const planned = new Map<MuscleKey, number>()
  for (const template of templates) {
    if (!SESSION_TEMPLATE_IDS.includes(template.id as (typeof SESSION_TEMPLATE_IDS)[number])) continue
    for (const id of template.exerciseIds) {
      const sets = template.targets?.[id]?.sets
      if (!sets) continue
      const muscle = exercisesById.get(id)?.muscle ?? 'autre'
      planned.set(muscle, (planned.get(muscle) ?? 0) + sets)
    }
  }
  return planned
}
