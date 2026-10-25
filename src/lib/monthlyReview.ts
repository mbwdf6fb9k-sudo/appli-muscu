import type {
  Activity,
  Exercise,
  ExerciseType,
  Measurement,
  Photo,
  Session,
  SessionTemplateId,
  SetEntry,
  Template,
  WeighIn,
} from '../db/database'
import type { DeloadPeriod } from '../db/settings'
import { localDateStamp } from './dates'
import { inDeload } from './deload'
import { MUSCLE_LABELS, setsByMuscle, type MuscleKey } from './muscleVolume'
import { plannedWeeklySets } from './plannedSets'
import { boardBetween, type Board } from './progressBoard'
import { sessionRecords, startOfWeek } from './progress'
import { computeBests, type RecordKind } from './records'
import { sessionStats } from './sessionStats'
import { workSets } from './sets'
import { STREAK_MIN_SESSIONS } from './streak'
import { movingAverage } from './weight'

/** « 2026-10 » */
export const monthKey = (date: Date) => localDateStamp(date).slice(0, 7)

/** Premier jour du mois « 2026-10 » (heure locale). */
export function monthStart(month: string): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Mois précédent : « 2026-10 » → « 2026-09 » */
export const previousMonth = (month: string) => monthKey(new Date(monthStart(month).getFullYear(), monthStart(month).getMonth() - 1, 1))

