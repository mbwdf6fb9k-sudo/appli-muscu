import type { Day, Session, SessionTemplateId, Supplement, SupplementMoment } from '../db/database'

export type DayType = 'training' | 'rest'

interface MomentInfo {
  label: string
  /** Lié à la séance : proposé seulement en jour d'entraînement */
  session: boolean
  /** Minutes avant la séance, pour calculer l'heure précise */
  before?: number
}

/** Les moments de la journée, dans l'ordre chronologique. */
export const MOMENTS: Record<SupplementMoment, MomentInfo> = {
  breakfast: { label: 'Petit-déjeuner', session: false },
  lunch: { label: 'Déjeuner', session: false },
  pre45: { label: '~45 min avant la séance', session: true, before: 45 },
  // « 20-30 min avant » : on vise 30 min (séance à 18 h → 17 h 30)
  pre20: { label: '20-30 min avant la séance', session: true, before: 30 },
  during: { label: 'Pendant la séance', session: true },
  after: { label: 'Après la séance', session: true },
  dinner: { label: 'Dîner', session: false },
  bedtime: { label: 'Coucher', session: false },
}

export const MOMENT_ORDER = Object.keys(MOMENTS) as SupplementMoment[]

/**
 * Type de journée : entraînement si une séance est choisie dans Aujourd'hui,
 * ou si une séance a été commencée ou faite aujourd'hui ; sinon repos.
 */
export function dayType(
  day: Day | null | undefined,
  sessionsToday: Session[],
): { type: DayType; templateId: SessionTemplateId | null } {
  if (day && day.choice !== 'repos') return { type: 'training', templateId: day.choice }
  const latest = [...sessionsToday].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  if (latest) return { type: 'training', templateId: latest.templateId }
  return { type: 'rest', templateId: null }
}

/** « 18:00 » moins 45 min → « 17:15 » */
export function minutesBefore(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (((h * 60 + m - minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** « 17:15 » → « 17 h 15 » ; « 17:00 » → « 17 h » */
export function formatHour(time: string): string {
  const [h, m] = time.split(':')
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`
}

/** Séance strictement après 18 h : le préworkout risque de gêner le sommeil. */
export function isLateSession(plannedTime: string | undefined): boolean {
  return !!plannedTime && plannedTime > '18:00'
}

export interface ScheduleGroup {
  moment: SupplementMoment
  label: string
  /** Heure précise (HH:MM) si l'heure de séance est connue */
  time: string | null
  items: Supplement[]
}

/** Le planning du jour : les compléments regroupés par moment, dans l'ordre de la journée. */
export function buildSchedule(supplements: Supplement[], type: DayType, plannedTime?: string): ScheduleGroup[] {
  const sorted = [...supplements].sort((a, b) => a.order - b.order)
  return MOMENT_ORDER.flatMap((moment) => {
    const items = sorted.filter((s) => (type === 'training' ? s.training : s.rest) === moment)
    if (items.length === 0) return []
    const before = MOMENTS[moment].before
    return [
      {
        moment,
        label: MOMENTS[moment].label,
        time: plannedTime && before !== undefined ? minutesBefore(plannedTime, before) : null,
        items,
      },
    ]
  })
}
