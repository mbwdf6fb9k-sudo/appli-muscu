import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart } from '../components/charts/BarChart'
import { ComingSoon } from '../components/ComingSoon'
import { ChevronRightIcon, ProgressIcon, TrophyIcon } from '../components/icons'
import { MuscleVolume } from '../components/MuscleVolume'
import { ProgressBoard } from '../components/ProgressBoard'
import { RegularityCalendar } from '../components/RegularityCalendar'
import { Screen, SettingsLink } from '../components/Screen'
import type { Session } from '../db/database'
import { unclassified, useExercisesById } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import { useDoneSessions } from '../db/sessions'
import { useSettings, type DeloadPeriod } from '../db/settings'
import { useWeighIns } from '../db/weighIns'
import { formatDuration, formatNumber, formatShortDate } from '../lib/format'
import { recordSessionIds, sessionRecords, weeklyAverage, weeklyCounts } from '../lib/progress'
import { currentBodyweight, progressBoard, type BoardPeriod } from '../lib/progressBoard'
import { sessionStats } from '../lib/sessionStats'
import { bestStreak, currentStreak, sessionCounts } from '../lib/streak'
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

const PERIOD_KEY = 'appli-muscu-tableau-periode'

function readPeriod(): BoardPeriod {
  try {
    const saved = localStorage.getItem(PERIOD_KEY)
    return saved === '3m' || saved === 'all' ? saved : '4w'
  } catch {
    return '4w'
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

export function Progres() {
  const sessions = useDoneSessions()
  const exercisesById = useExercisesById()
  const settings = useSettings()
  const now = useNow(60_000)
  const [view, setViewState] = useState<View>(readView)
  const [period, setPeriodState] = useState<BoardPeriod>(readPeriod)
  const weighIns = useWeighIns()
  const setPeriod = (next: BoardPeriod) => {
    setPeriodState(next)
    try {
      localStorage.setItem(PERIOD_KEY, next)
    } catch {
      // pas grave : on reviendra sur 4 semaines
    }
  }

  const setView = (next: View) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // pas grave : on reviendra sur l'historique
    }
  }

  if (!sessions || !exercisesById || !settings || !weighIns) return null
  const bodyweight = currentBodyweight(weighIns, settings.startWeight)

  // Tout en haut : exercices à classer, compteurs, série de semaines et calendrier de régularité
  const toClassify = unclassified([...exercisesById.values()]).length
  const regularity = (
    <>
      {toClassify > 0 && (
        <Link to="/reglages/exercices" className="hint-chip classify-banner">
          {toClassify} exercice{toClassify > 1 ? 's' : ''} sans muscle : à classer
          <ChevronRightIcon />
        </Link>
      )}
      <Regularity
        sessions={sessions}
        deloadPeriods={settings.deloadPeriods}
        now={now}
        exerciseName={(id) => exercisesById.get(id)?.name ?? 'Exercice supprimé'}
      />
    </>
  )

  if (sessions.length === 0) {
    return (
      <Screen title="Progrès" trailing={<SettingsLink />}>
        {regularity}
        <ComingSoon icon={<ProgressIcon />} title="Ta première séance apparaîtra ici">
          Termine une séance depuis l’onglet Aujourd’hui : ton historique, tes records et tes courbes se rempliront
          au fil des semaines.
        </ComingSoon>
      </Screen>
    )
  }

  const weeks = weeklyCounts(sessions, now)
  const thisWeek = weeks.at(-1)!.count
  const average = weeklyAverage(sessions, now)

  return (
    <Screen title="Progrès" trailing={<SettingsLink />}>
      {regularity}
      <div className="card week-card">
        <div className="week-head">
          <div>
            <span className="week-value">{thisWeek}</span>
            <span className="week-label">{thisWeek > 1 ? 'séances cette semaine' : 'séance cette semaine'}</span>
          </div>
          {average && (
            <span className="muted small week-average">
              moyenne {formatNumber(Math.round(average.average * 10) / 10)} / semaine
              <br />
              sur {average.weeks} semaines
            </span>
          )}
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

      <MuscleVolume
        sessions={sessions}
        exercisesById={exercisesById}
        now={now}
        board={progressBoard(sessions, exercisesById, '4w', now, bodyweight)}
      />

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
        <ProgressBoard
          board={progressBoard(sessions, exercisesById, period, now, bodyweight)}
          period={period}
          onPeriod={setPeriod}
          exercisesById={exercisesById}
        />
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

function Regularity(props: { sessions: Session[]; deloadPeriods: DeloadPeriod[]; now: Date; exerciseName: (id: string) => string }) {
  const { week, month } = sessionCounts(props.sessions, props.now)
  const streak = currentStreak(props.sessions, props.now)
  const best = bestStreak(props.sessions, props.now)
  return (
    <>
      <div className="regularity-counters">
        <p className="regularity-main">
          <strong>{plural(week, 'séance')}</strong> cette semaine · <strong>{month}</strong> ce mois-ci
        </p>
        <p className="muted small">
          Série : {plural(streak, 'semaine')} d’affilée à 3 séances ou plus · meilleure : {best}
        </p>
      </div>
      <RegularityCalendar
        sessions={props.sessions}
        deloadPeriods={props.deloadPeriods}
        now={props.now}
        records={sessionRecords(props.sessions)}
        exerciseName={props.exerciseName}
      />
    </>
  )
}
