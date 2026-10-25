import { useLiveQuery } from 'dexie-react-hooks'
import { normalizeDrops } from '../lib/sets'
import {
  db,
  type Exercise,
  type ExerciseTips,
  type ExerciseType,
  type MuscleGroup,
  type SessionExercise,
  type Target,
  type Template,
  type TemplateId,
} from './database'

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray())
}

export function useExercisesById(): Map<string, Exercise> | undefined {
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])))
}

export function useTemplate(id: TemplateId | undefined): Template | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.templates.get(id)) ?? null) : null), [id])
}

export function useTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.toArray())
}

/** Nouvel exercice : son groupe musculaire est obligatoire (compte des séries par muscle). */
export async function createExercise(name: string, type: ExerciseType, muscle: MuscleGroup): Promise<Exercise> {
  const exercise: Exercise = { id: crypto.randomUUID(), name: name.trim(), type, muscle }
  await db.exercises.add(exercise)
  return exercise
}

export async function updateExercise(
  id: string,
  changes: Pick<Exercise, 'name' | 'type'> & { step?: number; tips?: ExerciseTips; compound?: boolean; muscle?: MuscleGroup | null },
) {
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(id)
    if (!exercise) return
    const next: Exercise = { ...exercise, name: changes.name.trim(), type: changes.type }
    if (changes.step) next.step = changes.step
    else delete next.step
    if (changes.compound !== undefined) {
      if (changes.compound) next.compound = true
      else delete next.compound
    }
    // null = aucun muscle (compté dans « Autre ») ; undefined = inchangé
    if (changes.muscle !== undefined) {
      if (changes.muscle) next.muscle = changes.muscle
      else delete next.muscle
    }
    if (changes.tips) {
      const tips = Object.fromEntries(
        Object.entries(changes.tips).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v!.trim()]),
      ) as ExerciseTips
      if (Object.keys(tips).length > 0) next.tips = tips
      else delete next.tips
    }
    await db.exercises.put(next)
  })
}

/**
 * Supprime un exercice et le retire des modèles.
 * S'il apparaît dans une séance, il est seulement masqué pour garder l'historique juste.
 */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', [db.exercises, db.templates, db.sessions], async () => {
    const used = (await db.sessions.where('exerciseIds').equals(id).count()) > 0
    if (used) await db.exercises.update(id, { hidden: true })
    else await db.exercises.delete(id)
    await db.templates.toCollection().modify((t) => {
      t.exerciseIds = t.exerciseIds.filter((x) => x !== id)
    })
  })
}

export async function setTemplateExercises(id: TemplateId, exerciseIds: string[]): Promise<void> {
  await db.templates.update(id, { exerciseIds })
}

/** Objectif d'un exercice dans un modèle (null = pas d'objectif). */
export async function setTemplateTarget(id: TemplateId, exerciseId: string, target: Target | null): Promise<void> {
  await db.transaction('rw', db.templates, async () => {
    const template = await db.templates.get(id)
    if (!template) return
    const targets = { ...template.targets }
    if (target) targets[exerciseId] = target
    else delete targets[exerciseId]
    await db.templates.put({ ...template, targets })
  })
}

/**
 * Fusionne `fromId` dans `intoId` : toutes les séances passent sur `intoId` (séries réunies si les deux
 * sont dans la même séance), il le remplace dans les modèles (avec son objectif s'il n'en avait pas),
 * puis `fromId` est supprimé.
 */
export async function mergeExercises(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return
  await db.transaction('rw', [db.exercises, db.templates, db.sessions], async () => {
    const sessions = await db.sessions.filter((s) => s.exercises.some((e) => e.exerciseId === fromId)).toArray()
    for (const session of sessions) {
      const exercises: SessionExercise[] = []
      for (const entry of session.exercises) {
        if (entry.exerciseId !== fromId && entry.exerciseId !== intoId) {
          exercises.push(entry)
          continue
        }
        const kept = exercises.find((e) => e.exerciseId === intoId)
        if (!kept) {
          exercises.push({ ...entry, exerciseId: intoId })
          continue
        }
        // Les deux dans la même séance : une seule entrée, séries dans l'ordre où elles ont été faites
        kept.sets = normalizeDrops([...kept.sets, ...entry.sets].sort((a, b) => a.at.localeCompare(b.at)))
        kept.note = [kept.note, entry.note].filter((n) => n.trim()).join(' · ')
        kept.target ??= entry.target
      }
      session.exercises = exercises
      session.exerciseIds = [...new Set(exercises.filter((e) => e.sets.length > 0).map((e) => e.exerciseId))]
      await db.sessions.put(session)
    }

    await db.templates.toCollection().modify((template) => {
      if (!template.exerciseIds.includes(fromId)) return
      template.exerciseIds = template.exerciseIds.includes(intoId)
        ? template.exerciseIds.filter((id) => id !== fromId)
        : template.exerciseIds.map((id) => (id === fromId ? intoId : id))
      if (template.targets?.[fromId]) {
        const targets = { ...template.targets }
        targets[intoId] ??= targets[fromId]
        delete targets[fromId]
        template.targets = targets
      }
    })
    await db.exercises.delete(fromId)
  })
}

/** Exercices visibles sans groupe musculaire (à classer). */
export function unclassified(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => !e.hidden && !e.muscle)
}
