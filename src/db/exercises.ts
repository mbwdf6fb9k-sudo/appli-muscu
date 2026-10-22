import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Exercise, type ExerciseType, type Template, type TemplateId } from './database'

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

export async function createExercise(name: string, type: ExerciseType): Promise<Exercise> {
  const exercise: Exercise = { id: crypto.randomUUID(), name: name.trim(), type }
  await db.exercises.add(exercise)
  return exercise
}

export async function updateExercise(id: string, changes: Pick<Exercise, 'name' | 'type'> & { step?: number }) {
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(id)
    if (!exercise) return
    const next: Exercise = { ...exercise, name: changes.name.trim(), type: changes.type }
    if (changes.step) next.step = changes.step
    else delete next.step
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
