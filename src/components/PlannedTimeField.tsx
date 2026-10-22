import { setPlannedTime } from '../db/days'
import { CloseIcon } from './icons'

/** « J'y vais vers… » : heure prévue de la séance (sert aux compléments d'avant-séance). */
export function PlannedTimeField({ date, value }: { date: string; value: string | undefined }) {
  return (
    <div className="card time-field">
      <label htmlFor="planned-time">J’y vais vers…</label>
      <div className="time-field-input">
        <span className="time-input-wrap">
          <input
            id="planned-time"
            type="time"
            value={value ?? ''}
            onChange={(e) => setPlannedTime(date, e.target.value || null)}
          />
          {/* Un champ heure vide n'affiche rien sur iPhone */}
          {!value && <span className="time-placeholder">Choisir</span>}
        </span>
        {value && (
          <button className="icon-btn icon-btn-small" aria-label="Effacer l’heure" onClick={() => setPlannedTime(date, null)}>
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  )
}
