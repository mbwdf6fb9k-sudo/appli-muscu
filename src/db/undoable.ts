import { offerUndo } from '../lib/undo'
import { db, type SetEntry } from './database'
import { deleteSession, deleteSet, removeExercise, swapExercise, updateSet } from './sessions'
import { deleteWeighIn } from './weighIns'

/** Fait la modification d'une séance, puis propose de remettre la séance exactement comme avant. */
async function withSessionUndo(sessionId: string, label: string, change: () => Promise<void>): Promise<void> {
  const before = await db.sessions.get(sessionId)
  await change()
  if (before) offerUndo(label, async () => void (await db.sessions.put(before)))
}

export function deleteSetUndoable(sessionId: string, exerciseIndex: number, setIndex: number) {
  return withSessionUndo(sessionId, 'Série supprimée', () => deleteSet(sessionId, exerciseIndex, setIndex))
}

export function updateSetUndoable(sessionId: string, exerciseIndex: number, setIndex: number, values: Omit<SetEntry, 'at'>) {
  return withSessionUndo(sessionId, 'Série modifiée', () => updateSet(sessionId, exerciseIndex, setIndex, values))
}

export function removeExerciseUndoable(sessionId: string, exerciseIndex: number) {
  return withSessionUndo(sessionId, 'Exercice retiré', () => removeExercise(sessionId, exerciseIndex))
}

export function deleteSessionUndoable(sessionId: string) {
  return withSessionUndo(sessionId, 'Séance supprimée', () => deleteSession(sessionId))
}

export async function deleteWeighInUndoable(date: string): Promise<void> {
  const before = await db.weighIns.get(date)
  await deleteWeighIn(date)
  if (before) offerUndo('Pesée supprimée', async () => void (await db.weighIns.put(before)))
}

export function swapExerciseUndoable(sessionId: string, exerciseIndex: number, newExerciseId: string) {
  return withSessionUndo(sessionId, 'Exercice remplacé', () => swapExercise(sessionId, exerciseIndex, newExerciseId))
}
