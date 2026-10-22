import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WeighIn } from './database'

/** Toutes les pesées, de la plus ancienne à la plus récente. */
export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => db.weighIns.orderBy('date').toArray())
}

/** Enregistre la pesée d'un jour ; une nouvelle pesée le même jour remplace la précédente. */
export async function saveWeighIn(date: string, kg: number): Promise<void> {
  await db.weighIns.put({ date, kg: Math.round(kg * 10) / 10 })
}

export async function deleteWeighIn(date: string): Promise<void> {
  await db.weighIns.delete(date)
}