/** « octobre 2026 » */
export const monthLabel = (month: string) => monthStart(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

/** « d’octobre », « de septembre » */
export function ofMonth(month: string): string {
  const name = monthStart(month).toLocaleDateString('fr-FR', { month: 'long' })
  return /^[aeiouyh]/i.test(name) ? `d’${name}` : `de ${name}`
}

/** Mesure principale de progression selon le type d'exercice. */
const MAIN_KIND: Record<ExerciseType, RecordKind> = {
  weight: 'best1RM',
  bodyweight: 'maxReps',
  duration: 'maxSeconds',
}

export interface MonthRecord {
  exerciseId: string
  kind: RecordKind
  value: number
  /** Reps à charge : la charge concernée */
  load?: number
}

export interface MonthProgress {
  exerciseId: string
  kind: RecordKind
  before: number
  after: number
  /** Hausse relative (0,08 = +8 %) */
  gain: number
}

export interface MonthlyReview {
  month: string
  sessions: number
  previousSessions: number
  byTemplate: { templateId: SessionTemplateId; count: number }[]
  foot: number
  tennis: number
  /** Semaines (commencées dans le mois) à 3 séances ou plus, sur le nombre de semaines commencées */
  weeksAtTarget: number
  weeks: number
  /** Meilleure série de semaines d'affilée à 3 séances ou plus, dans le mois */
  bestStreak: number
  /** Statuts des exercices sur le mois (mêmes règles que le tableau de progrès) */
  board: Board
  /** Points à travailler (2 ou 3 au plus) : exercices en stagnation, muscles sous 80 % des séries prévues */
  focus: string[]
  deloadDays: number
  workSets: number
  volume: number
  durationMs: number
  muscles: Map<MuscleKey, number>
  records: MonthRecord[]
  progress: MonthProgress[]
  /** Moyenne 7 jours à la première et à la dernière pesée du mois */
  weight: { start: number; end: number } | null
  /** Dernière mesure du mois, et celle d'avant (n'importe quand) */
  measurement: { latest: Measurement; previous: Measurement | null } | null
  photos: Photo[]
}

export interface MonthlyData {
  sessions: Session[]
  exercisesById: Map<string, Exercise>
  activities: Activity[]
  weighIns: WeighIn[]
  measurements: Measurement[]
  photos: Photo[]
  deloadPeriods: DeloadPeriod[]
  /** Modèles : séries prévues par muscle (points à travailler) */
  templates: Template[]
  /** Poids du corps pour le score des exercices au poids du corps */
  bodyweight: number
  /** Maintenant (mois en cours : moyenne sur les semaines écoulées) */
  now?: Date
}

/** Un muscle est « à travailler » sous 80 % des séries prévues par les modèles. */
export const PLANNED_RATIO = 0.8
/** Points à travailler affichés au plus. */
export const MAX_FOCUS = 3

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/** Bilan d'un mois, calculé à partir des données existantes. */
export function monthlyReview(month: string, data: MonthlyData): MonthlyReview {
  const from = monthStart(month)
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  const inMonth = (iso: string) => iso.slice(0, 7) === month
  const done = data.sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const monthSessions = done.filter((s) => {
    const start = new Date(s.startedAt)
    return start >= from && start < to
  })
  const previous = previousMonth(month)

  // Régularité
  const byTemplate = new Map<SessionTemplateId, number>()
  for (const s of monthSessions) byTemplate.set(s.templateId, (byTemplate.get(s.templateId) ?? 0) + 1)
  let weeks = 0
  let weeksAtTarget = 0
  let bestRun = 0
  let run = 0
  for (let monday = startOfWeek(from); monday < to; monday = addDays(monday, 7)) {
    if (monday < from) continue
    weeks++
    const count = done.filter((s) => {
      const start = new Date(s.startedAt)
      return start >= monday && start < addDays(monday, 7)
    }).length
    if (count >= STREAK_MIN_SESSIONS) {
      weeksAtTarget++
      run++
      bestRun = Math.max(bestRun, run)
    } else {
      run = 0
    }
  }
  let deloadDays = 0
  for (let day = from; day < to; day = addDays(day, 1)) if (inDeload(data.deloadPeriods, localDateStamp(day))) deloadDays++

  // Travail
  let sets = 0
  let volume = 0
  let durationMs = 0
  for (const s of monthSessions) {
    const stats = sessionStats(s)
    sets += stats.setCount
    volume += stats.volume
    durationMs += stats.durationMs
  }

  // Records battus et progression, exercice par exercice
  const history = new Map<string, SetEntry[]>()
  const records = new Map<string, MonthRecord>()
  const monthSets = new Map<string, { type: ExerciseType; before: SetEntry[]; sets: SetEntry[] }>()
  for (const s of done) {
    const start = new Date(s.startedAt)
    if (start >= to) break
    const during = start >= from
    for (const exercise of s.exercises) {
      const key = `${exercise.exerciseId}|${exercise.type}`
      const past = history.get(key) ?? []
      const work = workSets(exercise.sets)
      if (during && work.length > 0) {
        const entry = monthSets.get(key) ?? { type: exercise.type, before: past, sets: [] }
        entry.sets.push(...work)
        monthSets.set(key, entry)
      }
      history.set(key, [...past, ...work])
    }
  }
  // Records : le meilleur de chaque type et de chaque exercice sur le mois
  for (const [sessionId, list] of sessionRecords(done)) {
    if (!monthSessions.some((s) => s.id === sessionId)) continue
    for (const { exerciseId, records: broken } of list) {
      for (const r of broken) {
        const id = `${exerciseId}|${r.kind}`
        const current = records.get(id)
        const better = !current || (r.load ?? 0) > (current.load ?? 0) || ((r.load ?? 0) === (current.load ?? 0) && r.value > current.value)
        if (better) records.set(id, { exerciseId, kind: r.kind, value: r.value, ...(r.load !== undefined ? { load: r.load } : {}) })
      }
    }
  }
  const progress: MonthProgress[] = []
  for (const [key, entry] of monthSets) {
    const kind = MAIN_KIND[entry.type]
    const before = computeBests(entry.type, entry.before)[kind]
    const after = computeBests(entry.type, entry.sets)[kind]
    if (!before || !after || after <= before) continue
    progress.push({ exerciseId: key.split('|')[0], kind, before, after, gain: (after - before) / before })
  }
  progress.sort((a, b) => b.gain - a.gain)

  // Corps
  const averages = movingAverage(data.weighIns).filter((p) => inMonth(p.date))
  const sortedMeasures = [...data.measurements].sort((a, b) => a.date.localeCompare(b.date))
  let latestIndex = -1
  sortedMeasures.forEach((m, i) => {
    if (inMonth(m.date)) latestIndex = i
  })

  // Statuts sur le mois et points à travailler
  const board = boardBetween(data.sessions, data.exercisesById, from, to, data.bodyweight)
  const name = (id: string) => data.exercisesById.get(id)?.name ?? 'Exercice supprimé'
  const focus = board.rows
    .filter((r) => r.status === 'stagnation')
    .map((r) => `${name(r.exerciseId)} : pas de progrès depuis 3 séances (baisse de 10 % et remonte, ou change d’exercice).`)
  const now = data.now ?? new Date()
  const end = to < now ? to : now
  const elapsedWeeks = Math.max(1, (end.getTime() - from.getTime()) / (7 * 86_400_000))
  const muscleSets = setsByMuscle(monthSessions, data.exercisesById, from, to)
  const lagging = [...plannedWeeklySets(data.templates, data.exercisesById)]
    .filter(([muscle]) => muscle !== 'autre' && muscle !== 'abdos')
    .map(([muscle, planned]) => ({ muscle, planned, average: Math.round(((muscleSets.get(muscle) ?? 0) / elapsedWeeks) * 10) / 10 }))
    .filter((m) => monthSessions.length > 0 && m.average < m.planned * PLANNED_RATIO)
    .sort((a, b) => a.average / a.planned - b.average / b.planned)
  for (const m of lagging) {
    const avg = m.average.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
    focus.push(`${MUSCLE_LABELS[m.muscle]} : ${avg} série${m.average >= 2 ? 's' : ''} par semaine en moyenne, ${m.planned} prévues.`)
  }

  return {
    month,
    bestStreak: bestRun,
    board,
    focus: focus.slice(0, MAX_FOCUS),
    sessions: monthSessions.length,
    previousSessions: done.filter((s) => monthKey(new Date(s.startedAt)) === previous).length,
    byTemplate: [...byTemplate.entries()].map(([templateId, count]) => ({ templateId, count })),
    foot: data.activities.filter((a) => a.type === 'foot' && inMonth(a.date)).length,
    tennis: data.activities.filter((a) => a.type === 'tennis' && inMonth(a.date)).length,
    weeksAtTarget,
    weeks,
    deloadDays,
    workSets: sets,
    volume,
    durationMs,
    muscles: setsByMuscle(monthSessions, data.exercisesById, from, to),
    records: [...records.values()],
    progress: progress.slice(0, 3),
    weight: averages.length > 0 ? { start: averages[0].average, end: averages.at(-1)!.average } : null,
    measurement:
      latestIndex >= 0
        ? { latest: sortedMeasures[latestIndex], previous: latestIndex > 0 ? sortedMeasures[latestIndex - 1] : null }
        : null,
    photos: data.photos.filter((p) => inMonth(p.date)).sort((a, b) => a.date.localeCompare(b.date)),
  }
}
