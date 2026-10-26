import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type ExerciseType,
  type Session,
  type SessionExercise,
  type SessionTemplateId,
  type SetEntry,
  type Target,
} from './database'
import { setDayChoice } from './days'
import { localDateStamp } from '../lib/dates'
import { activeDeload, deloadTarget } from '../lib/deload'
import { sessionVolume } from '../lib/records'
import { effortSets, normalizeDrops, workSets } from '../lib/sets'
import { readSettings } from './settings'

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

/**
 * Les séries de travail (avec leurs dégressives, pour l'affichage) de la dernière séance terminée
 * où l'exercice a été fait. L'objectif du jour et le pré-remplissage ne gardent que les séries de travail.
 * skipDeload : ignore les séances de semaine allégée (pour l'objectif du jour).
 */
export async function lastPerformance(
  exerciseId: string,
  before?: string,
  skipDeload = false,
): Promise<Performance | null> {
  const sessions = await db.sessions
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((s) => s.status === 'done' && (!before || s.startedAt < before) && !(skipDeload && s.deload))
    .toArray()
  for (const session of sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId && workSets(e.sets).length > 0)
    if (exercise) return { date: session.startedAt, type: exercise.type, sets: effortSets(exercise.sets) }
  }
  return null
}

export function useLastPerformance(exerciseId: string, before?: string, skipDeload = false): Performance | null | undefined {
  return useLiveQuery(() => lastPerformance(exerciseId, before, skipDeload), [exerciseId, before, skipDeload])
}

/** Toutes les séries de travail passées d'un exercice (séances terminées avant `before`), du même type si précisé. */
export async function previousSets(exerciseId: string, before: string, type?: ExerciseType): Promise<SetEntry[]> {
  const sessions = await db.sessions
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((s) => s.status === 'done' && s.startedAt < before)
    .toArray()
  return sessions.flatMap((s) =>
    s.exercises.filter((e) => e.exerciseId === exerciseId && (!type || e.type === type)).flatMap((e) => workSets(e.sets)),
  )
}

/** Meilleur volume (kg × reps de travail) d'une séance passée pour cet exercice : record « Volume (séance) ». */
export async function bestPreviousVolume(exerciseId: string, before: string, type: ExerciseType): Promise<number> {
  const sessions = await db.sessions
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((s) => s.status === 'done' && s.startedAt < before)
    .toArray()
  return Math.max(
    0,
    ...sessions.flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId && e.type === type).map((e) => sessionVolume(type, e.sets))),
  )
}

/** Dernière note non vide de l'exercice (séances terminées avant `before`), avec sa date. */
export async function lastNote(exerciseId: string, before: string): Promise<{ note: string; date: string } | null> {
  const sessions = await db.sessions
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((s) => s.status === 'done' && s.startedAt < before)
    .toArray()
  for (const session of sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    const note = session.exercises.find((e) => e.exerciseId === exerciseId && e.note.trim())?.note.trim()
    if (note) return { note, date: session.startedAt }
  }
  return null
}

// ---------- Écriture ----------

/** Démarre une séance (ou renvoie celle déjà en cours). */
export async function startSession(templateId: SessionTemplateId, now = new Date()): Promise<Session> {
  return db.transaction('rw', [db.sessions, db.templates, db.exercises, db.days, db.settings], async () => {
    const active = await db.sessions.where('status').equals('active').first()
    if (active) return active
    // Semaine allégée en cours : séance marquée « allégée », moitié moins de séries, RIR 3-4
    const deload = !!activeDeload((await readSettings()).deloadPeriods, localDateStamp(now))
    const targetOf = (target: Target | undefined) => (target && deload ? deloadTarget(target) : target)

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
        .map((e) => withTarget({ exerciseId: e!.id, type: e!.type, sets: [], note: '' }, targetOf(template?.targets?.[e!.id]))),
      exerciseIds: [],
    }
    if (deload) session.deload = true
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
    // Séance terminée : un exercice dont on a supprimé toutes les séries n'est pas gardé
    if (session.status === 'done') session.exercises = session.exercises.filter((e) => e.sets.length > 0)
    session.exerciseIds =[...new Set(session.exercises.filter((e) => e.sets.length > 0).map((e) => e.exerciseId))]
    await db.sessions.put(session)
  })
}

/** Série enregistrée : « warmup » seulement pour un échauffement (absent = série de travail). */
function cleanSet(values: Omit<SetEntry, 'at'>, at: string): SetEntry {
  const set: SetEntry = { ...values, at }
  if (!set.warmup) delete set.warmup
  if (!set.drop) delete set.drop
  return set
}

