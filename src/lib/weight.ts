import type { WeighIn } from '../db/database'

const DAY_MS = 86_400_000

/** « 2026-10-22 » → numéro de jour (indépendant du fuseau et du changement d'heure). */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

const round = (value: number, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals

export interface WeightPoint {
  date: string
  kg: number
  /** Moyenne des pesées du jour et des 6 jours précédents */
  average: number
}

/** Moyenne glissante sur 7 jours calendaires ; les jours sans pesée sont ignorés. */
export function movingAverage(weighIns: WeighIn[], windowDays = 7): WeightPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((weighIn, i) => {
    const day = dayNumber(weighIn.date)
    const window = sorted.slice(0, i + 1).filter((w) => day - dayNumber(w.date) < windowDays)
    return { date: weighIn.date, kg: weighIn.kg, average: round(window.reduce((sum, w) => sum + w.kg, 0) / window.length) }
  })
}

export interface WeightSummary {
  /** Dernière moyenne sur 7 jours */
  current: number
  currentDate: string
  /** Écart avec le poids de départ (kg, signé) */
  sinceStart: number
  /** Écart dans le sens de l'objectif ? (null si aucun écart) */
  onTrack: boolean | null
  /** Ce qu'il reste à prendre (+) ou perdre (−) pour le poids visé */
  toTarget: number | null
}

export function weightSummary(
  weighIns: WeighIn[],
  profile: { startWeight: number; targetWeight: number | null },
): WeightSummary | null {
  const last = movingAverage(weighIns).at(-1)
  if (!last) return null
  const sinceStart = round(last.average - profile.startWeight, 1)
  // Sans poids visé, l'objectif de l'année est une prise de muscle : on vise une hausse
  const direction = profile.targetWeight !== null ? Math.sign(profile.targetWeight - profile.startWeight) || 1 : 1
  return {
    current: last.average,
    currentDate: last.date,
    sinceStart,
    onTrack: sinceStart === 0 ? null : Math.sign(sinceStart) === direction,
    toTarget: profile.targetWeight !== null ? round(profile.targetWeight - last.average, 1) : null,
  }
}

/** Protéines visées : 1,6 à 2 g par kg, arrondies à 5 g. */
export function proteinRange(kg: number): { low: number; high: number } {
  const round5 = (value: number) => Math.round(value / 5) * 5
  return { low: round5(kg * 1.6), high: round5(kg * 2) }
}

export type WeightRange = '1m' | '3m' | 'year'

export const RANGE_DAYS: Record<WeightRange, number> = { '1m': 31, '3m': 92, year: 365 }

/** Les points de la période choisie, jusqu'à aujourd'hui. */
export function filterRange<T extends { date: string }>(points: T[], range: WeightRange, today: string): T[] {
  const end = dayNumber(today)
  return points.filter((p) => end - dayNumber(p.date) < RANGE_DAYS[range])
}
