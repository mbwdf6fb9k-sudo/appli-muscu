import type { MeasureKey, Measurement } from '../db/database'
import { daysSince } from './dates'

export const MEASURES: { key: MeasureKey; label: string; how: string }[] = [
  { key: 'bras', label: 'Bras', how: 'contracté, au plus large' },
  { key: 'poitrine', label: 'Poitrine', how: 'sous les aisselles, en fin d’expiration' },
  { key: 'epaules', label: 'Épaules', how: 'au plus large, bras relâchés' },
  { key: 'taille', label: 'Taille', how: 'au nombril, ventre relâché' },
  { key: 'cuisse', label: 'Cuisse', how: 'au plus large, jambe relâchée' },
]

/** Au-delà, un rappel discret propose de reprendre ses mesures. */
export const MEASURE_REMINDER_DAYS = 30

const round1 = (value: number) => Math.round(value * 10) / 10

const byDate = (a: Measurement, b: Measurement) => a.date.localeCompare(b.date)

/** Les valeurs d'une mesure, de la plus ancienne à la plus récente (jours sans cette mesure ignorés). */
export function measureSeries(measurements: Measurement[], key: MeasureKey): { date: string; value: number }[] {
  return [...measurements]
    .sort(byDate)
    .flatMap((m) => (m[key] !== undefined ? [{ date: m.date, value: m[key]! }] : []))
}

export interface MeasureSummary {
  key: MeasureKey
  latest: number
  latestDate: string
  /** Écart depuis la toute première valeur (cm, signé) */
  change: number
}

/** Dernière valeur de chaque mesure et écart depuis la première. */
export function measureSummaries(measurements: Measurement[]): MeasureSummary[] {
  return MEASURES.flatMap(({ key }) => {
    const series = measureSeries(measurements, key)
    if (series.length === 0) return []
    const last = series.at(-1)!
    return [{ key, latest: last.value, latestDate: last.date, change: round1(last.value - series[0].value) }]
  })
}

/** Rapport épaules / taille (proportions « en V ») d'après les dernières valeurs connues. */
export function shoulderWaistRatio(measurements: Measurement[]): number | null {
  const shoulders = measureSeries(measurements, 'epaules').at(-1)
  const waist = measureSeries(measurements, 'taille').at(-1)
  if (!shoulders || !waist || waist.value <= 0) return null
  return Math.round((shoulders.value / waist.value) * 100) / 100
}

/** Jours depuis la dernière mesure s'il est temps d'en refaire une (sinon null). */
export function measureReminder(measurements: Measurement[], now = new Date()): number | null {
  const last = [...measurements].sort(byDate).at(-1)
  if (!last) return null
  const days = daysSince(`${last.date}T12:00:00`, now)
  return days > MEASURE_REMINDER_DAYS ? days : null
}

/** Garde seulement les valeurs saisies (> 0), arrondies au dixième. */
export function cleanMeasurement(date: string, values: Partial<Record<MeasureKey, number | undefined>>): Measurement {
  const measurement: Measurement = { date }
  for (const { key } of MEASURES) {
    const value = values[key]
    if (value !== undefined && Number.isFinite(value) && value > 0) measurement[key] = round1(value)
  }
  return measurement
}