export function addSet(id: string, exerciseIndex: number, values: Omit<SetEntry, 'at'>): Promise<void> {
  return updateSession(id, (s) => {
    const exercise = s.exercises[exerciseIndex]
    if (!exercise) return
    exercise.sets.push(cleanSet(values, new Date().toISOString()))
    exercise.sets = normalizeDrops(exercise.sets)
  })
}

export function updateSet(id: string, exerciseIndex: number, setIndex: number, values: Omit<SetEntry, 'at'>) {
  return updateSession(id, (s) => {
    const set = s.exercises[exerciseIndex]?.sets[setIndex]
    if (!set) return
    s.exercises[exerciseIndex].sets[setIndex] = cleanSet(values, set.at)
    s.exercises[exerciseIndex].sets = normalizeDrops(s.exercises[exerciseIndex].sets)
  })
}

export function deleteSet(id: string, exerciseIndex: number, setIndex: number) {
  return updateSession(id, (s) => {
    const exercise = s.exercises[exerciseIndex]
    if (!exercise) return
    exercise.sets.splice(setIndex, 1)
    exercise.sets = normalizeDrops(exercise.sets)
  })
}

export function setNote(id: string, exerciseIndex: number, note: string) {
  return updateSession(id, (s) => {
    if (s.exercises[exerciseIndex]) s.exercises[exerciseIndex].note = note
  })
}

/** Recopie l'objectif du modèle dans la séance (l'historique garde l'objectif de l'époque). */
function withTarget(entry: SessionExercise, target: Target | undefined): SessionExercise {
  if (target) entry.target = { ...target }
  return entry
}

export async function addExercises(id: string, exerciseIds: string[], fromAbs = false): Promise<void> {
  const exercises = await db.exercises.bulkGet(exerciseIds)
  const session = await db.sessions.get(id)
  const templates = await db.templates.toArray()
  // Objectif : celui du modèle de la séance, sinon celui d'un autre modèle (ex. les abdos)
  const targetOf = (exerciseId: string) =>
    templates.find((t) => t.id === session?.templateId)?.targets?.[exerciseId] ??
    templates.find((t) => t.targets?.[exerciseId])?.targets?.[exerciseId]
  await updateSession(id, (s) => {
    for (const e of exercises) {
      if (!e || s.exercises.some((x) => x.exerciseId === e.id)) continue
      const target = targetOf(e.id)
      const entry = withTarget({ exerciseId: e.id, type: e.type, sets: [], note: '' }, target && s.deload ? deloadTarget(target) : target)
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

/**
 * « Machine prise ? » : remplace l'exercice pour cette séance seulement (le modèle ne change pas).
 * Sans séries faites, il est remplacé sur place ; sinon le remplaçant s'ajoute juste après.
 * L'objectif est repris de l'exercice remplacé (sauf entre durée et reps : alors celui d'un modèle, s'il existe).
 */
export async function swapExercise(id: string, exerciseIndex: number, newExerciseId: string): Promise<void> {
  const replacement = await db.exercises.get(newExerciseId)
  if (!replacement) return
  const templates = await db.templates.toArray()
  const ownTarget = templates.find((t) => t.targets?.[newExerciseId])?.targets?.[newExerciseId]
  await updateSession(id, (s) => {
    const entry = s.exercises[exerciseIndex]
    if (!entry || s.exercises.some((e) => e.exerciseId === newExerciseId)) return
    const sameUnit = (entry.type === 'duration') === (replacement.type === 'duration')
    const target = sameUnit ? entry.target : ownTarget && s.deload ? deloadTarget(ownTarget) : ownTarget
    const swapped = withTarget({ exerciseId: newExerciseId, type: replacement.type, sets: [], note: '' }, target)
    if (entry.fromAbs) swapped.fromAbs = true
    if (entry.sets.length === 0) s.exercises.splice(exerciseIndex, 1, swapped)
    else s.exercises.splice(exerciseIndex + 1, 0, swapped)
  })
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

/** Supprime définitivement une séance de l'historique. */
export const deleteSession = abandonSession

/** Déplace une séance à un autre jour (AAAA-MM-JJ), en gardant ses heures et sa durée. */
export function changeSessionDate(id: string, date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return updateSession(id, (s) => {
    const start = new Date(s.startedAt)
    const moved = new Date(year, month - 1, day, start.getHours(), start.getMinutes(), start.getSeconds())
    if (s.endedAt) s.endedAt = new Date(moved.getTime() + (new Date(s.endedAt).getTime() - start.getTime())).toISOString()
    s.startedAt = moved.toISOString()
    s.date = date
  })
}

export function useDoneSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.where('status').equals('done').toArray())
}

/** Liste des exercices (hors « + Abdos ») à recopier dans le modèle. */
export function templateListFromSession(session: Session): string[] {
  return session.exercises.filter((e) => !e.fromAbs).map((e) => e.exerciseId)
}
