import type { Activity, Session, SessionTemplateId } from '../db/database'
import { daysSince, localDateStamp } from './dates'
import { startOfWeek } from './progress'

/** Ordre en cas d'égalité. */
const ORDER: SessionTemplateId[] = ['dos-biceps', 'pecs-triceps', 'bras', 'jambes']

const RESTED: Record<SessionTemplateId, string> = {
  'dos-biceps': 'dos et biceps reposés',
  'pecs-triceps': 'pecs et triceps reposés',
  bras: 'bras reposés',
  jambes: 'jambes reposées',
}

/** Au-delà, repos conseillé. */
export const MAX_SESSIONS_PER_WEEK = 4
export const MAX_DAYS_IN_A_ROW = 3

export type Advice =
  | { kind: 'session'; templateId: SessionTemplateId; reason: string }
  | { kind: 'rest'; reason: string }

export interface AdviceContext {
  /** Séances terminées */
  sessions: Session[]
  activities: Activity[]
  /** Jours de foot habituels (0 = dimanche … 6 = samedi) */
  footDays: number[]
  now: Date
}

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/**
 * Séance conseillée du jour (semaine du lundi au dimanche) :
 * 1. repos après 4 séances de muscu dans la semaine, ou 3 jours de muscu d'affilée (aujourd'hui non compris) ;
 * 2. séances écartées : Bras la veille de Dos-Biceps/Pecs-Triceps, et inversement ; la même séance il y a
 *    moins de 48 h ; Jambes si foot ou tennis la veille ou aujourd'hui, ou si demain est un jour de foot habituel ;
 * 3. parmi les autres, celle faite il y a le plus longtemps (jamais faite d'abord) ; égalité : Dos-Biceps,
 *    Pecs-Triceps, Bras, Jambes ;
 * 4. aucune : repos.
 */
export function adviceOfDay({ sessions, activities, footDays, now }: AdviceContext): Advice {
  const done = sessions.filter((s) => s.status === 'done')
  const today = localDateStamp(now)
  const yesterday = localDateStamp(addDays(now, -1))
  const monday = startOfWeek(now)

  const thisWeek = done.filter((s) => new Date(s.startedAt) >= monday).length
  if (thisWeek >= MAX_SESSIONS_PER_WEEK) {
    return { kind: 'rest', reason: `${thisWeek} séances de muscu cette semaine : place à la récupération.` }
  }
  const trainedOn = (n: number) => done.some((s) => s.date === localDateStamp(addDays(now, -n)))
  if (Array.from({ length: MAX_DAYS_IN_A_ROW }, (_, i) => trainedOn(i + 1)).every(Boolean)) {
    return { kind: 'rest', reason: `${MAX_DAYS_IN_A_ROW} jours d’entraînement d’affilée : une journée de repos aide à progresser.` }
  }

  const yesterdayTemplates = new Set(done.filter((s) => s.date === yesterday).map((s) => s.templateId))
  const sportYesterdayOrToday = activities.some((a) => a.date === yesterday || a.date === today)
  const footTomorrow = footDays.includes(addDays(now, 1).getDay())
  const lastDone = (id: SessionTemplateId) =>
    done.filter((s) => s.templateId === id).reduce<string | null>((max, s) => (!max || s.startedAt > max ? s.startedAt : max), null)

  const excluded = (id: SessionTemplateId): boolean => {
    if (id === 'bras' && (yesterdayTemplates.has('dos-biceps') || yesterdayTemplates.has('pecs-triceps'))) return true
    if ((id === 'dos-biceps' || id === 'pecs-triceps') && yesterdayTemplates.has('bras')) return true
    const last = lastDone(id)
    if (last && now.getTime() - new Date(last).getTime() < 48 * 3_600_000) return true
    if (id === 'jambes' && (sportYesterdayOrToday || footTomorrow)) return true
    return false
  }

  const candidates = ORDER.filter((id) => !excluded(id)).sort((a, b) => {
    const la = lastDone(a)
    const lb = lastDone(b)
    if (la === lb) return ORDER.indexOf(a) - ORDER.indexOf(b)
    if (!la) return -1
    if (!lb) return 1
    return la.localeCompare(lb) || ORDER.indexOf(a) - ORDER.indexOf(b)
  })
  const pick = candidates[0]
  if (!pick) {
    return { kind: 'rest', reason: 'Toutes les séances demandent encore de la récupération aujourd’hui.' }
  }
  const last = lastDone(pick)
  const since = last ? `pas faite depuis ${daysSince(last, now)} jours` : 'jamais faite'
  return { kind: 'session', templateId: pick, reason: `${since}, ${RESTED[pick]}` }
}
