import { db } from '../db/database'
import { exportBackup, parseBackup, type BackupFile } from '../db/backup'
import { setSetting } from '../db/settings'
import { localDateStamp } from './dates'

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/** Crée le fichier de sauvegarde et l'envoie à la feuille de partage (iPhone) ou le télécharge. */
export async function exportToFile(): Promise<ExportResult> {
  const backup = await exportBackup(db)
  const name = `appli-muscu-${localDateStamp(new Date(backup.exportedAt))}.json`
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' })

  let result: ExportResult = 'downloaded'
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      result = 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      download(file)
    }
  } else {
    download(file)
  }

  await setSetting('lastExportAt', backup.exportedAt)
  return result
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
