import type { Session, Target } from '../db/database'
import type { DeloadPeriod } from '../db/settings'
import { localDateStamp } from './dates'

export const DELOAD_DAYS = 7
/** Une semaine allégée est suggérée 6 semaines après la précédente (ou après la première séance). */
export const DELOAD_EVERY_DAYS = 42
export const DELOAD_STAGNATIONS = 3
export const DELOAD_SNOOZE_DAYS = 3

const addDays = (stamp: string, days: number) => {
  const [y, m, d] = stamp.split('-').map(Number)
  return localDateStamp(new Date(y, m - 1, d + days))
}

const dayDiff = (from: string, to: string) => {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** La semaine allégée en cours ce jour-là (7 jours, sauf si arrêtée avant). */
export function activeDeload(periods: DeloadPeriod[], today: string): DeloadPeriod | null {
  return periods.find((p) => !p.stopped && p.start <= today && today <= p.end) ?? null
}

/** Ce jour-là fait-il partie d'une semaine allégée (en cours, finie ou arrêtée) ? */
export function inDeload(periods: DeloadPeriod[], day: string): boolean {
  return periods.some((p) => p.start <= day && day <= p.end)
}

/** Active une semaine allégée à partir d'aujourd'hui (7 jours, fin incluse). */
export function startDeload(periods: DeloadPeriod[], today: string): DeloadPeriod[] {
  if (activeDeload(periods, today)) return periods
  return [...periods, { start: today, end: addDays(today, DELOAD_DAYS - 1) }]
}

/** Arrête la semaine allégée en cours : elle se termine aujourd'hui. */
export function stopDeload(periods: DeloadPeriod[], today: string): DeloadPeriod[] {
  const active = activeDeload(periods, today)
  return periods.map((p) => (p === active ? { ...p, end: today, stopped: true } : p))
}

export interface DeloadContext {
  periods: DeloadPeriod[]
  snoozedUntil: string | null
  /** Mise en place de la fonction (ISO) */
  featureStartAt: string | null
  sessions: Session[]
  stagnating: number
  now: Date
}

export type DeloadReason = 'weeks' | 'stagnation'

/**
 * Faut-il suggérer une semaine allégée ?
 * - 6 semaines après la première séance faite avec cette version (ou après la dernière semaine allégée),
 * - ou plus tôt si 3 exercices ou plus sont en stagnation.
 * Jamais pendant une semaine allégée, ni pendant les 3 jours qui suivent « Plus tard ».
 */
export function deloadSuggestion(ctx: DeloadContext): DeloadReason | null {
  const today = localDateStamp(ctx.now)
  if (activeDeload(ctx.periods, today)) return null
  if (ctx.snoozedUntil && new Date(ctx.snoozedUntil) > ctx.now) return null
  if (ctx.stagnating >= DELOAD_STAGNATIONS) return 'stagnation'
  const lastEnd = ctx.periods.map((p) => p.end).sort().at(-1)
  const firstSession = ctx.sessions
    .filter((s) => s.status === 'done' && (!ctx.featureStartAt || s.startedAt >= ctx.featureStartAt))
    .map((s) => s.date)
    .sort()[0]
  const base = lastEnd ?? firstSession
  if (!base) return null
  return dayDiff(base, today) >= DELOAD_EVERY_DAYS ? 'weeks' : null
}

/** « Plus tard » : la carte revient 3 jours après. */
export function snoozeDeload(now = new Date()): string {
  return new Date(now.getTime() + DELOAD_SNOOZE_DAYS * 86_400_000).toISOString()
}

/** Objectif d'une séance allégée : moitié moins de séries (arrondi au supérieur), RIR 3-4. */
export function deloadTarget(target: Target): Target {
  return { ...target, sets: Math.ceil(target.sets / 2), rir: '3-4' }
}
