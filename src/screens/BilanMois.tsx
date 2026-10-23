import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon, TrophyIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { useActivities } from '../db/activities'
import { useExercisesById } from '../db/exercises'
import { useMeasurements } from '../db/measurements'
import { usePhotos } from '../db/photos'
import { TEMPLATE_NAMES } from '../db/seed'
import { useDoneSessions } from '../db/sessions'
import { setSetting, useSettings } from '../db/settings'
import { useWeighIns } from '../db/weighIns'
import { formatDuration, formatNumber, formatVolume } from '../lib/format'
import { MEASURES } from '../lib/measurements'
import { monthKey, monthLabel, monthlyReview, ofMonth, previousMonth } from '../lib/monthlyReview'
import { MUSCLE_LABELS, MUSCLE_ORDER } from '../lib/muscleVolume'
import { formatRecordValue, RECORD_LABELS } from '../lib/records'
import { useNow } from '../lib/useNow'

const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n > 1 ? 's' : ''}`
const signed = (value: number, unit: string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatNumber(Math.abs(Math.round(value * 10) / 10))}${unit}`
const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Bilan d'un mois (« 2026-10 »), calculé à partir des données existantes. */
export function BilanMois() {
  const { mois = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const now = useNow(60_000)
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(mois) && mois <= monthKey(now)

  const sessions = useDoneSessions()
  const exercisesById = useExercisesById()
  const activities = useActivities(`${mois}-01`, `${mois}-31`)
  const weighIns = useWeighIns()
  const measurements = useMeasurements()
  const photos = usePhotos()
  const settings = useSettings()

  // Ouvrir le bilan du mois dernier fait disparaître sa carte sur Aujourd'hui
  const lastMonth = previousMonth(monthKey(now))
  const seen = settings?.monthlyReviewSeen
  useEffect(() => {
    if (valid && settings && mois === lastMonth && seen !== mois) void setSetting('monthlyReviewSeen', mois)
  }, [valid, settings, mois, lastMonth, seen])

  if (!valid) return <Navigate to="/progres" replace />
  if (!sessions || !exercisesById || !activities || !weighIns || !measurements || !photos || !settings) return null

  const review = monthlyReview(mois, {
    sessions,
    exercisesById,
    activities,
    weighIns,
    measurements,
    photos,
    deloadPeriods: settings.deloadPeriods,
  })
  const current = mois === monthKey(now)
  const name = (id: string) => exercisesById.get(id)?.name ?? 'Exercice supprimé'
  const back = () => (location.key === 'default' ? navigate('/progres') : navigate(-1))
  const diff = review.sessions - review.previousSessions
  const previousName = monthLabel(previousMonth(mois)).split(' ')[0]
  const muscles = [...MUSCLE_ORDER, 'autre' as const]
    .map((m) => ({ muscle: m, count: review.muscles.get(m) ?? 0 }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <Screen
      title={`Bilan ${ofMonth(mois)}`}
      subtitle={current ? `${monthLabel(mois)} · en cours` : monthLabel(mois)}
      leading={
        <button className="icon-btn icon-btn-back" onClick={back} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{review.sessions}</span>
          <span className="stat-label">séance{review.sessions > 1 ? 's' : ''}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatNumber(review.workSets)}</span>
          <span className="stat-label">séries de travail</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatVolume(review.volume)}</span>
          <span className="stat-label">volume</span>
        </div>
      </div>

      {(review.sessions > 0 || review.previousSessions > 0) && (
        <p className="muted small hint">
          {diff === 0 ? 'Autant' : diff > 0 ? `${diff} de plus` : `${-diff} de moins`} qu’en {previousName}
          {current ? ' (mois en cours)' : ''}.
        </p>
      )}

      {review.sessions === 0 ? (
        <p className="muted hint">Pas de séance ce mois-ci.</p>
      ) : (
        <>
          <h2 className="section-title">Régularité</h2>
          <div className="card list-card">
            {review.byTemplate.map((t) => (
              <div key={t.templateId} className="list-row review-row">
                <span>
                  <span className={`calendar-dot tpl-${t.templateId}`} aria-hidden="true" /> {TEMPLATE_NAMES[t.templateId]}
                </span>
                <span className="muted">{t.count}</span>
              </div>
            ))}
            <div className="list-row review-row">
              <span>Semaines à 3 séances ou plus</span>
              <span className="muted">
                {review.weeksAtTarget} / {review.weeks}
              </span>
            </div>
            <div className="list-row review-row">
              <span>Temps à la salle</span>
              <span className="muted">{formatDuration(review.durationMs)}</span>
            </div>
            {(review.foot > 0 || review.tennis > 0) && (
              <div className="list-row review-row">
                <span>Foot · Tennis</span>
                <span className="muted">
                  {plural(review.foot, 'jour')} · {plural(review.tennis, 'jour')}
                </span>
              </div>
            )}
            {review.deloadDays > 0 && (
              <div className="list-row review-row">
                <span>Semaine allégée</span>
                <span className="muted">{plural(review.deloadDays, 'jour')}</span>
              </div>
            )}
          </div>

          <h2 className="section-title">Records battus ({review.records.length})</h2>
          {review.records.length === 0 ? (
            <p className="muted hint">Aucun record ce mois-ci : la régularité finit toujours par payer.</p>
          ) : (
            <div className="card list-card">
              {[...new Set(review.records.map((r) => r.exerciseId))].map((id) => (
                <div key={id} className="list-row review-row">
                  <span className="review-record">
                    <span className="trophy-badge" aria-hidden="true">
                      <TrophyIcon />
                    </span>
                    <span>
                      {name(id)}
                      <span className="muted small review-sub">
                        {review.records
                          .filter((r) => r.exerciseId === id)
                          .map((r) => `${RECORD_LABELS[r.kind]} ${formatRecordValue(r.kind, r.value)}`)
                          .join(' · ')}
                      </span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {review.progress.length > 0 && (
            <>
              <h2 className="section-title">Ce qui progresse le plus</h2>
              <div className="card list-card">
                {review.progress.map((p) => (
                  <div key={p.exerciseId} className="list-row review-row">
                    <span>
                      {name(p.exerciseId)}
                      <span className="muted small review-sub">
                        {RECORD_LABELS[p.kind]} : {formatRecordValue(p.kind, p.before)} → {formatRecordValue(p.kind, p.after)}
                      </span>
                    </span>
                    <span className="review-value">+{formatNumber(Math.round(p.gain * 100))} %</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="section-title">Séries par muscle</h2>
          <div className="card review-muscles">
            {muscles.map((m) => (
              <span key={m.muscle}>
                {MUSCLE_LABELS[m.muscle]} <strong>{m.count}</strong>
              </span>
            ))}
          </div>
        </>
      )}

      {(review.weight || review.measurement || review.photos.length > 0) && (
        <>
          <h2 className="section-title">Corps</h2>
          <div className="card list-card">
            {review.weight && (
              <div className="list-row review-row">
                <span>
                  Poids (moyenne 7 jours)
                  <span className="muted small review-sub">
                    {formatNumber(review.weight.start)} → {formatNumber(review.weight.end)} kg
                  </span>
                </span>
                <span className="review-value">{signed(review.weight.end - review.weight.start, ' kg')}</span>
              </div>
            )}
            {review.measurement &&
              MEASURES.filter((m) => review.measurement!.latest[m.key] !== undefined).map((m) => {
                const value = review.measurement!.latest[m.key]!
                const before = review.measurement!.previous?.[m.key]
                return (
                  <div key={m.key} className="list-row review-row">
                    <span>
                      {m.label}
                      <span className="muted small review-sub">
                        {before !== undefined
                          ? `${formatNumber(before)} → ${formatNumber(value)} cm (depuis le ${dayLabel(review.measurement!.previous!.date)})`
                          : `${formatNumber(value)} cm (première mesure)`}
                      </span>
                    </span>
                    {before !== undefined && <span className="review-value">{signed(value - before, ' cm')}</span>}
                  </div>
                )
              })}
          </div>
          {review.photos.length > 0 && (
            <div className="photo-grid review-photos">
              {review.photos.map((p) => (
                <img key={p.id} src={p.dataUrl} alt={`Photo du ${dayLabel(p.date)}`} loading="lazy" />
              ))}
            </div>
          )}
        </>
      )}
    </Screen>
  )
}
