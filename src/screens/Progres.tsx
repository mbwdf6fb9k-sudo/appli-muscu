import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart } from '../components/charts/BarChart'
import { ComingSoon } from '../components/ComingSoon'
import { ChevronRightIcon, ProgressIcon, TrophyIcon } from '../components/icons'
import { Screen, SettingsLink } from '../components/Screen'
import type { Exercise, Session } from '../db/database'
import { useExercisesById } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import { useDoneSessions } from '../db/sessions'
import { daysSince, formatDaysAgo } from '../lib/dates'
import { formatDuration, formatNumber, formatShortDate } from '../lib/format'
import { exerciseSummaries, recordSessionIds, weeklyCounts } from '../lib/progress'
import { formatBests } from '../lib/records'
import { sessionStats } from '../lib/sessionStats'
import { useNow } from '../lib/useNow'

type View = 'historique' | 'exercices'
const VIEW_KEY = 'appli-muscu-progres-vue'

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'exercices' ? 'exercices' : 'historique'
  } catch {
    return 'historique'
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

export function Progres() {
  const sessions = useDoneSessions()
  const exercisesById = useExercisesById()
  const now = useNow(60_000)
  const [view, setViewState] = useState<View>(readView)

  const setView = (next: View) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // pas grave : on reviendra sur l'historique
    }
  }

  if (!sessions || !exercisesById) return null

  if (sessions.length === 0) {
    return (
      <Screen title="Progrès" trailing={<SettingsLink />}>
        <ComingSoon icon={<ProgressIcon />} title="Ta première séance apparaîtra ici">
          Termine une séance depuis l’onglet Aujourd’hui : ton historique, tes records et tes courbes se rempliront
          au fil des semaines.
        </ComingSoon>
      </Screen>
    )
  }

  const weeks = weeklyCounts(sessions, now)
  const thisWeek = weeks.at(-1)!.count
  const average = weeks.reduce((n, w) => n + w.count, 0) / weeks.length

  return (
    <Screen title="Progrès" trailing={<SettingsLink />}>
      <div className="card week-card">
        <div className="week-head">
          <div>
            <span className="week-value">{thisWeek}</span>
            <span className="week-label">{thisWeek > 1 ? 'séances cette semaine' : 'séance cette semaine'}</span>
          </div>
          <span className="muted small week-average">
            moyenne {formatNumber(Math.round(average * 10) / 10)} / semaine
            <br />
            sur 12 semaines
          </span>
        </div>
        <BarChart
          bars={weeks.map((w) => ({
            label: formatShortDate(w.start),
            detail: `Semaine du ${formatShortDate(w.start)}`,
            value: w.count,
          }))}
          unit={(n) => plural(n, 'séance')}
        />
      </div>

      <div className="segmented progress-switch" role="group" aria-label="Affichage">
        <button aria-pressed={view === 'historique'} onClick={() => setView('historique')}>
          Historique
        </button>
        <button aria-pressed={view === 'exercices'} onClick={() => setView('exercices')}>
          Exercices
        </button>
      </div>

      {view === 'historique' ? (
        <History sessions={sessions} />
      ) : (
        <ExerciseList sessions={sessions} exercisesById={exercisesById} now={now} />
      )}
    </Screen>
  )
}

function History({ sessions }: { sessions: Session[] }) {
  const withRecords = recordSessionIds(sessions)
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const months = new Map<string, Session[]>()
  for (const session of sorted) {
    const date = new Date(session.startedAt)
    const key = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    months.set(key, [...(months.get(key) ?? []), session])
  }

  return (
    <>
      {[...months.entries()].map(([month, list]) => (
        <section key={month}>
          <h2 className="section-title month-title">{month}</h2>
          <div className="card list-card">
            {list.map((session) => {
              const stats = sessionStats(session)
              const date = new Date(session.startedAt)
              return (
                <Link key={session.id} to={`/progres/seance/${session.id}`} className="list-row history-row">
                  <span className="history-text">
                    <span className="history-name">{TEMPLATE_NAMES[session.templateId]}</span>
                    <span className="muted small">
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                      {formatDuration(stats.durationMs)} · {plural(stats.setCount, 'série')}
                    </span>
                  </span>
                  <span className="list-row-end">
                    {withRecords.has(session.id) && (
                      <span className="trophy-badge" aria-label="Record battu">
                        <TrophyIcon />
                      </span>
                    )}
                    <ChevronRightIcon />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

function ExerciseList(props: { sessions: Session[]; exercisesById: Map<string, Exercise>; now: Date }) {
  const summaries = exerciseSummaries(props.sessions)
  return (
    <>
      <h2 className="section-title">{plural(summaries.length, 'exercice')} déjà fait{summaries.length > 1 ? 's' : ''}</h2>
      <div className="card list-card">
        {summaries.map((summary) => (
          <Link key={summary.exerciseId} to={`/progres/exercice/${summary.exerciseId}`} className="list-row history-row">
            <span className="history-text">
              <span className="history-name">{props.exercisesById.get(summary.exerciseId)?.name ?? 'Exercice supprimé'}</span>
              <span className="muted small">
                {formatBests(summary.type, summary.bests)}
                {formatBests(summary.type, summary.bests) && ' · '}
                {formatDaysAgo(daysSince(summary.lastDate, props.now))}
              </span>
            </span>
            <ChevronRightIcon />
          </Link>
        ))}
      </div>
    </>
  )
}
