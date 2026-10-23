import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Activity, type ActivityType } from './database'

/** Foot et tennis entre deux dates (AAAA-MM-JJ, incluses). */
export function useActivities(from: string, to: string): Activity[] | undefined {
  return useLiveQuery(() => db.activities.where('date').between(from, to, true, true).toArray(), [from, to])
}

/** Ajoute ou retire « foot » / « tennis » ce jour-là. */
export async function toggleActivity(date: string, type: ActivityType): Promise<void> {
  const id = `${date}|${type}`
  await db.transaction('rw', db.activities, async () => {
    if (await db.activities.get(id)) await db.activities.delete(id)
    else await db.activities.add({ id, date, type })
  })
}
