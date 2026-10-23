import type { Activity, Exercise, ExerciseType, Measurement, Photo, Session, SessionTemplateId, SetEntry, WeighIn } from '../db/database'
import type { DeloadPeriod } from '../db/settings'
import { localDateStamp } from './dates'
import { inDeload } from './deload'
import { setsByMuscle, type MuscleKey } from './muscleVolume'
import { startOfWeek } from './progress'
import { computeBests, findBrokenRecords, type RecordKind } from './records'
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
}

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
  for (let monday = startOfWeek(from); monday < to; monday = addDays(monday, 7)) {
    if (monday < from) continue
    weeks++
    const count = done.filter((s) => {
      const start = new Date(s.startedAt)
      return start >= monday && start < addDays(monday, 7)
    }).length
    if (count >= STREAK_MIN_SESSIONS) weeksAtTarget++
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
        for (const broken of findBrokenRecords(exercise.type, past, work)) {
          const id = `${exercise.exerciseId}|${broken.kind}`
          const current = records.get(id)
          if (!current || broken.value > current.value) {
            records.set(id, { exerciseId: exercise.exerciseId, kind: broken.kind, value: broken.value })
          }
        }
        const entry = monthSets.get(key) ?? { type: exercise.type, before: past, sets: [] }
        entry.sets.push(...work)
        monthSets.set(key, entry)
      }
      history.set(key, [...past, ...work])
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

  return {
    month,
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
