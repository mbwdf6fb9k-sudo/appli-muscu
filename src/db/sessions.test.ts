import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import {
  addAbs,
  addSet,
  changeSessionDate,
  deleteSession,
  deleteSet,
  finishSession,
  updateSet,
  lastPerformance,
  moveExercise,
  previousSets,
  startSession,
  templateListFromSession,
} from './sessions'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('séances', () => {
  it('démarre avec les exercices du modèle et marque la journée', async () => {
    const session = await startSession('pecs-triceps', new Date(2026, 9, 22, 18, 0))
    expect(session.exercises.map((e) => e.exerciseId)[0]).toBe('developpe-couche-barre')
    expect(session.exercises.find((e) => e.exerciseId === 'dips')?.type).toBe('bodyweight')
    expect((await db.days.get('2026-10-22'))?.choice).toBe('pecs-triceps')
    // Une seule séance en cours à la fois
    expect((await startSession('jambes')).id).toBe(session.id)
  })

  it('« dernière fois » renvoie la séance terminée la plus récente', async () => {
    const first = await startSession('jambes', new Date(2026, 9, 15, 18, 0))
    await addSet(first.id, 0, { reps: 10, kg: 80 })
    await finishSession(first.id, new Date(2026, 9, 15, 19, 0))

    const second = await startSession('jambes', new Date(2026, 9, 18, 18, 0))
    await addSet(second.id, 0, { reps: 8, kg: 90 })
    await addSet(second.id, 0, { reps: 8, kg: 90 })
    await finishSession(second.id, new Date(2026, 9, 18, 19, 0))

    const current = await startSession('jambes', new Date(2026, 9, 22, 18, 0))
    await addSet(current.id, 0, { reps: 5, kg: 100 })

    const last = await lastPerformance('squat', current.startedAt)
    expect(last?.sets.map((s) => s.kg)).toEqual([90, 90])
    expect(await previousSets('squat', current.startedAt)).toHaveLength(3)
  })

  it('à la fin, les exercices sans série ne sont pas gardés', async () => {
    const session = await startSession('bras')
    await addSet(session.id, 1, { reps: 12, kg: 10 })
    await finishSession(session.id)
    const done = await db.sessions.get(session.id)
    expect(done?.status).toBe('done')
    expect(done?.exercises.map((e) => e.exerciseId)).toEqual(['elevations-laterales'])
    expect(done?.exerciseIds).toEqual(['elevations-laterales'])
  })

  it('modifier une séance terminée : série, date, suppression', async () => {
    const session = await startSession('jambes', new Date(2026, 9, 20, 18, 30))
    await addSet(session.id, 0, { reps: 10, kg: 80 })
    await addSet(session.id, 1, { reps: 12, kg: 150 })
    await finishSession(session.id, new Date(2026, 9, 20, 19, 40))

    // Corriger une série
    await updateSet(session.id, 0, 0, { reps: 10, kg: 85 })
    expect((await db.sessions.get(session.id))?.exercises[0].sets[0].kg).toBe(85)

    // Supprimer la seule série d'un exercice le retire de la séance
    await deleteSet(session.id, 1, 0)
    const edited = (await db.sessions.get(session.id))!
    expect(edited.exercises.map((e) => e.exerciseId)).toEqual(['squat'])
    expect(edited.exerciseIds).toEqual(['squat'])

    // Changer la date garde l'heure et la durée
    await changeSessionDate(session.id, '2026-10-18')
    const moved = (await db.sessions.get(session.id))!
    expect(moved.date).toBe('2026-10-18')
    expect(new Date(moved.startedAt).getHours()).toBe(18)
    expect(new Date(moved.startedAt).getDate()).toBe(18)
    expect(new Date(moved.endedAt!).getTime() - new Date(moved.startedAt).getTime()).toBe(70 * 60_000)

    await deleteSession(session.id)
    expect(await db.sessions.get(session.id)).toBeUndefined()
  })

  it('+ Abdos et réordonner ; les abdos ne vont pas dans le modèle', async () => {
    const session = await startSession('dos-biceps')
    await addAbs(session.id)
    await addAbs(session.id) // pas de doublon
    await moveExercise(session.id, 1, -1)
    const updated = (await db.sessions.get(session.id))!
    expect(updated.exercises.filter((e) => e.fromAbs)).toHaveLength(4)
    expect(updated.exercises[0].exerciseId).toBe('tirage-vertical')
    expect(templateListFromSession(updated)).toHaveLength(9)
  })
})
