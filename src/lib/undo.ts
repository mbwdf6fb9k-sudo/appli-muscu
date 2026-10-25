import { useSyncExternalStore } from 'react'

/** Durée pendant laquelle « Annuler » reste proposé. */
export const UNDO_MS = 6000

export interface UndoOffer {
  id: number
  /** « Série supprimée » */
  label: string
  restore: () => Promise<void>
}

let current: UndoOffer | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 1
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Propose « Annuler » pendant environ 6 s ; une nouvelle proposition remplace la précédente. */
export function offerUndo(label: string, restore: () => Promise<void>): void {
  clearTimeout(timer)
  current = { id: nextId++, label, restore }
  notify()
  timer = setTimeout(dismissUndo, UNDO_MS)
}

export function dismissUndo(): void {
  clearTimeout(timer)
  current = null
  notify()
}

/** Remet exactement l'état d'avant. */
export async function runUndo(): Promise<void> {
  const offer = current
  dismissUndo()
  await offer?.restore()
}

export function currentUndo(): UndoOffer | null {
  return current
}

export function useUndo(): UndoOffer | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
