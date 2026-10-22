import Dexie, { type EntityTable } from 'dexie'

export interface SettingRow {
  key: string
  value: unknown
}

/** Version actuelle du schéma (la plus haute déclarée ci-dessous). */
export const SCHEMA_VERSION = 1

export class MuscuDB extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name = 'appli-muscu') {
    super(name)

    // Historique du schéma. Ne JAMAIS modifier une version déjà publiée :
    // pour faire évoluer les données, ajouter this.version(n + 1) avec un .upgrade()
    // si besoin, augmenter SCHEMA_VERSION et ajouter l'étape dans BACKUP_MIGRATIONS (backup.ts).
    this.version(1).stores({
      settings: 'key',
    })
  }
}

export const db = new MuscuDB()
