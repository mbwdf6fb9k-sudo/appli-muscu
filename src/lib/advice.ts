import type { Activity, ProgramSessionId, Session } from '../db/database'
import { TEMPLATE_NAMES } from '../db/seed'
import { daysSince, formatDaysAgo, localDateStamp } from './dates'
import { startOfWeek } from './progress'

/** Séances conseillables (jamais la séance libre) ; ordre en cas d'égalité. */
const ORDER: ProgramSessionId[] = ['dos-biceps', 'pecs-triceps', 'bras', 'jambes']

const RESTED: Record<ProgramSessionId, string> = {
  'dos-biceps': 'dos et biceps reposés',
  'pecs-triceps': 'pecs et triceps reposés',
  bras: 'bras reposés',
  jambes: 'jambes reposées',
}

/** Au-delà, repos conseillé. */
export const MAX_SESSIONS_PER_WEEK = 4
export const MAX_DAYS_IN_A_ROW = 3

/** « Pourquoi pas une autre ? » : une raison par séance non conseillée. */
export interface OtherReason {
  templateId: ProgramSessionId
  reason: string
}

export type Advice =
  | { kind: 'session'; templateId: ProgramSessionId; reason: string; others: OtherReason[] }
  | { kind: 'rest'; reason: string; others: OtherReason[] }

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

  const yesterdayTemplates = new Set(done.filter((s) => s.date === yesterday).map((s) => s.templateId))
  const sportOn = (date: string) => activities.find((a) => a.date === date)
  const footTomorrow = footDays.includes(addDays(now, 1).getDay())
  const lastDone = (id: ProgramSessionId) =>
    done.filter((s) => s.templateId === id).reduce<string | null>((max, s) => (!max || s.startedAt > max ? s.startedAt : max), null)
  const sportName = (type: Activity['type']) => (type === 'foot' ? 'Foot' : 'Tennis')
  const since = (id: ProgramSessionId) => {
    const last = lastDone(id)
    return last ? `faite ${formatDaysAgo(daysSince(last, now))}` : 'jamais faite'
  }

  /** Pourquoi une séance est écartée aujourd'hui (null si elle est possible). */
  const excludedBecause = (id: ProgramSessionId): string | null => {
    if (id === 'bras') {
      if (yesterdayTemplates.has('dos-biceps')) return 'Dos-Biceps faite hier : biceps pas encore récupérés'
      if (yesterdayTemplates.has('pecs-triceps')) return 'Pecs-Triceps faite hier : triceps pas encore récupérés'
    }
    if (id === 'dos-biceps' && yesterdayTemplates.has('bras')) return 'Bras faite hier : biceps pas encore récupérés'
    if (id === 'pecs-triceps' && yesterdayTemplates.has('bras')) return 'Bras faite hier : triceps pas encore récupérés'
    const last = lastDone(id)
    if (last && now.getTime() - new Date(last).getTime() < 48 * 3_600_000) return `${since(id)} : pas encore 48 h de récupération`
    if (id === 'jambes') {
      const before = sportOn(yesterday)
      if (before) return `${sportName(before.type)} hier : jambes pas encore récupérées`
      const sameDay = sportOn(today)
      if (sameDay) return `${sportName(sameDay.type)} aujourd’hui : garde tes jambes`
      if (footTomorrow) return 'demain c’est ton jour de foot : jambes fraîches pour le match'
    }
    return null
  }

  // Situation de chaque séance, pour « Pourquoi pas une autre ? » quand le repos passe avant tout
  const situations = (): OtherReason[] =>
    ORDER.map((id) => ({ templateId: id, reason: excludedBecause(id) ?? `${since(id)}, possible un autre jour` }))

  const thisWeek = done.filter((s) => new Date(s.startedAt) >= monday).length
  if (thisWeek >= MAX_SESSIONS_PER_WEEK) {
    return { kind: 'rest', reason: `${thisWeek} séances de muscu cette semaine : place à la récupération.`, others: situations() }
  }
  const trainedOn = (n: number) => done.some((s) => s.date === localDateStamp(addDays(now, -n)))
  if (Array.from({ length: MAX_DAYS_IN_A_ROW }, (_, i) => trainedOn(i + 1)).every(Boolean)) {
    return {
      kind: 'rest',
      reason: `${MAX_DAYS_IN_A_ROW} jours d’entraînement d’affilée : une journée de repos aide à progresser.`,
      others: situations(),
    }
  }

  const candidates = ORDER.filter((id) => !excludedBecause(id)).sort((a, b) => {
    const la = lastDone(a)
    const lb = lastDone(b)
    if (la === lb) return ORDER.indexOf(a) - ORDER.indexOf(b)
    if (!la) return -1
    if (!lb) return 1
    return la.localeCompare(lb) || ORDER.indexOf(a) - ORDER.indexOf(b)
  })
  const pick = candidates[0]
  if (!pick) {
    return {
      kind: 'rest',
      reason: 'Toutes les séances demandent encore de la récupération aujourd’hui.',
      others: ORDER.map((id) => ({ templateId: id, reason: excludedBecause(id)! })),
    }
  }

  const pickName = TEMPLATE_NAMES[pick]
  const others = ORDER.filter((id) => id !== pick).map((id) => {
    const excluded = excludedBecause(id)
    if (excluded) return { templateId: id, reason: excluded }
    const reason = lastDone(id)
      ? lastDone(pick)
        ? `${since(id)}, ${pickName} attend depuis plus longtemps`
        : `${since(id)}, ${pickName} n’a jamais été faite`
      : `jamais faite non plus, mais ${pickName} passe d’abord`
    return { templateId: id, reason }
  })
  const last = lastDone(pick)
  const reason = `${last ? `pas faite depuis ${daysSince(last, now)} jours` : 'jamais faite'}, ${RESTED[pick]}`
  return { kind: 'session', templateId: pick, reason, others }
}
