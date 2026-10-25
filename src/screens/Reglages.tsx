import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { BackupError, importBackup } from '../db/backup'
import { setSetting, useSettings, type Theme } from '../db/settings'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { exportCsvToFile, exportToFile, readBackupFile } from '../lib/backupFile'
import { daysSince, formatDaysAgo, formatFullDate } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { isStoragePersisted } from '../lib/storage'

/** Jours de la semaine, du lundi au dimanche (getDay : 0 = dimanche). */
const WEEKDAYS: { day: number; short: string; label: string }[] = [
  { day: 1, short: 'L', label: 'lundi' },
  { day: 2, short: 'M', label: 'mardi' },
  { day: 3, short: 'M', label: 'mercredi' },
  { day: 4, short: 'J', label: 'jeudi' },
  { day: 5, short: 'V', label: 'vendredi' },
  { day: 6, short: 'S', label: 'samedi' },
  { day: 0, short: 'D', label: 'dimanche' },
]

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
]

export function Reglages() {
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void isStoragePersisted().then(setPersisted)
  }, [])

  // Retour à l'écran précédent, ou à l'accueil si on est arrivé directement ici.
  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1))

  async function handleExport() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await exportToFile()
      if (result !== 'cancelled') setMessage({ text: 'Sauvegarde exportée ✓' })
    } catch {
      setMessage({ text: 'L’export a échoué. Réessaie.', error: true })
    } finally {
      setBusy(false)
    }
  }

  async function handleCsvExport() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await exportCsvToFile()
      if (result !== 'cancelled') setMessage({ text: 'Export CSV prêt ✓ (ce n’est pas une sauvegarde)' })
    } catch {
      setMessage({ text: 'L’export CSV a échoué. Réessaie.', error: true })
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permet de rechoisir le même fichier
    if (!file) return
    setMessage(null)
    try {
      const backup = await readBackupFile(file)
      const date = formatFullDate(new Date(backup.exportedAt))
      if (!confirm(`Importer la sauvegarde du ${date} ?\n\nToutes tes données actuelles seront remplacées.`)) return
      setBusy(true)
      await importBackup(db, backup)
      setMessage({ text: 'Sauvegarde importée ✓' })
    } catch (error) {
      const text =
        error instanceof BackupError
          ? error.message
          : 'L’import a échoué. Tes données n’ont pas été modifiées.'
      setMessage({ text, error: true })
    } finally {
      setBusy(false)
    }
  }

  const lastBackup = settings?.lastExportAt
    ? `Dernière sauvegarde ${formatDaysAgo(daysSince(settings.lastExportAt))}`
    : 'Aucune sauvegarde pour l’instant'

  return (
    <Screen
      title="Réglages"
      leading={
        <button className="icon-btn icon-btn-back" onClick={goBack} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      <h2 className="section-title">Apparence</h2>
      <div className="card">
        <div className="segmented" role="group" aria-label="Thème">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              aria-pressed={settings?.theme === theme.value}
              onClick={() => setSetting('theme', theme.value)}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">Entraînement</h2>
      <div className="card list-card">
        <Link to="/reglages/exercices" className="list-row">
          <span>Exercices et modèles</span>
          <span className="list-row-end muted small">
            Pas de {formatNumber(settings?.weightStep ?? 2.5)} kg <ChevronRightIcon />
          </span>
        </Link>
      </div>

      <h2 className="section-title">Jour(s) de foot habituel(s)</h2>
      <div className="card stack">
        <div className="weekday-picker" role="group" aria-label="Jours de foot habituels">
          {WEEKDAYS.map(({ day, short, label }) => {
            const on = settings?.footDays.includes(day) ?? false
            return (
              <button
                key={day}
                aria-pressed={on}
                aria-label={label}
                className={on ? 'weekday on' : 'weekday'}
                onClick={() =>
                  settings &&
                  setSetting('footDays', on ? settings.footDays.filter((d) => d !== day) : [...settings.footDays, day].sort())
                }
              >
                {short}
              </button>
            )
          })}
        </div>
        <p className="muted small">La séance conseillée évite Jambes la veille de ces jours-là.</p>
      </div>

      <h2 className="section-title">Sauvegarde</h2>
      <div className="card stack">
        <p className="card-lead">{lastBackup}</p>
        <p className="muted small">
          Tes données restent uniquement sur ce téléphone. Exporte régulièrement une copie (dans Fichiers ou
          iCloud Drive) pour pouvoir les récupérer si besoin.
        </p>
        <button className="btn btn-primary" onClick={handleExport} disabled={busy}>
          Exporter mes données
        </button>
        <button className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          Importer une sauvegarde
        </button>
        <button className="btn btn-secondary" onClick={handleCsvExport} disabled={busy}>
          Exporter en CSV
        </button>
        <p className="muted small">
          CSV (séries, pesées, foot et tennis) pour Excel ou Power BI, dans un .zip. Il ne remplace pas la sauvegarde
          et ne peut pas être réimporté.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          hidden
        />
        {message && (
          <p className={message.error ? 'feedback feedback-error' : 'feedback'} role="status">
            {message.text}
          </p>
        )}
      </div>

      <h2 className="section-title">Stockage</h2>
      <div className="card row-between">
        <span>Stockage protégé</span>
        <span className="muted">{persisted === null ? '—' : persisted ? 'Oui' : 'Non'}</span>
      </div>
      {persisted === false && (
        <p className="muted small hint">
          Le téléphone pourrait effacer les données si l’appli reste longtemps inutilisée. Ajoute-la à l’écran
          d’accueil et exporte régulièrement.
        </p>
      )}

      <h2 className="section-title">À propos</h2>
      <div className="card row-between">
        <span>Version</span>
        <span className="muted">
          {__APP_VERSION__} · {new Date(__BUILD_TIME__).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </div>
    </Screen>
  )
}
