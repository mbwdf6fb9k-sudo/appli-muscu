import { useActivities } from '../db/activities'
import type { DayChoice } from '../db/database'
import { TEMPLATE_NAMES } from '../db/seed'
import { useDoneSessions } from '../db/sessions'
import { useSettings } from '../db/settings'
import { adviceOfDay } from '../lib/advice'
import { localDateStamp } from '../lib/dates'

/** « Conseillé aujourd'hui : Pecs-Triceps · pas faite depuis 5 jours, pecs et triceps reposés ». Jamais bloquant. */
export function AdviceCard(props: { now: Date; choice: DayChoice | null; onChoose: (choice: DayChoice) => void }) {
  const { now } = props
  const sessions = useDoneSessions()
  const settings = useSettings()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const activities = useActivities(localDateStamp(yesterday), localDateStamp(now))
  if (!sessions || !settings || !activities) return null

  const advice = adviceOfDay({ sessions, activities, footDays: settings.footDays, now })
  const choice: DayChoice = advice.kind === 'rest' ? 'repos' : advice.templateId
  const title = advice.kind === 'rest' ? 'Conseillé : repos' : `Conseillé aujourd’hui : ${TEMPLATE_NAMES[advice.templateId]}`

  return (
    <div className="card advice-card">
      <span className="advice-text">
        <span className="advice-title">{title}</span>
        <span className="muted small">{advice.reason.charAt(0).toUpperCase() + advice.reason.slice(1)}</span>
      </span>
      {props.choice !== choice && (
        <button className="btn btn-secondary btn-small" onClick={() => props.onChoose(choice)}>
          Choisir
        </button>
      )}
    </div>
  )
}
