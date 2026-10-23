import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Measurement } from './database'

/** Toutes les mensurations, de la plus ancienne à la plus récente. */
export function useMeasurements(): Measurement[] | undefined {
  return useLiveQuery(() => db.measurements.orderBy('date').toArray())
}

/** Enregistre les mesures d'un jour ; une nouvelle saisie le même jour remplace la précédente. */
export async function saveMeasurement(measurement: Measurement): Promise<void> {
  await db.measurements.put(measurement)
}

export async function deleteMeasurement(date: string): Promise<void> {
  await db.measurements.delete(date)
}
