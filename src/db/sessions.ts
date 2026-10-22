import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type ExerciseType,
  type Session,
  type SessionExercise,
  type SessionTemplateId,
  type SetEntry,
} from './database'
import { setDayChoice } from './days'
import { localDateStamp } from '../lib/dates'

export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(async () => (await db.sessions.where('status').equals('active').first()) ?? null)
}

export function useSession(id: string | undefined): Session | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.sessions.get(id)) ?? null) : null), [id])
}

/** Séances terminées d'une journée, de la plus récente à la plus ancienne. */
export function useDoneSessionsOn(date: string): Session[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.sessions.where('date').equals(date).filter((s) => s.status === 'done').sortBy('startedAt')).reverse(),
    [date],
  )
}

/** Date de début de la dernière séance terminée, pour chaque modèle. */
export function useLastDoneDates(): Partial<Record<SessionTemplateId, string>> | undefined {
  return useLiveQuery(async () => {
    const result: Partial<Record<SessionTemplateId, string>> = {}
    await db.sessions
      .where('status')
      .equals('done')
      .each((s) => {
        const current = result[s.templateId]
        if (!current || s.startedAt > current) result[s.templateId] = s.startedAt
      })
    return result
  })
}

export interface Performance {
  date: string
  type: ExerciseType
  sets: SetEntry[]
}

/** Les séries de la dernière séance terminée où l'exercice a été fait. */
export async function lastPerformance(exerciseId: string, before?: string): Promise<Performance | null> {
  const sessions = await db.sessions
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((s) => s.status === 'done' && (!before || s.startedAt < before))
    .toArray()
  const last = sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  const exercise = last?.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
  return last && exercise ? { date: last.startedAt, type: exercise.type, sets: exercise.sets } : null
}

export function useLastPerformance(exerciseId: string, before?: string): Performance | null | undefined {
  return useLiveQuery(() => lastPerformance(exerciseId, before), [exerciseId, before])
}

/** Toutes les séries passées d'un exercice (séances terminées avant `before`). */
export async function previousSets(exerciseId: string, before: string): Promise<SetEntry[]> {
  const sessions = await db.sessions
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((s) => s.status === 'done' && s.startedAt < before)
    .toArray()
  return sessions.flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets))
}

// ---------- Écriture ----------

/** Démarre une séance (ou renvoie celle déjà en cours). */
export async function startSession(templateId: SessionTemplateId, now = new Date()): Promise<Session> {
  return db.transaction('rw', [db.sessions, db.templates, db.exercises, db.days], async () => {
    const active = await db.sessions.where('status').equals('active').first()
    if (active) return active

    const template = await db.templates.get(templateId)
    const exercises = await db.exercises.bulkGet(template?.exerciseIds ?? [])
    const session: Session = {
      id: crypto.randomUUID(),
      templateId,
      date: localDateStamp(now),
      startedAt: now.toISOString(),
      endedAt: null,
      status: 'active',
      exercises: exercises
        .filter((e) => e && !e.hidden)
        .map((e) => ({ exerciseId: e!.id, type: e!.type, sets: [], note: '' })),
      exerciseIds: [],
    }
    await db.sessions.add(session)
    await setDayChoice(session.date, templateId)
    return session
  })
}

/** Modifie une séance en une seule opération (lecture + écriture). */
async function updateSession(id: string, change: (session: Session) => void): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(id)
    if (!session) return
    change(session)
    session.exerciseIds = [...new Set(session.exercises.filter((e) => e.sets.length > 0).map((e) => e.exerciseId))]
    await db.sessions.put(session)
  })
}

export function addSet(id: string, exerciseIndex: number, values: Omit<SetEntry, 'at'>): Promise<void> {
  return updateSession(id, (s) => {
    s.exercises[exerciseIndex]?.sets.push({ ...values, at: new Date().toISOString() })
  })
}

export function updateSet(id: string, exerciseIndex: number, setIndex: number, values: Omit<SetEntry, 'at'>) {
  return updateSession(id, (s) => {
    const set = s.exercises[exerciseIndex]?.sets[setIndex]
    if (set) s.exercises[exerciseIndex].sets[setIndex] = { ...values, at: set.at }
  })
}

export function deleteSet(id: string, exerciseIndex: number, setIndex: number) {
  return updateSession(id, (s) => {
    s.exercises[exerciseIndex]?.sets.splice(setIndex, 1)
  })
}

export function setNote(id: string, exerciseIndex: number, note: string) {
  return updateSession(id, (s) => {
    if (s.exercises[exerciseIndex]) s.exercises[exerciseIndex].note = note
  })
}

export async function addExercises(id: string, exerciseIds: string[], fromAbs = false): Promise<void> {
  const exercises = await db.exercises.bulkGet(exerciseIds)
  await updateSession(id, (s) => {
    for (const e of exercises) {
      if (!e || s.exercises.some((x) => x.exerciseId === e.id)) continue
      const entry: SessionExercise = { exerciseId: e.id, type: e.type, sets: [], note: '' }
      if (fromAbs) entry.fromAbs = true
      s.exercises.push(entry)
    }
  })
}

/** Ajoute les exercices du modèle Abdos qui ne sont pas déjà dans la séance. */
export async function addAbs(id: string): Promise<void> {
  const template = await db.templates.get('abdos')
  const exercises = await db.exercises.bulkGet(template?.exerciseIds ?? [])
  await addExercises(
    id,
    exercises.filter((e) => e && !e.hidden).map((e) => e!.id),
    true,
  )
}

export function removeExercise(id: string, exerciseIndex: number) {
  return updateSession(id, (s) => {
    s.exercises.splice(exerciseIndex, 1)
  })
}

export function moveExercise(id: string, exerciseIndex: number, direction: -1 | 1) {
  return updateSession(id, (s) => {
    const target = exerciseIndex + direction
    if (target < 0 || target >= s.exercises.length) return
    const [moved] = s.exercises.splice(exerciseIndex, 1)
    s.exercises.splice(target, 0, moved)
  })
}

/** Termine la séance : les exercices sans aucune série ne sont pas gardés. */
export function finishSession(id: string, now = new Date()) {
  return updateSession(id, (s) => {
    s.exercises = s.exercises.filter((e) => e.sets.length > 0)
    s.endedAt = now.toISOString()
    s.status = 'done'
  })
}

export async function abandonSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

/** Liste des exercices (hors « + Abdos ») à recopier dans le modèle. */
export function templateListFromSession(session: Session): string[] {
  return session.exercises.filter((e) => !e.fromAbs).map((e) => e.exerciseId)
}
