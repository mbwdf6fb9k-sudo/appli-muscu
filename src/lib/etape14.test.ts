import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { importBackup, parseBackup } from '../db/backup'
import { db, MuscuDB, type Session } from '../db/database'
import { createExercise } from '../db/exercises'
import { addExercises, addSet, finishSession, startSession } from '../db/sessions'
import { adviceOfDay } from './advice'
import { seriesCsv } from './csv'
import { monthlyReview } from './monthlyReview'
import { sessionCounts } from './streak'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('séance libre', () => {
  it('démarre vide, sans modèle, et marque un jour d’entraînement', async () => {
    const templatesBefore = await db.templates.toArray()
    const session = await startSession('libre', new Date(2026, 10, 5, 18))
    expect(session.exercises).toEqual([])
    expect((await db.days.get('2026-11-05'))?.choice).toBe('libre')
    expect(await db.templates.toArray()).toEqual(templatesBefore)
    expect(await db.templates.get('libre' as never)).toBeUndefined()
  })

  it('objectif du modèle repris sans le superset ; exercice perso sans objectif', async () => {
    const session = await startSession('libre')
    const perso = await createExercise('Curl avec les potes', 'weight', 'biceps')
    await addExercises(session.id, ['curl-barre-ez', 'developpe-couche-barre', perso.id])
    const entries = (await db.sessions.get(session.id))!.exercises
    expect(entries[0].target).toMatchObject({ sets: 3, min: 6, max: 10 })
    expect(entries[0].target?.superset).toBeUndefined()
    expect(entries[2].target).toBeUndefined()
    // Une séance du programme garde son superset
    await finishSession(session.id)
    const bras = await startSession('bras')
    expect(bras.exercises.find((e) => e.exerciseId === 'curl-barre-ez')?.target?.superset).toBe('A')
  })

  it('compte dans la semaine, le bilan et le CSV ; n’est jamais conseillée', async () => {
    const session = await startSession('libre', new Date(2026, 9, 20, 18))
    await addExercises(session.id, ['squat'])
    await addSet(session.id, 0, { reps: 8, kg: 80 })
    await finishSession(session.id, new Date(2026, 9, 20, 19))
    const done = (await db.sessions.get(session.id))!
    expect(sessionCounts([done], new Date(2026, 9, 22, 9))).toMatchObject({ week: 1, month: 1 })
    const review = monthlyReview('2026-10', {
      sessions: [done], exercisesById: new Map(), activities: [], weighIns: [], measurements: [], photos: [],
      deloadPeriods: [], templates: [], bodyweight: 75, now: new Date(2026, 10, 2),
    })
    expect(review.byTemplate).toEqual([{ templateId: 'libre', count: 1 }])
    expect(seriesCsv([done], new Map())).toContain('2026-10-20;Séance libre;')

    const at = (day: number): Session => ({ ...done, id: `l${day}`, date: `2026-10-${day}`, startedAt: new Date(2026, 9, day, 18).toISOString() })
    const now = new Date(2026, 9, 22, 9)
    const none = adviceOfDay({ sessions: [], activities: [], footDays: [], now })
    const advice = adviceOfDay({ sessions: [at(21)], activities: [], footDays: [], now })
    expect(advice).toMatchObject({ kind: 'session', templateId: 'dos-biceps' })
    expect(advice.others.map((o) => o.templateId)).not.toContain('libre')
    expect(none.others.map((o) => o.templateId)).not.toContain('libre')
    // 3 jours d'affilée et 4 séances dans la semaine
    expect(adviceOfDay({ sessions: [at(19), at(20), at(21)], activities: [], footDays: [], now }).kind).toBe('rest')
  })

  it('un export avec une séance libre se réimporte tel quel', async () => {
    const free: Session = {
      id: 'f', templateId: 'libre', date: '2026-11-05', startedAt: '2026-11-05T17:00:00.000Z', endedAt: '2026-11-05T18:00:00.000Z',
      status: 'done', exercises: [{ exerciseId: 'squat', type: 'weight', sets: [{ reps: 8, kg: 80, at: '1' }], note: '' }], exerciseIds: ['squat'],
    }
    const copy = new MuscuDB(`libre-${crypto.randomUUID()}`)
    await importBackup(copy, parseBackup(JSON.stringify({ app: 'appli-muscu', schemaVersion: 8, exportedAt: '2026-11-05T18:00:00.000Z', tables: { sessions: [free] } })))
    expect(await copy.sessions.get('f')).toEqual(free)
    await copy.delete()
  })
})
