import type { ExerciseType, SetEntry, Target } from '../db/database'

/** 62.5 → « 62,5 » */
export function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

/** 45 → « 45 s » · 95 → « 1 min 35 » */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const s = seconds % 60
  return `${Math.floor(seconds / 60)} min${s ? ` ${String(s).padStart(2, '0')}` : ''}`
}

/** Une série : « 10 × 60 kg », « 8 reps », « 8 × +10 kg », « 45 s » */
export function formatSet(type: ExerciseType, set: SetEntry): string {
  if (type === 'duration') return formatSeconds(set.seconds ?? 0)
  const reps = set.reps ?? 0
  const kg = set.kg ?? 0
  if (type === 'bodyweight') return kg > 0 ? `${reps} × +${formatNumber(kg)} kg` : `${reps} reps`
  return `${reps} × ${formatNumber(kg)} kg`
}

/** Toutes les séries sur une ligne : « 10 × 60 · 10 × 60 · 8 × 62,5 kg » */
export function formatSetsLine(type: ExerciseType, sets: SetEntry[]): string {
  if (sets.length === 0) return ''
  if (type === 'duration') return sets.map((s) => formatSeconds(s.seconds ?? 0)).join(' · ')
  if (type === 'bodyweight') {
    if (sets.every((s) => !s.kg)) return `${sets.map((s) => s.reps ?? 0).join(' · ')} reps`
    return sets.map((s) => formatSet(type, s)).join(' · ')
  }
  return `${sets.map((s) => `${s.reps ?? 0} × ${formatNumber(s.kg ?? 0)}`).join(' · ')} kg`
}

/** Objectif : « 3 × 8-12 », « 2 × 30-60 s » */
export function formatTarget(type: ExerciseType, target: Target): string {
  const range = target.min === target.max ? `${target.min}` : `${target.min}-${target.max}`
  return `${target.sets} × ${range}${type === 'duration' ? ' s' : ''}`
}

/** « 15 oct. » */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** « 18:05 » */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** « 52 min » · « 1 h 05 » */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** « 12 450 kg » */
export function formatVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString('fr-FR')} kg`
}

/** Saisie au clavier : « 62,5 » → 62.5 (undefined si invalide) */
export function parseNumber(text: string): number | undefined {
  const value = Number(text.replace(',', '.').trim())
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined
}
