import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Photo } from './database'

/** Toutes les photos, de la plus ancienne à la plus récente. */
export function usePhotos(): Photo[] | undefined {
  return useLiveQuery(() => db.photos.orderBy('date').toArray())
}

export async function addPhoto(photo: Omit<Photo, 'id'>): Promise<void> {
  await db.photos.add({ ...photo, id: crypto.randomUUID() })
}

export async function updatePhoto(id: string, changes: Pick<Photo, 'date' | 'pose'>): Promise<void> {
  await db.photos.update(id, changes)
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id)
}
