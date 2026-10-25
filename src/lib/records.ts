import type { ExerciseType, SetEntry } from '../db/database'
import { formatNumber, formatSeconds, formatVolume } from './format'
import { workSets } from './sets'

/** 1RM estimé (formule d'Epley), seulement pour les séries de 1 à 12 reps avec une charge. */
export function epley1RM(kg: number | undefined, reps: number | undefined): number | undefined {
  if (!kg || !reps || kg <= 0 || reps < 1 || reps > 12) return undefined
  // Arrondi au centième : évite les faux records dus aux décimales (62,00000000001 > 62)
  return Math.round(kg * (30 + reps) * 100 / 30) / 100
}

/**
 * maxKg, best1RM, maxReps, maxLest, maxSeconds : meilleures valeurs d'une série.
 * repsAtLoad : plus de reps qu'avant à une charge égale ou supérieure. maxVolume : kg × reps sur une séance.
 */
export type RecordKind = 'maxKg' | 'best1RM' | 'maxReps' | 'maxLest' | 'maxSeconds' | 'repsAtLoad' | 'maxVolume'

export type Bests = Partial<Record<RecordKind, number>>

export const RECORD_LABELS: Record<RecordKind, string> = {
  maxKg: 'Charge max',
  best1RM: '1RM estimé',
  maxReps: 'Reps max',
  maxLest: 'Lest max',
  maxSeconds: 'Meilleure durée',
  repsAtLoad: 'Reps à charge',
  maxVolume: 'Volume (séance)',
}

/** « 93,3 kg », « 12 reps », « 1 min 05 », « poids du corps », « 10 reps à 40 kg », « 1 240 kg » */
export function formatRecordValue(kind: RecordKind, value: number, load?: number): string {
  if (kind === 'repsAtLoad') return load !== undefined ? `${value} reps à ${formatNumber(load)} kg` : `${value} reps`
  if (kind === 'maxVolume') return formatVolume(value)
  if (kind === 'maxReps') return `${value} reps`
  if (kind === 'maxSeconds') return formatSeconds(value)
  if (kind === 'maxLest' && value === 0) return 'poids du corps'
  return `${formatNumber(Math.round(value * 10) / 10)} kg`
}

/** Résumé court des meilleures valeurs : « 1RM 93 kg · max 70 kg » */
export function formatBests(type: ExerciseType, bests: Bests): string {
  if (type === 'duration') return bests.maxSeconds ? `record ${formatSeconds(bests.maxSeconds)}` : ''
  if (type === 'bodyweight') {
    const parts = bests.maxReps ? [`${bests.maxReps} reps max`] : []
    if (bests.maxLest) parts.push(`lest ${formatNumber(bests.maxLest)} kg`)
    return parts.join(' · ')
  }
  // Même arrondi que la fiche de l'exercice (formatRecordValue) : au dixième
  const parts = bests.best1RM ? [`1RM ${formatNumber(Math.round(bests.best1RM * 10) / 10)} kg`] : []
  if (bests.maxKg) parts.push(`max ${formatNumber(bests.maxKg)} kg`)
  return parts.join(' · ')
}

/** Records suivis selon le type d'exercice. */
export const RECORD_KINDS: Record<ExerciseType, RecordKind[]> = {
  weight: ['maxKg', 'best1RM'],
  bodyweight: ['maxReps', 'maxLest'],
  duration: ['maxSeconds'],
}

function max(values: (number | undefined)[]): number | undefined {
  const numbers = values.filter((v): v is number => v !== undefined && v > 0)
  return numbers.length > 0 ? Math.max(...numbers) : undefined
}

export function computeBests(type: ExerciseType, allSets: SetEntry[]): Bests {
  const sets = workSets(allSets)
  switch (type) {
    case 'weight':
      return {
        maxKg: max(sets.map((s) => s.kg)),
        best1RM: max(sets.map((s) => epley1RM(s.kg, s.reps))),
      }
    case 'bodyweight':
      return { maxReps: max(sets.map((s) => s.reps)), maxLest: max(sets.map((s) => s.kg)) }
    case 'duration':
      return { maxSeconds: max(sets.map((s) => s.seconds)) }
  }
}

export interface BrokenRecord {
  kind: RecordKind
  value: number
  /** Ancien record (0 = poids du corps sans lest jusqu'ici) */
  previous: number
  /** Reps à charge : la charge concernée */
  load?: number
}

