import { SCHEMA_VERSION, type MuscuDB } from './database'
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from './seed'

export const BACKUP_APP_ID = 'appli-muscu'

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

/** Erreur dont le message peut être montré tel quel à l'utilisateur. */
export class BackupError extends Error {}

type BackupTables = BackupFile['tables']

// Transformations des sauvegardes faites avec une ancienne version du schéma.
// Clé = version de départ ; la fonction renvoie les tables au format de la version suivante.
const BACKUP_MIGRATIONS: Record<number, (tables: BackupTables) => BackupTables> = {
  // v1 → v2 : arrivée des exercices, modèles, journées et séances
  1: (tables) => ({
    ...tables,
    exercises: structuredClone(DEFAULT_EXERCISES),
    templates: structuredClone(DEFAULT_TEMPLATES),
    days: [],
    sessions: [],
  }),
}

export async function exportBackup(database: MuscuDB, now = new Date()): Promise<BackupFile> {
  const tables: BackupTables = {}
  await database.transaction('r', database.tables, async () => {
    for (const table of database.tables) tables[table.name] = await table.toArray()
  })
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables }
}

export function parseBackup(text: string): BackupFile {
  const invalid = new BackupError('Ce fichier n’est pas une sauvegarde de l’appli Muscu.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw invalid
  }
  if (!isObject(data) || data.app !== BACKUP_APP_ID) throw invalid
  const { schemaVersion, exportedAt, tables } = data
  if (!Number.isInteger(schemaVersion) || (schemaVersion as number) < 1) throw invalid
  if (typeof exportedAt !== 'string' || Number.isNaN(Date.parse(exportedAt))) throw invalid
  if (!isObject(tables)) throw invalid
  for (const rows of Object.values(tables)) {
    if (!Array.isArray(rows) || !rows.every(isObject)) throw invalid
  }
  return data as unknown as BackupFile
}

export function migrateBackup(backup: BackupFile, targetVersion = SCHEMA_VERSION): BackupFile {
  if (backup.schemaVersion > targetVersion) {
    throw new BackupError(
      'Cette sauvegarde vient d’une version plus récente de l’appli. Ferme puis rouvre l’appli pour la mettre à jour, et réessaie.',
    )
  }
  let tables = backup.tables
  for (let version = backup.schemaVersion; version < targetVersion; version++) {
    const step = BACKUP_MIGRATIONS[version]
    if (step) tables = step(tables)
  }
  return { ...backup, schemaVersion: targetVersion, tables }
}

/** Remplace toutes les données par celles de la sauvegarde, en une seule opération (tout ou rien). */
export async function importBackup(database: MuscuDB, backup: BackupFile): Promise<void> {
  const migrated = migrateBackup(backup)
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) {
      await table.clear()
      const rows = migrated.tables[table.name] ?? []
      if (rows.length > 0) await table.bulkAdd(rows)
    }
    // Les données actuelles sont exactement celles de ce fichier : il compte comme dernière sauvegarde.
    await database.settings.put({ key: 'lastExportAt', value: migrated.exportedAt })
  })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
