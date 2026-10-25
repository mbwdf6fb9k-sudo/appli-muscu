import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { setSetting, useSettings } from '../db/settings'
import { monthKey, ofMonth, previousMonth } from '../lib/monthlyReview'
import { CalendarIcon, CloseIcon } from './icons'

/** « Bilan d'octobre » : à partir du 1er du mois suivant, jusqu'à ce qu'on ferme la carte (pas de carte sans séance). */
export function MonthlyReviewCard({ now }: { now: Date }) {
  const settings = useSettings()
  const month = previousMonth(monthKey(now))
  const count = useLiveQuery(
    () =>
      db.sessions
        .where('date')
        .between(`${month}-01`, `${month}-31`, true, true)
        .filter((s) => s.status === 'done')
        .count(),
    [month],
  )
  if (!settings || count === undefined) return null
  if (count === 0 || settings.monthlyReviewSeen === month) return null

  const dismiss = () => setSetting('monthlyReviewSeen', month)

  return (
    <div className="card deload-card review-card">
      <span className="deload-icon">
        <CalendarIcon />
      </span>
      <span className="deload-text">
        <span className="deload-title">Bilan {ofMonth(month)}</span>
        <span className="muted small">Séances, records, ce qui progresse le plus et l’évolution de ton corps.</span>
        <span className="deload-actions">
          <Link className="btn btn-primary btn-small" to={`/progres/bilan/${month}`}>
            Voir
          </Link>
        </span>
      </span>
      <button className="icon-btn icon-btn-small review-card-close" onClick={dismiss} aria-label="Fermer">
        <CloseIcon />
      </button>
    </div>
  )
}
