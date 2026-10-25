import { db } from '../db/database'
import { exportBackup, parseBackup, type BackupFile } from '../db/backup'
import { setSetting } from '../db/settings'
import { activitiesCsv, seriesCsv, weighInsCsv } from './csv'
import { localDateStamp } from './dates'
import { createZip } from './zip'

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/** Crée le fichier de sauvegarde et l'envoie à la feuille de partage (iPhone) ou le télécharge. */
export async function exportToFile(): Promise<ExportResult> {
  const backup = await exportBackup(db)
  const name = `appli-muscu-${localDateStamp(new Date(backup.exportedAt))}.json`
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' })
  const result = await shareOrDownload(file)
  if (result !== 'cancelled') await setSetting('lastExportAt', backup.exportedAt)
  return result
}

/**
 * Export CSV pour Excel ou Power BI : series.csv, pesees.csv et activites.csv dans un seul .zip.
 * Ce n'est pas une sauvegarde (non importable) : la date de dernière sauvegarde ne change pas.
 */
export async function exportCsvToFile(now = new Date()): Promise<ExportResult> {
  const [sessions, exercises, weighIns, activities] = await Promise.all([
    db.sessions.toArray(),
    db.exercises.toArray(),
    db.weighIns.toArray(),
    db.activities.toArray(),
  ])
  const encoder = new TextEncoder()
  const zip = createZip(
    [
      { name: 'series.csv', data: encoder.encode(seriesCsv(sessions, new Map(exercises.map((e) => [e.id, e])))) },
      { name: 'pesees.csv', data: encoder.encode(weighInsCsv(weighIns)) },
      { name: 'activites.csv', data: encoder.encode(activitiesCsv(activities)) },
    ],
    now,
  )
  const file = new File([zip], `appli-muscu-csv-${localDateStamp(now)}.zip`, { type: 'application/zip' })
  return shareOrDownload(file)
}

/** Feuille de partage (iPhone) ou téléchargement. */
async function shareOrDownload(file: File): Promise<ExportResult> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  download(file)
  return 'downloaded'
}

export async function readBackupFile(file: File): Promise<BackupFile> {
  return parseBackup(await file.text())
}

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
