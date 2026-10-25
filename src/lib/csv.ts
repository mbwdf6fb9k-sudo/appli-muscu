import type { Activity, Exercise, Session, WeighIn } from '../db/database'
import { TEMPLATE_NAMES } from '../db/seed'
import { MUSCLE_LABELS } from './muscleVolume'
import { epley1RM } from './records'

/**
 * CSV pour Excel en français (ou Power BI) : séparateur « ; », décimales avec virgule,
 * UTF-8 avec BOM, dates AAAA-MM-JJ, fins de ligne Windows.
 */
const SEPARATOR = ';'
const BOM = '﻿'

type Cell = string | number | null | undefined

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 100) / 100).replace('.', ',') : ''
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return BOM + [header, ...rows].map((row) => row.map(csvCell).join(SEPARATOR)).join('\r\n') + '\r\n'
}

const SET_TYPES = { work: 'travail', warmup: 'échauffement', drop: 'dégressive' } as const

/** Une ligne par série : séances terminées, de la plus ancienne à la plus récente. */
export function seriesCsv(sessions: Session[], exercisesById: Map<string, Exercise>): string {
  const rows: Cell[][] = []
  const done = sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const session of done) {
    for (const entry of session.exercises) {
      const exercise = exercisesById.get(entry.exerciseId)
      entry.sets.forEach((set, i) => {
        const kind = set.warmup ? 'warmup' : set.drop ? 'drop' : 'work'
        const counts = kind !== 'warmup' && entry.type !== 'duration'
        rows.push([
          session.date,
          TEMPLATE_NAMES[session.templateId],
          exercise?.name ?? 'Exercice supprimé',
          exercise?.muscle ? MUSCLE_LABELS[exercise.muscle] : 'Autre',
          i + 1,
          SET_TYPES[kind],
          entry.type === 'duration' ? null : (set.kg ?? 0),
          entry.type === 'duration' ? null : (set.reps ?? 0),
          entry.type === 'duration' ? (set.seconds ?? 0) : null,
          kind === 'work' && entry.type === 'weight' ? (epley1RM(set.kg, set.reps) ?? null) : null,
          counts ? (set.kg ?? 0) * (set.reps ?? 0) : null,
          entry.note,
        ])
      })
    }
  }
  return toCsv(
    ['date', 'seance', 'exercice', 'groupe', 'serie', 'type', 'kg', 'reps', 'duree_s', '1rm_estime', 'volume_kg', 'note'],
    rows,
  )
}

export function weighInsCsv(weighIns: WeighIn[]): string {
  return toCsv(['date', 'poids_kg'], [...weighIns].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.kg]))
}

export function activitiesCsv(activities: Activity[]): string {
  return toCsv(['date', 'type'], [...activities].sort((a, b) => a.date.localeCompare(b.date)).map((a) => [a.date, a.type]))
}
