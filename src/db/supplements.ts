import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Supplement } from './database'

/** Les compléments, dans l'ordre de la liste. */
export function useSupplements(): Supplement[] | undefined {
  return useLiveQuery(() => db.supplements.orderBy('order').toArray())
}

/** Identifiants des compléments cochés ce jour-là. */
export function useIntakes(date: string): Set<string> | undefined {
  return useLiveQuery(
    async () => new Set((await db.intakes.where('date').equals(date).toArray()).map((i) => i.supplementId)),
    [date],
  )
}

/** Coche ou décoche un complément pour la journée. */
export async function toggleIntake(date: string, supplementId: string): Promise<void> {
  const id = `${date}|${supplementId}`
  await db.transaction('rw', db.intakes, async () => {
    if (await db.intakes.get(id)) await db.intakes.delete(id)
    else await db.intakes.add({ id, date, supplementId, at: new Date().toISOString() })
  })
}

export type SupplementFields = Omit<Supplement, 'id' | 'order'>

/** Crée (sans id) ou modifie un complément. */
export async function saveSupplement(fields: SupplementFields, id?: string): Promise<void> {
  await db.transaction('rw', db.supplements, async () => {
    const clean: SupplementFields = { ...fields, name: fields.name.trim() }
    if (!clean.dose?.trim()) delete clean.dose
    if (!clean.note?.trim()) delete clean.note
    if (!clean.caffeine) delete clean.caffeine
    if (id) {
      const existing = await db.supplements.get(id)
      if (existing) await db.supplements.put({ ...clean, id, order: existing.order })
      return
    }
    const last = await db.supplements.orderBy('order').last()
    await db.supplements.add({ ...clean, id: crypto.randomUUID(), order: (last?.order ?? -1) + 1 })
  })
}

export async function deleteSupplement(id: string): Promise<void> {
  await db.transaction('rw', [db.supplements, db.intakes], async () => {
    await db.supplements.delete(id)
    await db.intakes.where('supplementId').equals(id).delete()
  })
}
