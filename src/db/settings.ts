import { useLiveQuery } from 'dexie-react-hooks'
import { db, type MuscuDB } from './database'

export type Theme = 'dark' | 'light'

export interface Settings {
  theme: Theme
  /** Date du tout premier lancement (ISO), sert au rappel de sauvegarde. */
  firstLaunchAt: string | null
  /** Date du dernier export (ISO). */
  lastExportAt: string | null
  /** Le rappel de sauvegarde est masqué jusqu'à cette date (ISO). */
  reminderSnoozedUntil: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  firstLaunchAt: null,
  lastExportAt: null,
  reminderSnoozedUntil: null,
}

export async function readSettings(database: MuscuDB = db): Promise<Settings> {
  const rows = await database.settings.toArray()
  const settings: Settings = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key in settings) (settings as unknown as Record<string, unknown>)[row.key] = row.value
  }
  return settings
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
  database: MuscuDB = db,
): Promise<void> {
  await database.settings.put({ key, value })
}

/** Réglages en direct (undefined pendant le premier chargement). */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => readSettings())
}

/** À appeler au démarrage : mémorise la date du premier lancement. */
export async function initSettings(database: MuscuDB = db): Promise<void> {
  const existing = await database.settings.get('firstLaunchAt')
  if (!existing) await setSetting('firstLaunchAt', new Date().toISOString(), database)
}
