import { useDoneSessions } from '../db/sessions'
import { setSetting, useSettings } from '../db/settings'
import { localDateStamp } from '../lib/dates'
import { activeDeload, deloadSuggestion, snoozeDeload, startDeload, stopDeload } from '../lib/deload'
import { stagnatingExercises } from '../lib/stagnation'
import { MoonIcon } from './icons'

const dayLabel = (stamp: string) =>
  new Date(`${stamp}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Semaine allégée : suggestion (Activer / Plus tard) ou semaine en cours (Arrêter). */
export function DeloadCard({ now }: { now: Date }) {
  const settings = useSettings()
  const sessions = useDoneSessions()
  if (!settings || !sessions) return null

  const today = localDateStamp(now)
  const periods = settings.deloadPeriods
  const active = activeDeload(periods, today)

  if (active) {
    return (
      <div className="card deload-card active">
        <span className="deload-icon">
          <MoonIcon />
        </span>
        <span className="deload-text">
          <span className="deload-title">Semaine allégée en cours</span>
          <span className="muted small">
            Jusqu’au {dayLabel(active.end)} : moitié moins de séries, mêmes charges, 3-4 reps en réserve.
          </span>
          <button className="btn btn-ghost btn-small deload-stop" onClick={() => setSetting('deloadPeriods', stopDeload(periods, today))}>
            Arrêter la semaine allégée
          </button>
        </span>
      </div>
    )
  }

  const stagnating = stagnatingExercises(sessions).size
  const reason = deloadSuggestion({
    periods,
    snoozedUntil: settings.deloadSnoozedUntil,
    featureStartAt: settings.featureStartAt,
    sessions,
    stagnating,
    now,
  })
  if (!reason) return null

  return (
    <div className="card deload-card">
      <span className="deload-icon">
        <MoonIcon />
      </span>
      <span className="deload-text">
        <span className="deload-title">Une semaine allégée ?</span>
        <span className="muted small">
          {reason === 'stagnation'
            ? `${stagnating} exercices stagnent : une semaine plus légère aide souvent à repartir.`
            : '6 semaines d’entraînement : une semaine plus légère aide à récupérer et à progresser ensuite.'}{' '}
          Pendant 7 jours : moitié moins de séries, mêmes charges.
        </span>
        <span className="deload-actions">
          <button className="btn btn-primary btn-small" onClick={() => setSetting('deloadPeriods', startDeload(periods, today))}>
            Activer
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setSetting('deloadSnoozedUntil', snoozeDeload(now))}>
            Plus tard
          </button>
        </span>
      </span>
    </div>
  )
}