/** « 10 reps à 40 kg » ; l'ancien record : « 8 reps » */
export function formatRecord(record: BrokenRecord): { value: string; previous: string } {
  return {
    value: formatRecordValue(record.kind, record.value, record.load),
    previous: formatRecordValue(record.kind, record.previous),
  }
}

/** Volume d'une séance pour un exercice : kg × reps des séries de travail (lest au poids du corps ; 0 en durée). */
export function sessionVolume(type: ExerciseType, sets: SetEntry[]): number {
  if (type === 'duration') return 0
  return workSets(sets).reduce((sum, s) => sum + (s.kg ?? 0) * (s.reps ?? 0), 0)
}

/** Reps à charge : la meilleure série qui fait plus de reps qu'avant à une charge égale ou supérieure. */
function repsAtLoadRecord(previousSets: SetEntry[], currentSets: SetEntry[]): BrokenRecord | null {
  const previous = workSets(previousSets)
  let best: BrokenRecord | null = null
  for (const set of workSets(currentSets)) {
    const kg = set.kg ?? 0
    const reps = set.reps ?? 0
    if (kg <= 0 || reps <= 0) continue
    const before = previous.filter((p) => (p.kg ?? 0) >= kg).map((p) => p.reps ?? 0)
    if (before.length === 0) continue
    const previousBest = Math.max(...before)
    if (reps <= previousBest) continue
    if (!best || kg > best.load! || (kg === best.load && reps > best.value)) {
      best = { kind: 'repsAtLoad', value: reps, previous: previousBest, load: kg }
    }
  }
  return best
}

/**
 * Records battus par les séries du jour par rapport à tout l'historique.
 * Aucun record la première fois qu'on fait l'exercice.
 * previousBestVolume : meilleur volume d'une séance passée (0 = pas de record de volume).
 */
export function findBrokenRecords(
  type: ExerciseType,
  previousSets: SetEntry[],
  currentSets: SetEntry[],
  previousBestVolume = 0,
): BrokenRecord[] {
  if (workSets(previousSets).length === 0) return []
  const before = computeBests(type, previousSets)
  const now = computeBests(type, currentSets)
  const broken: BrokenRecord[] = []
  for (const kind of RECORD_KINDS[type]) {
    const value = now[kind]
    if (value === undefined) continue
    const previous = before[kind]
    // Lest : passer de « poids du corps » à du lest compte comme un record
    if (previous === undefined && kind !== 'maxLest') continue
    if (value > (previous ?? 0)) broken.push({ kind, value, previous: previous ?? 0 })
  }
  if (type === 'weight') {
    const reps = repsAtLoadRecord(previousSets, currentSets)
    if (reps) broken.push(reps)
  }
  const volume = sessionVolume(type, currentSets)
  if (previousBestVolume > 0 && volume > previousBestVolume) {
    broken.push({ kind: 'maxVolume', value: volume, previous: previousBestVolume })
  }
  return broken
}

/**
 * Séries du jour qui battent un record, au moment où elles ont été faites : chacune est comparée à
 * l'historique ET aux séries précédentes de la séance (deux records dans la même séance = deux fois).
 * Rien la première fois qu'on fait l'exercice.
 */
export function liveRecords(
  type: ExerciseType,
  history: SetEntry[],
  today: SetEntry[],
  previousBestVolume = 0,
): Map<number, BrokenRecord[]> {
  const records = new Map<number, BrokenRecord[]>()
  if (workSets(history).length === 0) return records
  let volume = 0
  let volumeBroken = false
  today.forEach((set, i) => {
    // Une série d'échauffement ou une suite dégressive ne bat jamais de record
    if (set.warmup || set.drop) return
    const broken = findBrokenRecords(type, [...history, ...today.slice(0, i)], [set])
    // Volume : la série qui fait dépasser le meilleur volume d'une séance passée (une seule fois)
    if (type !== 'duration') volume += (set.kg ?? 0) * (set.reps ?? 0)
    if (!volumeBroken && previousBestVolume > 0 && volume > previousBestVolume) {
      volumeBroken = true
      broken.push({ kind: 'maxVolume', value: volume, previous: previousBestVolume })
    }
    if (broken.length > 0) records.set(i, broken)
  })
  return records
}
