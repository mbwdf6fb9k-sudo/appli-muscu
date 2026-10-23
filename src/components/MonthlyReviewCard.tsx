import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { setSetting, useSettings } from '../db/settings'
import { monthKey, ofMonth, previousMonth } from '../lib/monthlyReview'
import { CalendarIcon, CloseIcon } from './icons'

/** Jours du mois pendant lesquels le bilan du mois précédent est proposé. */
export const REVIEW_CARD_DAYS = 7

/** « Ton bilan d'octobre est prêt » : les 7 premiers jours du mois, tant qu'il n'est ni vu ni fermé. */
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
  if (now.getDate() > REVIEW_CARD_DAYS || count === 0 || settings.monthlyReviewSeen === month) return null

  const dismiss = () => setSetting('monthlyReviewSeen', month)

  return (
    <div className="card deload-card review-card">
      <span className="deload-icon">
        <CalendarIcon />
      </span>
      <span className="deload-text">
        <span className="deload-title">Ton bilan {ofMonth(month)} est prêt</span>
        <span className="muted small">Séances, records, ce qui progresse le plus et l’évolution de ton corps.</span>
        <span className="deload-actions">
          <Link className="btn btn-primary btn-small" to={`/progres/bilan/${month}`} onClick={dismiss}>
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
