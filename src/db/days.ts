import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Day, type DayChoice } from './database'

/** La journée (null = aucun choix, donc jour de repos ; undefined = chargement). */
export function useDay(date: string): Day | null | undefined {
  return useLiveQuery(async () => (await db.days.get(date)) ?? null, [date])
}

/** Choisit la séance (ou le repos) du jour ; null annule le choix. */
export async function setDayChoice(date: string, choice: DayChoice | null): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    if (choice === null) {
      await db.days.delete(date)
      return
    }
    const existing = await db.days.get(date)
    await db.days.put({ ...existing, date, choice })
  })
}

export async function setPlannedTime(date: string, time: string | null): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const existing = await db.days.get(date)
    if (!existing) return
    const next: Day = { ...existing }
    if (time) next.plannedTime = time
    else delete next.plannedTime
    await db.days.put(next)
  })
}
