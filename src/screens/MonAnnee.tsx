import { useState } from 'react'
import { LineChart } from '../components/charts/LineChart'
import { CheckIcon } from '../components/icons'
import { Screen, SettingsLink } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import type { WeighIn } from '../db/database'
import { setSetting, useSettings, type Settings } from '../db/settings'
import { deleteWeighIn, saveWeighIn, useWeighIns } from '../db/weighIns'
import { localDateStamp } from '../lib/dates'
import { formatNumber, formatShortDate, parseNumber } from '../lib/format'
import { useNow } from '../lib/useNow'
import { filterRange, movingAverage, proteinRange, weightSummary, type WeightRange } from '../lib/weight'

const RANGE_KEY = 'appli-muscu-poids-periode'
const RANGES: { value: WeightRange; label: string }[] = [
  { value: '1m', label: '1 mois' },
  { value: '3m', label: '3 mois' },
  { value: 'year', label: 'Année' },
]

const kg = (value: number) => `${formatNumber(Math.round(value * 10) / 10)} kg`
const signedKg = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${kg(Math.abs(value))}`
/** « 2026-10-22 » → date locale à midi (évite les décalages de fuseau) */
const toDate = (date: string) => new Date(`${date}T12:00:00`)
const monthYear = (date: string) => toDate(date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
const dayLabel = (date: string) => toDate(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

function readRange(): WeightRange {
  try {
    const saved = localStorage.getItem(RANGE_KEY)
    return saved === '1m' || saved === 'year' ? saved : '3m'
  } catch {
    return '3m'
  }
}

export function MonAnnee() {
  const settings = useSettings()
  const weighIns = useWeighIns()
  const now = useNow(60_000)
  const [range, setRangeState] = useState<WeightRange>(readRange)
  const [editing, setEditing] = useState<WeighIn | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  if (!settings || !weighIns) return null

  const today = localDateStamp(now)
  const summary = weightSummary(weighIns, settings)
  const protein = proteinRange(summary?.current ?? settings.startWeight)

  const setRange = (value: WeightRange) => {
    setRangeState(value)
    try {
      localStorage.setItem(RANGE_KEY, value)
    } catch {
      // pas grave : on reviendra sur 3 mois
    }
  }

  const shown = filterRange(movingAverage(weighIns), range, today)
  const references = [{ value: settings.startWeight, label: `départ ${kg(settings.startWeight)}` }]
  // Le poids visé n'apparaît que sur l'année : sur 1 ou 3 mois, il écraserait la courbe
  if (settings.targetWeight !== null && range === 'year') {
    references.push({ value: settings.targetWeight, label: `objectif ${kg(settings.targetWeight)}` })
  }
  const recent = [...weighIns].reverse().slice(0, showAll ? undefined : 7)

  return (
    <Screen title="Mon année" trailing={<SettingsLink />}>
      <TodayWeighIn
        key={weighIns.find((w) => w.date === today)?.kg ?? 'aucune'}
        today={today}
        todayWeighIn={weighIns.find((w) => w.date === today)}
        initial={weighIns.at(-1)?.kg ?? settings.startWeight}
      />

      <h2 className="section-title">Mon poids</h2>
      {summary ? (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{kg(summary.current)}</span>
              <span className="stat-label">moyenne 7 jours</span>
            </div>
            <div className="stat">
              <span className={summary.onTrack ? 'stat-value on-track' : 'stat-value'}>{signedKg(summary.sinceStart)}</span>
              <span className="stat-label">depuis le départ</span>
            </div>
            {summary.toTarget !== null ? (
              <div className="stat">
                <span className="stat-value">{signedKg(summary.toTarget)}</span>
                <span className="stat-label">pour {kg(settings.targetWeight!)}</span>
              </div>
            ) : (
              <div className="stat">
                <span className="stat-value">{kg(settings.startWeight)}</span>
                <span className="stat-label">au départ</span>
              </div>
            )}
          </div>

          <div className="card chart-card weight-chart">
            <div className="segmented segmented-3" role="group" aria-label="Période">
              {RANGES.map((r) => (
                <button key={r.value} aria-pressed={range === r.value} onClick={() => setRange(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
            {shown.length > 0 ? (
              <LineChart
                points={shown.map((p) => ({ date: toDate(p.date), value: p.average, secondary: p.kg }))}
                format={kg}
                formatDate={formatShortDate}
                markers={false}
                valueLabel="Moyenne 7 jours"
                secondaryLabel="Pesée"
                references={references}
              />
            ) : (
              <p className="muted small hint">Aucune pesée sur cette période.</p>
            )}
          </div>

          <h2 className="section-title">Pesées</h2>
          <div className="card list-card">
            {recent.map((w) => (
              <button key={w.date} className="list-row" onClick={() => setEditing(w)}>
                <span>{w.date === today ? 'Aujourd’hui' : dayLabel(w.date)}</span>
                <span className="weigh-value">{kg(w.kg)}</span>
              </button>
            ))}
          </div>
          {weighIns.length > 7 && (
            <button className="btn btn-ghost show-all" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Afficher moins' : `Tout afficher (${weighIns.length})`}
            </button>
          )}
        </>
      ) : (
        <p className="muted hint">Pèse-toi pour commencer ta courbe : une pesée par jour suffit, idéalement le matin.</p>
      )}

      <h2 className="section-title">Profil et objectif</h2>
      <div className="card profile-card">
        <p className="profile-line">
          {settings.age} ans · {formatNumber(settings.heightCm / 100)} m · départ {kg(settings.startWeight)} (
          {monthYear(settings.startDate)})
        </p>
        <p className="profile-goal">{settings.goal}</p>
        <p className="muted small">
          Poids visé : {settings.targetWeight !== null ? kg(settings.targetWeight) : 'non défini'}
        </p>
        <div className="protein">
          <span className="protein-value">
            Protéines visées ≈ {protein.low} à {protein.high} g / jour
          </span>
          <span className="muted small">
            1,6 à 2 g par kg ({kg(summary?.current ?? settings.startWeight)}). Repère indicatif.
          </span>
        </div>
        <button className="btn btn-secondary" onClick={() => setProfileOpen(true)}>
          Modifier
        </button>
      </div>

      {editing && <WeighInSheet weighIn={editing} onClose={() => setEditing(null)} />}
      {profileOpen && <ProfileSheet settings={settings} onClose={() => setProfileOpen(false)} />}
    </Screen>
  )
}

function TodayWeighIn(props: { today: string; todayWeighIn: WeighIn | undefined; initial: number }) {
  const [value, setValue] = useState(props.initial)
  const saved = props.todayWeighIn
  return (
    <div className="card weigh-card">
      <div className="weigh-head">
        <span className="weigh-title">Pesée du jour</span>
        {saved && (
          <span className="weigh-saved">
            <CheckIcon /> {kg(saved.kg)}
          </span>
        )}
      </div>
      <Stepper label="Poids (kg)" value={value} step={0.1} min={30} onChange={setValue} />
      <button
        className={saved ? 'btn btn-secondary' : 'btn btn-primary'}
        disabled={saved?.kg === value}
        onClick={() => saveWeighIn(props.today, value)}
      >
        {saved ? (saved.kg === value ? 'Pesée enregistrée' : 'Remplacer la pesée du jour') : 'Enregistrer la pesée'}
      </button>
    </div>
  )
}

function WeighInSheet({ weighIn, onClose }: { weighIn: WeighIn; onClose: () => void }) {
  const [value, setValue] = useState(weighIn.kg)
  return (
    <Sheet open onClose={onClose} title={`Pesée du ${dayLabel(weighIn.date)}`}>
      <Stepper label="Poids (kg)" value={value} step={0.1} min={30} onChange={setValue} />
      <div className="sheet-actions">
        <button
          className="btn btn-primary"
          onClick={async () => {
            await saveWeighIn(weighIn.date, value)
            onClose()
          }}
        >
          Enregistrer
        </button>
        <button
          className="btn btn-ghost btn-danger"
          onClick={async () => {
            await deleteWeighIn(weighIn.date)
            onClose()
          }}
        >
          Supprimer la pesée
        </button>
      </div>
    </Sheet>
  )
}

type ProfileFields = Pick<Settings, 'age' | 'heightCm' | 'startWeight' | 'startDate' | 'goal' | 'targetWeight'>

function ProfileSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [age, setAge] = useState(String(settings.age))
  const [height, setHeight] = useState(String(settings.heightCm))
  const [start, setStart] = useState(formatNumber(settings.startWeight))
  const [startDate, setStartDate] = useState(settings.startDate)
  const [goal, setGoal] = useState(settings.goal)
  const [target, setTarget] = useState(settings.targetWeight !== null ? formatNumber(settings.targetWeight) : '')

  const parsed = {
    age: parseNumber(age),
    heightCm: parseNumber(height),
    startWeight: parseNumber(start),
    targetWeight: target.trim() === '' ? null : parseNumber(target),
  }
  const valid =
    parsed.age !== undefined &&
    parsed.heightCm !== undefined &&
    parsed.startWeight !== undefined &&
    parsed.targetWeight !== undefined &&
    startDate !== ''

  async function save() {
    if (!valid) return
    const values: ProfileFields = {
      age: Math.round(parsed.age!),
      heightCm: Math.round(parsed.heightCm!),
      startWeight: parsed.startWeight!,
      startDate,
      goal: goal.trim() || 'Prise de muscle',
      targetWeight: parsed.targetWeight!,
    }
    for (const key of Object.keys(values) as (keyof ProfileFields)[]) await setSetting(key, values[key] as never)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Profil et objectif">
      <div className="field-grid">
        <label className="field">
          <span className="field-label">Âge</span>
          <input className="text-input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Taille (cm)</span>
          <input className="text-input" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Poids de départ (kg)</span>
          <input className="text-input" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Date de départ</span>
          <input className="text-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Objectif de l’année</span>
        <textarea className="text-input goal-input" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Poids visé (kg, facultatif)</span>
        <input
          className="text-input"
          inputMode="decimal"
          placeholder="Pas d’objectif chiffré"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <div className="sheet-actions">
        <button className="btn btn-primary" onClick={save} disabled={!valid}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  )
}
