import { useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { toggleActivity, useActivities } from '../db/activities'
import type { ActivityType, Session, SessionTemplateId } from '../db/database'
import type { DeloadPeriod } from '../db/settings'
import { TEMPLATE_NAMES } from '../db/seed'
import { localDateStamp } from '../lib/dates'
import { inDeload } from '../lib/deload'
import { monthKey, ofMonth } from '../lib/monthlyReview'
import { formatDuration } from '../lib/format'
import { startOfWeek, type SessionRecord } from '../lib/progress'
import { formatRecord, RECORD_LABELS } from '../lib/records'
import { sessionStats } from '../lib/sessionStats'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { Sheet } from './Sheet'

/** Noms courts de la légende (les couleurs sont dans global.css : --tpl-*) */
const LEGEND: { id: SessionTemplateId; label: string }[] = [
  { id: 'dos-biceps', label: 'Dos-Biceps' },
  { id: 'pecs-triceps', label: 'Pecs-Triceps' },
  { id: 'jambes', label: 'Jambes' },
  { id: 'bras', label: 'Bras' },
]
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const ACTIVITIES: { type: ActivityType; label: string }[] = [
  { type: 'foot', label: 'Foot' },
  { type: 'tennis', label: 'Tennis' },
]
const SWIPE_PX = 50

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

interface Props {
  sessions: Session[]
  deloadPeriods: DeloadPeriod[]
  now: Date
  /** Records battus, par séance (★ sur le jour) */
  records: Map<string, SessionRecord[]>
  exerciseName: (id: string) => string
}

/** Calendrier du mois : pastille par séance, foot/tennis, semaines allégées ; toucher un jour ouvre sa fiche. */
export function RegularityCalendar({ sessions, deloadPeriods, now, records, exerciseName }: Props) {
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [opened, setOpened] = useState<string | null>(null)
  const swipeStart = useRef<number | null>(null)

  const first = startOfWeek(month)
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const weeks: Date[][] = []
  for (let monday = first; monday <= lastOfMonth; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)))
  }
  const from = localDateStamp(weeks[0][0])
  const to = localDateStamp(weeks.at(-1)![6])
  const activities = useActivities(from, to) ?? []
  const today = localDateStamp(now)

  const byDay = new Map<string, Session[]>()
  for (const s of sessions) {
    if (s.status !== 'done') continue
    byDay.set(s.date, [...(byDay.get(s.date) ?? []), s].sort((a, b) => a.startedAt.localeCompare(b.startedAt)))
  }
  const activitiesOn = (day: string) => activities.filter((a) => a.date === day).map((a) => a.type)
  const recordsOn = (day: string) => (byDay.get(day) ?? []).flatMap((s) => records.get(s.id) ?? [])

  const changeMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  const onPointerDown = (e: PointerEvent) => {
    swipeStart.current = e.clientX
  }
  const onPointerUp = (e: PointerEvent) => {
    if (swipeStart.current === null) return
    const dx = e.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(dx) > SWIPE_PX) changeMonth(dx < 0 ? 1 : -1)
  }

  const title = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="card calendar-card">
      <div className="calendar-head">
        <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Mois précédent">
          <ChevronLeftIcon />
        </button>
        <span className="calendar-title">{title}</span>
        <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Mois suivant">
          <ChevronRightIcon />
        </button>
      </div>

      <div className="calendar-grid" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipeStart.current = null)}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="calendar-weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {weeks.map((days) => {
          const deload = days.some((d) => inDeload(deloadPeriods, localDateStamp(d)))
          return days.map((date, i) => {
            const day = localDateStamp(date)
            const inMonth = date.getMonth() === month.getMonth()
            const daySessions = byDay.get(day) ?? []
            const dayActivities = activitiesOn(day)
            const future = day > today
            const hasRecord = recordsOn(day).length > 0
            const label = [
              date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
              ...daySessions.map((s) => TEMPLATE_NAMES[s.templateId]),
              ...dayActivities.map((a) => (a === 'foot' ? 'foot' : 'tennis')),
              deload ? 'semaine allégée' : '',
              hasRecord ? 'record battu' : '',
            ]
              .filter(Boolean)
              .join(', ')
            return (
              <button
                key={day}
                className={[
                  'calendar-day',
                  inMonth ? '' : 'outside',
                  day === today ? 'today' : '',
                  deload ? 'deload' : '',
                  i === 0 ? 'week-start' : '',
                  i === 6 ? 'week-end' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={future}
                onClick={() => setOpened(day)}
                aria-label={label}
              >
                <span className="calendar-number">{date.getDate()}</span>
                {hasRecord && (
                  <span className="calendar-star" aria-hidden="true">
                    ★
                  </span>
                )}
                <span className="calendar-marks" aria-hidden="true">
                  {daySessions.map((s) => (
                    <span key={s.id} className={`calendar-dot tpl-${s.templateId}`} />
                  ))}
                  {dayActivities.map((a) => (
                    <span key={a} className={`calendar-activity ${a}`} />
                  ))}
                </span>
              </button>
            )
          })
        })}
      </div>

      <div className="calendar-legend" aria-hidden="true">
        {LEGEND.map((l) => (
          <span key={l.id}>
            <span className={`calendar-dot tpl-${l.id}`} /> {l.label}
          </span>
        ))}
        <span>
          <span className="calendar-activity foot" /> Foot
        </span>
        <span>
          <span className="calendar-activity tennis" /> Tennis
        </span>
        <span>
          <span className="legend-deload" /> Semaine allégée
        </span>
        <span>
          <span className="calendar-star legend-star">★</span> Record
        </span>
      </div>

      {monthKey(month) <= monthKey(now) && (
        <Link className="calendar-review" to={`/progres/bilan/${monthKey(month)}`}>
          Bilan {ofMonth(monthKey(month))}
          {monthKey(month) === monthKey(now) && <span className="muted small"> · en cours</span>}
          <ChevronRightIcon />
        </Link>
      )}

      {opened && (
        <DaySheet
          day={opened}
          sessions={byDay.get(opened) ?? []}
          activities={activitiesOn(opened)}
          records={recordsOn(opened)}
          exerciseName={exerciseName}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}

function DaySheet(props: {
  day: string
  sessions: Session[]
  activities: ActivityType[]
  records: SessionRecord[]
  exerciseName: (id: string) => string
  onClose: () => void
}) {
  const date = new Date(`${props.day}T12:00:00`)
  const title = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <Sheet open onClose={props.onClose} title={title.charAt(0).toUpperCase() + title.slice(1)}>
      {props.sessions.length > 0 ? (
        <div className="card list-card day-sessions">
          {props.sessions.map((s) => {
            const stats = sessionStats(s)
            return (
              <Link key={s.id} to={`/progres/seance/${s.id}`} className="list-row history-row">
                <span className="history-text">
                  <span className="history-name">
                    <span className={`calendar-dot tpl-${s.templateId}`} /> {TEMPLATE_NAMES[s.templateId]}
                    {s.deload && <span className="muted small"> · allégée</span>}
                  </span>
                  <span className="muted small">
                    {formatDuration(stats.durationMs)} · {stats.setCount} série{stats.setCount > 1 ? 's' : ''}
                  </span>
                </span>
                <ChevronRightIcon />
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="muted">Pas de séance de muscu ce jour-là.</p>
      )}
      {props.records.length > 0 && (
        <div className="day-records">
          <span className="day-records-title">★ Records battus</span>
          {props.records.flatMap(({ exerciseId, records }) =>
            records.map((r) => (
              <span key={`${exerciseId}|${r.kind}`} className="small">
                {props.exerciseName(exerciseId)} · {RECORD_LABELS[r.kind]} : <strong>{formatRecord(r).value}</strong>
              </span>
            )),
          )}
        </div>
      )}
      <div className="activity-toggles">
        {ACTIVITIES.map(({ type, label }) => {
          const on = props.activities.includes(type)
          return (
            <button
              key={type}
              role="switch"
              aria-checked={on}
              className={on ? 'activity-toggle on' : 'activity-toggle'}
              onClick={() => toggleActivity(props.day, type)}
            >
              <span className={`calendar-activity ${type}`} aria-hidden="true" />
              {label}
              <span className="activity-state">{on ? 'oui' : 'non'}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
