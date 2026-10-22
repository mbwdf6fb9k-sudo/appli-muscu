import { useState } from 'react'
import { setSetting, useSettings } from '../db/settings'
import { exportToFile } from '../lib/backupFile'
import { daysSince } from '../lib/dates'
import { shouldRemindBackup, snoozeUntil } from '../lib/reminder'
import { ShieldIcon } from './icons'

/** Rappel discret quand la dernière sauvegarde date de plus de 14 jours. */
export function BackupBanner() {
  const settings = useSettings()
  const [busy, setBusy] = useState(false)

  if (!settings || !shouldRemindBackup(settings)) return null

  const message = settings.lastExportAt
    ? `Ta dernière sauvegarde date de ${daysSince(settings.lastExportAt)} jours.`
    : 'Tu n’as encore jamais sauvegardé tes données.'

  async function handleExport() {
    setBusy(true)
    try {
      await exportToFile()
    } catch {
      alert('L’export a échoué. Réessaie depuis les Réglages.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="banner" role="status">
      <div className="banner-icon">
        <ShieldIcon />
      </div>
      <div className="banner-body">
        <p className="banner-text">
          {message} Pense à exporter une copie, au cas où.
        </p>
        <div className="banner-actions">
          <button className="btn btn-primary btn-small" onClick={handleExport} disabled={busy}>
            Exporter
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setSetting('reminderSnoozedUntil', snoozeUntil())}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
