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
  /** Pas de charge par défaut des boutons + / − (kg). */
  weightStep: number
  // Profil (Mon année)
  age: number
  heightCm: number
  startWeight: number
  /** AAAA-MM-JJ */
  startDate: string
  goal: string
  targetWeight: number | null
  /** Mise en place de l'étape 8 (bandeau des 14 jours, compte des 6 semaines) */
  featureStartAt: string | null
  /** Semaines allégées (dates AAAA-MM-JJ, fin incluse) */
  deloadPeriods: DeloadPeriod[]
  /** « Plus tard » sur la suggestion de semaine allégée */
  deloadSnoozedUntil: string | null
  /** Dernier bilan du mois vu ou fermé (AAAA-MM) : carte d'Aujourd'hui */
  monthlyReviewSeen: string | null
}

export interface DeloadPeriod {
  start: string
  end: string
  /** Arrêtée avant la fin prévue */
  stopped?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  firstLaunchAt: null,
  lastExportAt: null,
  reminderSnoozedUntil: null,
  weightStep: 2.5,
  age: 21,
  heightCm: 177,
  startWeight: 74,
  startDate: '2026-10-01',
  goal: 'Stock et esthétique : prise de muscle propre, proportions équilibrées',
  targetWeight: null,
  featureStartAt: null,
  deloadPeriods: [],
  deloadSnoozedUntil: null,
  monthlyReviewSeen: null,
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
  // Étape 8 : le jour où la mise à jour s'installe (bandeau des 14 jours, semaine allégée)
  if (!(await database.settings.get('featureStartAt'))) {
    await setSetting('featureStartAt', new Date().toISOString(), database)
  }
}
