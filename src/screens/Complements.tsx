import { Link } from 'react-router-dom'
import { CheckIcon, ChevronRightIcon } from '../components/icons'
import { PlannedTimeField } from '../components/PlannedTimeField'
import { Screen, SettingsLink } from '../components/Screen'
import { useDay } from '../db/days'
import { TEMPLATE_NAMES } from '../db/seed'
import { useActiveSession, useDoneSessionsOn } from '../db/sessions'
import { toggleIntake, useIntakes, useSupplements } from '../db/supplements'
import { localDateStamp } from '../lib/dates'
import { buildSchedule, dayType, formatHour, isLateSession, MOMENTS } from '../lib/supplements'
import { useNow } from '../lib/useNow'

export function Complements() {
  const now = useNow(60_000)
  const today = localDateStamp(now)
  const day = useDay(today)
  const active = useActiveSession()
  const done = useDoneSessionsOn(today)
  const supplements = useSupplements()
  const taken = useIntakes(today)

  if (day === undefined || active === undefined || !done || !supplements || !taken) return null

  const sessionsToday = [...(active && active.date === today ? [active] : []), ...done]
  const { type, templateId } = dayType(day, sessionsToday)
  const plannedTime = type === 'training' ? day?.plannedTime : undefined
  const schedule = buildSchedule(supplements, type, plannedTime)
  const items = schedule.flatMap((g) => g.items)
  const takenCount = items.filter((s) => taken.has(s.id)).length
  const late = type === 'training' && isLateSession(plannedTime)

  return (
    <Screen title="Compléments" trailing={<SettingsLink />}>
      <div className="card day-card">
        <div className="day-card-head">
          <span className="day-text">
            <span className="day-type">{type === 'training' ? 'Jour d’entraînement' : 'Jour de repos'}</span>
            {templateId && <span className="muted small">{TEMPLATE_NAMES[templateId]}</span>}
          </span>
          <Link to="/" className="day-change">
            Changer
          </Link>
        </div>
        {items.length > 0 && (
          <div className="intake-progress">
            <span className="small">
              {takenCount === items.length
                ? 'Tout est pris aujourd’hui ✓'
                : `${takenCount} / ${items.length} pris aujourd’hui`}
            </span>
            <span className="progress-track">
              <span className="progress-fill" style={{ width: `${(takenCount / items.length) * 100}%` }} />
            </span>
          </div>
        )}
      </div>

      {type === 'training' && day && day.choice !== 'repos' && (
        <div className="supp-time">
          <PlannedTimeField date={today} value={day.plannedTime} />
        </div>
      )}

      {schedule.map((group) => (
        <section key={group.moment}>
          <h2 className="section-title moment-title">
            {group.time && <span className="moment-time">{formatHour(group.time)}</span>}
            {group.label}
          </h2>
          <div className="card supp-list">
            {group.items.map((s) => {
              const checked = taken.has(s.id)
              return (
                <div key={s.id} className="supp-item">
                  <button
                    role="checkbox"
                    aria-checked={checked}
                    className={checked ? 'supp-row checked' : 'supp-row'}
                    onClick={() => toggleIntake(today, s.id)}
                  >
                    <span className="supp-box">{checked && <CheckIcon />}</span>
                    <span className="supp-text">
                      <span className="supp-name">
                        {s.name}
                        {s.dose && <span className="muted"> ({s.dose})</span>}
                      </span>
                      {s.note && <span className="supp-note">{s.note}</span>}
                    </span>
                  </button>
                  {s.caffeine && late && MOMENTS[group.moment].session && (
                    <p className="supp-warning" role="note">
                      Séance après 18 h : le {s.name.toLowerCase()} contient souvent de la caféine, ce qui peut gêner le
                      sommeil.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {schedule.length === 0 && <p className="muted hint">Aucun complément prévu pour ce type de journée.</p>}

      <Link to="/complements/liste" className="btn btn-secondary supp-manage">
        Modifier la liste <ChevronRightIcon />
      </Link>
    </Screen>
  )
}
