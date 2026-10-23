import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackupBanner } from '../components/BackupBanner'
import { DeloadCard } from '../components/DeloadCard'
import { CheckIcon, ChevronRightIcon } from '../components/icons'
import { PlannedTimeField } from '../components/PlannedTimeField'
import { Screen, SettingsLink } from '../components/Screen'
import type { DayChoice, Session } from '../db/database'
import { setDayChoice, useDay } from '../db/days'
import { useTemplates } from '../db/exercises'
import { SESSION_TEMPLATE_IDS, TEMPLATE_NAMES } from '../db/seed'
import { startSession, useActiveSession, useDoneSessionsOn, useLastDoneDates } from '../db/sessions'
import { daysSince, formatDaysAgo, formatLongDate, localDateStamp } from '../lib/dates'
import { formatDuration, formatTime } from '../lib/format'
import { sessionStats } from '../lib/sessionStats'
import { useNow } from '../lib/useNow'

export function Aujourdhui() {
  const navigate = useNavigate()
  const now = useNow()
  const today = localDateStamp(now)
  const day = useDay(today)
  const active = useActiveSession()
  const doneToday = useDoneSessionsOn(today)
  const lastDone = useLastDoneDates()
  const templates = useTemplates()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const doneYesterday = useDoneSessionsOn(localDateStamp(yesterday))
  const [starting, setStarting] = useState(false)

  const choice = day?.choice ?? null
  const loading = day === undefined || active === undefined || doneToday === undefined

  async function handleStart() {
    if (!choice || choice === 'repos') return
    setStarting(true)
    try {
      await startSession(choice)
      navigate('/seance')
    } finally {
      setStarting(false)
    }
  }

  const toggle = (value: DayChoice) => setDayChoice(today, choice === value ? null : value)

  return (
    <Screen title="Aujourd’hui" subtitle={formatLongDate(now)} trailing={<SettingsLink />}>
      <BackupBanner />
      <DeloadCard now={now} />
      {loading ? null : active ? (
        <ActiveSessionCard session={active} now={now} />
      ) : (
        <>
          {doneToday.map((session) => (
            <DoneSessionCard key={session.id} session={session} />
          ))}

          <h2 className="section-title">
            {doneToday.length > 0 ? 'Encore une séance ?' : 'Qu’est-ce que tu fais aujourd’hui ?'}
          </h2>
          <div className="choice-list" role="radiogroup" aria-label="Séance du jour">
            {SESSION_TEMPLATE_IDS.map((id) => {
              const last = lastDone?.[id]
              const duration = templates?.find((t) => t.id === id)?.duration
              return (
                <ChoiceCard
                  key={id}
                  label={TEMPLATE_NAMES[id]}
                  detail={`${last ? `faite ${formatDaysAgo(daysSince(last, now))}` : 'jamais faite'}${duration ? ` · ${duration}` : ''}`}
                  selected={choice === id}
                  onSelect={() => toggle(id)}
                />
              )
            })}
            <ChoiceCard
              label="Repos"
              detail="récupération"
              selected={choice === 'repos'}
              onSelect={() => toggle('repos')}
            />
          </div>

          {choice && choice !== 'repos' && (
            <div className="today-start">
              <PlacementHints
                placement={templates?.find((t) => t.id === choice)?.placement}
                // Bras : à éviter le lendemain de Dos-Biceps ou Pecs-Triceps
                warning={
                  choice === 'bras'
                    ? doneYesterday?.find((d) => d.templateId === 'dos-biceps' || d.templateId === 'pecs-triceps')
                    : undefined
                }
              />
              <PlannedTimeField date={today} value={day?.plannedTime} />
              <button className="btn btn-primary btn-large" onClick={handleStart} disabled={starting}>
                Commencer la séance
              </button>
            </div>
          )}

          {!choice && doneToday.length === 0 && (
            <p className="muted small hint">Sans choix, la journée compte comme un jour de repos.</p>
          )}
        </>
      )}
    </Screen>
  )
}

function PlacementHints({ placement, warning }: { placement?: string; warning?: Session }) {
  if (warning) {
    return (
      <p className="hint-chip hint-warning" role="note">
        Tu as fait {TEMPLATE_NAMES[warning.templateId]} hier : le programme conseille d’éviter Bras + épaules le
        lendemain.
      </p>
    )
  }
  return placement ? <p className="hint-chip">{placement}</p> : null
}

function ChoiceCard(props: { label: string; detail: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      role="radio"
      aria-checked={props.selected}
      className={props.selected ? 'choice-card selected' : 'choice-card'}
      onClick={props.onSelect}
    >
      <span className="choice-text">
        <span className="choice-label">{props.label}</span>
        <span className="choice-detail">{props.detail}</span>
      </span>
      <span className="choice-radio">{props.selected && <CheckIcon />}</span>
    </button>
  )
}

function ActiveSessionCard({ session, now }: { session: Session; now: Date }) {
  const stats = sessionStats(session, now)
  return (
    <Link to="/seance" className="card hero-card">
      <span className="hero-eyebrow">
        <span className="live-dot" /> Séance en cours
      </span>
      <span className="hero-title">{TEMPLATE_NAMES[session.templateId]}</span>
      <span className="muted">
        Commencée à {formatTime(new Date(session.startedAt))} · {formatDuration(stats.durationMs)} ·{' '}
        {stats.setCount} série{stats.setCount > 1 ? 's' : ''}
      </span>
      <span className="btn btn-primary hero-btn">Reprendre</span>
    </Link>
  )
}

function DoneSessionCard({ session }: { session: Session }) {
  const stats = sessionStats(session)
  return (
    <Link to={`/progres/seance/${session.id}`} className="card done-card">
      <span className="done-check">
        <CheckIcon />
      </span>
      <span className="done-text">
        <span className="done-title">{TEMPLATE_NAMES[session.templateId]} faite</span>
        <span className="muted small">
          {formatDuration(stats.durationMs)} · {stats.setCount} série{stats.setCount > 1 ? 's' : ''}
        </span>
      </span>
      <ChevronRightIcon />
    </Link>
  )
}
