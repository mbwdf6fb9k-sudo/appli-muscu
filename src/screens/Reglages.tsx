import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { BackupError, importBackup } from '../db/backup'
import { setSetting, useSettings, type Theme } from '../db/settings'
import { ChevronLeftIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { exportToFile, readBackupFile } from '../lib/backupFile'
import { daysSince, formatDaysAgo, formatFullDate } from '../lib/dates'
import { isStoragePersisted } from '../lib/storage'

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
