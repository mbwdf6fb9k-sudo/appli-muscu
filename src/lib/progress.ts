import type { ExerciseType, Session, SetEntry } from '../db/database'
import { computeBests, findBrokenRecords, RECORD_KINDS, type Bests, type RecordKind } from './records'

/** Lundi 0 h de la semaine de la date (heure locale). */
export function startOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

export interface WeekCount {
  start: Date
  count: number
}

/** Nombre de séances terminées par semaine (lundi → dimanche), de la plus ancienne à la semaine en cours. */
export function weeklyCounts(sessions: Session[], now = new Date(), weeks = 12): WeekCount[] {
  const current = startOfWeek(now)
  const result: WeekCount[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(current)
    start.setDate(current.getDate() - 7 * i)
    result.push({ start, count: 0 })
  }
  for (const session of sessions) {
    if (session.status !== 'done') continue
    const week = startOfWeek(new Date(session.startedAt)).getTime()
    const entry = result.find((w) => w.start.getTime() === week)
    if (entry) entry.count++
  }
  return result
}

export interface HistoryEntry {
  sessionId: string
  startedAt: string
  type: ExerciseType
  sets: SetEntry[]
  bests: Bests
}

const byDate = (a: Session, b: Session) => a.startedAt.localeCompare(b.startedAt)

/** Chaque séance terminée où l'exercice a été fait, de la plus ancienne à la plus récente. */
export function exerciseHistory(sessions: Session[], exerciseId: string): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (const session of sessions.filter((s) => s.status === 'done').sort(byDate)) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
    if (!exercise) continue
    entries.push({
      sessionId: session.id,
      startedAt: session.startedAt,
      type: exercise.type,
      sets: exercise.sets,
      bests: computeBests(exercise.type, exercise.sets),
    })
  }
  return entries
}

export interface DatedRecord {
  kind: RecordKind
  value: number
  /** Date de la première séance où ce record a été atteint */
  date: string
  sessionId: string
}

/** Records de l'exercice (pour son type actuel), avec la séance où chacun a été établi. */
export function exerciseRecords(history: HistoryEntry[], type: ExerciseType): DatedRecord[] {
  const entries = history.filter((h) => h.type === type)
  const records: DatedRecord[] = []
  for (const kind of RECORD_KINDS[type]) {
    let best: DatedRecord | undefined
    for (const entry of entries) {
      const value = entry.bests[kind]
      if (value !== undefined && (!best || value > best.value)) {
        best = { kind, value, date: entry.startedAt, sessionId: entry.sessionId }
      }
    }
    if (best) records.push(best)
  }
  return records
}

export interface ExerciseSummary {
  exerciseId: string
  type: ExerciseType
  lastDate: string
  sessionCount: number
  bests: Bests
}

/** Les exercices déjà faits, du plus récemment fait au plus ancien. */
export function exerciseSummaries(sessions: Session[]): ExerciseSummary[] {
  const sets = new Map<string, { type: ExerciseType; lastDate: string; count: number; sets: SetEntry[] }>()
  for (const session of sessions.filter((s) => s.status === 'done').sort(byDate)) {
    for (const exercise of session.exercises) {
      if (exercise.sets.length === 0) continue
      const current = sets.get(exercise.exerciseId)
      // Si le type a changé, on ne garde que les séries du type le plus récent
      const keep = current && current.type === exercise.type ? current.sets : []
      sets.set(exercise.exerciseId, {
        type: exercise.type,
        lastDate: session.startedAt,
        count: (current?.count ?? 0) + 1,
        sets: [...keep, ...exercise.sets],
      })
    }
  }
  return [...sets.entries()]
    .map(([exerciseId, s]) => ({
      exerciseId,
      type: s.type,
      lastDate: s.lastDate,
      sessionCount: s.count,
      bests: computeBests(s.type, s.sets),
    }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
}

/** Identifiants des séances où au moins un record a été battu. */
export function recordSessionIds(sessions: Session[]): Set<string> {
  const ids = new Set<string>()
  const past = new Map<string, SetEntry[]>()
  for (const session of sessions.filter((s) => s.status === 'done').sort(byDate)) {
    for (const exercise of session.exercises) {
      const key = `${exercise.exerciseId}|${exercise.type}`
      const previous = past.get(key) ?? []
      if (findBrokenRecords(exercise.type, previous, exercise.sets).length > 0) ids.add(session.id)
      past.set(key, [...previous, ...exercise.sets])
    }
  }
  return ids
}
