import type { Session } from '../db/database'
import { localDateStamp } from './dates'
import { startOfWeek } from './progress'

/** Séances de muscu par semaine pour compter dans la série. */
export const STREAK_MIN_SESSIONS = 3

const weekKey = (date: Date) => localDateStamp(startOfWeek(date))

function countsByWeek(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    if (s.status !== 'done') continue
    const key = weekKey(new Date(s.startedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const previousWeek = (monday: Date) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7)

/**
 * Série en cours : semaines d'affilée à 3 séances ou plus.
 * La semaine en cours ne casse pas la série tant qu'elle n'est pas finie : elle s'ajoute dès sa 3e séance.
 * Une semaine terminée sous 3 séances remet la série à zéro. Une semaine allégée compte normalement.
 */
export function currentStreak(sessions: Session[], now = new Date()): number {
  const counts = countsByWeek(sessions)
  let monday = startOfWeek(now)
  let streak = (counts.get(localDateStamp(monday)) ?? 0) >= STREAK_MIN_SESSIONS ? 1 : 0
  monday = previousWeek(monday)
  while ((counts.get(localDateStamp(monday)) ?? 0) >= STREAK_MIN_SESSIONS) {
    streak++
    monday = previousWeek(monday)
  }
  return streak
}

/** Meilleure série atteinte (semaines d'affilée à 3 séances ou plus). */
export function bestStreak(sessions: Session[], now = new Date()): number {
  const counts = countsByWeek(sessions)
  const weeks = [...counts.keys()].sort()
  if (weeks.length === 0) return 0
  const [y, m, d] = weeks[0].split('-').map(Number)
  let monday = new Date(y, m - 1, d)
  const last = startOfWeek(now)
  let best = 0
  let run = 0
  while (monday <= last) {
    if ((counts.get(localDateStamp(monday)) ?? 0) >= STREAK_MIN_SESSIONS) {
      run++
      best = Math.max(best, run)
    } else if (monday.getTime() !== last.getTime()) {
      // La semaine en cours, pas encore finie, ne casse rien
      run = 0
    }
    monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
  }
  return Math.max(best, currentStreak(sessions, now))
}

/** Séances de muscu cette semaine et ce mois-ci. */
export function sessionCounts(sessions: Session[], now = new Date()): { week: number; month: number } {
  const week = weekKey(now)
  const month = localDateStamp(now).slice(0, 7)
  let w = 0
  let m = 0
  for (const s of sessions) {
    if (s.status !== 'done') continue
    const start = new Date(s.startedAt)
    if (weekKey(start) === week) w++
    if (localDateStamp(start).slice(0, 7) === month) m++
  }
  return { week: w, month: m }
}
