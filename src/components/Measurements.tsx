import { useState } from 'react'
import type { MeasureKey, Measurement } from '../db/database'
import { deleteMeasurement, saveMeasurement } from '../db/measurements'
import { formatNumber, formatShortDate, parseNumber } from '../lib/format'
import {
  cleanMeasurement,
  MEASURES,
  measureReminder,
  measureSeries,
  measureSummaries,
  shoulderWaistRatio,
} from '../lib/measurements'
import { LineChart } from './charts/LineChart'
import { PlusIcon } from './icons'
import { Sheet } from './Sheet'

const CHART_KEY = 'appli-muscu-mesure-courbe'
const LABELS = Object.fromEntries(MEASURES.map((m) => [m.key, m.label])) as Record<MeasureKey, string>

const cm = (value: number) => `${formatNumber(value)} cm`
const signedCm = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatNumber(Math.abs(value))}`
/** « 2026-10-22 » → date locale à midi (évite les décalages de fuseau) */
const toDate = (date: string) => new Date(`${date}T12:00:00`)
const dayLabel = (date: string) => toDate(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

function readChartKey(): MeasureKey {
  try {
    const saved = localStorage.getItem(CHART_KEY)
    return MEASURES.some((m) => m.key === saved) ? (saved as MeasureKey) : 'bras'
  } catch {
    return 'bras'
  }
}

/** Mensurations : résumé, courbe par mesure et liste (Mon année). */
export function Measurements({ measurements, today, now }: { measurements: Measurement[]; today: string; now: Date }) {
  // undefined = fermé ; sinon la mesure à modifier, ou une nouvelle mesure du jour
  const [editing, setEditing] = useState<{ measurement: Measurement; isNew: boolean } | undefined>()
  const [chartKey, setChartKeyState] = useState<MeasureKey>(readChartKey)
  const [showAll, setShowAll] = useState(false)

  const setChartKey = (key: MeasureKey) => {
    setChartKeyState(key)
    try {
      localStorage.setItem(CHART_KEY, key)
    } catch {
      // pas grave : on reviendra sur les bras
    }
  }

  const summaries = measureSummaries(measurements)
  const ratio = shoulderWaistRatio(measurements)
  const reminder = measureReminder(measurements, now)
  const latest = measurements.at(-1)
  const openNew = () => {
    const existing = measurements.find((m) => m.date === today)
    // Pré-rempli avec la dernière mesure (ou celle du jour si elle existe déjà)
    setEditing({ measurement: { ...(existing ?? latest), date: today }, isNew: !existing })
  }

  const available = MEASURES.filter((m) => measureSeries(measurements, m.key).length > 0)
  const shownKey = available.some((m) => m.key === chartKey) ? chartKey : available[0]?.key
  const series = shownKey ? measureSeries(measurements, shownKey) : []
  const recent = [...measurements].reverse().slice(0, showAll ? undefined : 5)

  return (
    <>
      <h2 className="section-title">Mensurations</h2>
      {reminder !== null && (
        <p className="hint-chip measure-reminder">Dernière mesure il y a {reminder} jours : c’est le moment.</p>
      )}
      {summaries.length === 0 ? (
        <div className="card measure-card">
          <p className="muted">
            Une mesure par mois suffit : bras, poitrine, épaules, taille et cuisse. C’est souvent plus parlant que la
            balance pour voir le muscle venir.
          </p>
          <button className="btn btn-primary" onClick={openNew}>
            <PlusIcon /> Première mesure
          </button>
        </div>
      ) : (
        <>
          <div className="card measure-card">
            <div className="measure-grid" aria-label="Dernières mesures, écart depuis la première">
              {summaries.map((s) => (
                <div key={s.key} className="measure-item">
                  <span className="measure-label">{LABELS[s.key]}</span>
                  <span className="measure-value">{cm(s.latest)}</span>
                  <span className="muted small">
                    {measureSeries(measurements, s.key).length === 1 ? '1re mesure' : s.change === 0 ? 'stable' : `${signedCm(s.change)} cm`}
                  </span>
                </div>
              ))}
            </div>
            {ratio !== null && (
              <p className="measure-ratio">
                Épaules / taille : <strong>{formatNumber(ratio)}</strong>
                <span className="muted small"> · plus il monte, plus la silhouette est en V</span>
              </p>
            )}
            <button className="btn btn-secondary" onClick={openNew}>
              <PlusIcon /> Nouvelle mesure
            </button>
          </div>

          <div className="card chart-card measure-chart">
            <div className="segmented segmented-scroll" role="group" aria-label="Mesure affichée">
              {available.map((m) => (
                <button key={m.key} aria-pressed={shownKey === m.key} onClick={() => setChartKey(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            {series.length > 0 && (
              <LineChart
                points={series.map((p) => ({ date: toDate(p.date), value: p.value }))}
                format={cm}
                formatDate={formatShortDate}
              />
            )}
            {series.length === 1 && <p className="muted small hint">La courbe se dessinera au fil de tes mesures.</p>}
          </div>

          <div className="card list-card">
            {recent.map((m) => (
              <button key={m.date} className="list-row measure-row" onClick={() => setEditing({ measurement: m, isNew: false })}>
                <span>{m.date === today ? 'Aujourd’hui' : dayLabel(m.date)}</span>
                <span className="muted small measure-row-values">
                  {MEASURES.filter((x) => m[x.key] !== undefined)
                    .map((x) => `${LABELS[x.key]} ${formatNumber(m[x.key]!)}`)
                    .join(' · ')}
                </span>
              </button>
            ))}
          </div>
          {measurements.length > 5 && (
            <button className="btn btn-ghost show-all" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Afficher moins' : `Tout afficher (${measurements.length})`}
            </button>
          )}
        </>
      )}

      {editing && (
        <MeasurementSheet
          measurement={editing.measurement}
          isNew={editing.isNew}
          today={today}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}

function MeasurementSheet(props: { measurement: Measurement; isNew: boolean; today: string; onClose: () => void }) {
  const { measurement, isNew, today, onClose } = props
  const [texts, setTexts] = useState<Record<MeasureKey, string>>(
    () =>
      Object.fromEntries(
        MEASURES.map((m) => [m.key, measurement[m.key] !== undefined ? formatNumber(measurement[m.key]!) : '']),
      ) as Record<MeasureKey, string>,
  )
  const values = Object.fromEntries(MEASURES.map((m) => [m.key, parseNumber(texts[m.key])])) as Record<
    MeasureKey,
    number | undefined
  >
  const invalid = MEASURES.some((m) => texts[m.key].trim() !== '' && (values[m.key] === undefined || values[m.key]! <= 0))
  const cleaned = cleanMeasurement(measurement.date, values)
  const empty = Object.keys(cleaned).length === 1

  const title = isNew || measurement.date === today ? 'Mesures du jour' : `Mesures du ${dayLabel(measurement.date)}`

  return (
    <Sheet open onClose={onClose} title={title}>
      <p className="muted small measure-method">
        Le matin, avant de manger, ruban à plat sans serrer, toujours au même endroit.
      </p>
      <div className="field-grid">
        {MEASURES.map((m) => (
          <label key={m.key} className="field">
            <span className="field-label">{m.label} (cm)</span>
            <input
              className="text-input"
              inputMode="decimal"
              placeholder="—"
              value={texts[m.key]}
              onChange={(e) => setTexts({ ...texts, [m.key]: e.target.value })}
            />
            <span className="muted small">{m.how}</span>
          </label>
        ))}
      </div>
      {invalid && <p className="feedback feedback-error">Une valeur n’est pas un nombre valide.</p>}
      <div className="sheet-actions">
        <button
          className="btn btn-primary"
          disabled={invalid || empty}
          onClick={async () => {
            await saveMeasurement(cleaned)
            onClose()
          }}
        >
          Enregistrer
        </button>
        {!isNew && (
          <button
            className="btn btn-ghost btn-danger"
            onClick={async () => {
              if (!confirm('Supprimer ces mesures ?')) return
              await deleteMeasurement(measurement.date)
              onClose()
            }}
          >
            Supprimer ces mesures
          </button>
        )}
      </div>
    </Sheet>
  )
}
