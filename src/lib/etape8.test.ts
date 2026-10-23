import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { importBackup, parseBackup } from '../db/backup'
import { MuscuDB, type Session, type SetEntry } from '../db/database'
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from '../db/seed'
import { applyProgram } from '../db/program'
import { readSettings } from '../db/settings'
import { activeDeload, deloadSuggestion, deloadTarget, inDeload, startDeload, stopDeload } from './deload'
import { exerciseStagnates, isStagnating, stagnatingExercises } from './stagnation'
import { bestStreak, currentStreak, sessionCounts } from './streak'

const w = (reps: number, kg: number, warmup = false): SetEntry => ({ reps, kg, at: '', ...(warmup ? { warmup } : {}) })

let n = 0
function session(start: Date, exercises: [string, SetEntry[]][] = [], extra: Partial<Session> = {}): Session {
  const stamp = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  return {
    id: `s${n++}`,
    templateId: 'pecs-triceps',
    date: stamp,
    startedAt: start.toISOString(),
    endedAt: start.toISOString(),
    status: 'done',
    exercises: exercises.map(([exerciseId, sets]) => ({ exerciseId, type: 'weight', sets, note: '' })),
    exerciseIds: exercises.map(([id]) => id),
    ...extra,
  }
}

describe('stagnation', () => {
  it('aucune des 3 dernières séances ne bat la meilleure d’avant → stagnation', () => {
    expect(isStagnating('weight', [[w(10, 60)], [w(9, 60)], [w(10, 60)], [w(8, 60)]])).toBe(true)
  })

  it('il faut au moins 4 séances', () => {
    expect(isStagnating('weight', [[w(10, 60)], [w(9, 60)], [w(10, 60)]])).toBe(false)
  })

  it('progresser : plus de charge, ou même charge avec plus de reps au total', () => {
    expect(isStagnating('weight', [[w(10, 60)], [w(9, 60)], [w(10, 60)], [w(6, 62.5)]])).toBe(false)
    // 9 + 9 = 18 reps à 60 kg : égale les 18 d'avant, ne les bat pas
    expect(isStagnating('weight', [[w(10, 60), w(8, 60)], [w(9, 60)], [w(9, 60), w(9, 60)], [w(8, 60)]])).toBe(true)
    expect(isStagnating('weight', [[w(10, 60), w(8, 60)], [w(9, 60)], [w(10, 60), w(9, 60)], [w(8, 60)]])).toBe(false)
  })

  it('alterner deux charges sans dépasser la meilleure reste une stagnation', () => {
    expect(isStagnating('weight', [[w(8, 62.5)], [w(10, 60)], [w(7, 62.5)], [w(10, 60)]])).toBe(true)
  })

  it('poids du corps (lest, reps) et durée', () => {
    expect(isStagnating('bodyweight', [[w(10, 0)], [w(10, 0)], [w(9, 0)], [w(10, 0)]])).toBe(true)
    expect(isStagnating('bodyweight', [[w(10, 0)], [w(10, 0)], [w(9, 0)], [w(6, 2.5)]])).toBe(false)
    const d = (s: number): SetEntry => ({ seconds: s, at: '' })
    expect(isStagnating('duration', [[d(60)], [d(55)], [d(60)], [d(50)]])).toBe(true)
  })

  it('les échauffements et les séances allégées ne comptent pas ; le badge disparaît en progressant', () => {
    const base = new Date(2026, 9, 1, 18)
    const at = (i: number) => new Date(base.getTime() + i * 3 * 86_400_000)
    const sessions = [
      session(at(0), [['dc', [w(10, 60)]]]),
      session(at(1), [['dc', [w(9, 60), w(12, 80, true)]]]),
      session(at(2), [['dc', [w(15, 60)]]], { deload: true }),
      session(at(3), [['dc', [w(10, 60)]]]),
      session(at(4), [['dc', [w(8, 60)]]]),
    ]
    expect(exerciseStagnates(sessions, 'dc')).toBe(true)
    expect([...stagnatingExercises(sessions)]).toEqual(['dc'])
    sessions.push(session(at(5), [['dc', [w(11, 60)]]]))
    expect(exerciseStagnates(sessions, 'dc')).toBe(false)
  })
})

describe('semaine allégée', () => {
  const now = new Date(2026, 9, 22, 9)

  it('activation pour 7 jours, fin incluse, puis plus active', () => {
    const periods = startDeload([], '2026-10-22')
    expect(periods).toEqual([{ start: '2026-10-22', end: '2026-10-28' }])
    expect(activeDeload(periods, '2026-10-28')).not.toBeNull()
    expect(activeDeload(periods, '2026-10-29')).toBeNull()
    expect(inDeload(periods, '2026-10-25')).toBe(true)
  })

  it('arrêt avant la fin', () => {
    const stopped = stopDeload(startDeload([], '2026-10-22'), '2026-10-24')
    expect(stopped).toEqual([{ start: '2026-10-22', end: '2026-10-24', stopped: true }])
    expect(activeDeload(stopped, '2026-10-24')).toBeNull()
    expect(inDeload(stopped, '2026-10-23')).toBe(true)
  })

  it('séances allégées : moitié moins de séries (arrondi au supérieur), RIR 3-4', () => {
    expect(deloadTarget({ sets: 3, min: 8, max: 12, rir: '1-2', rest: '2 min' })).toEqual({
      sets: 2, min: 8, max: 12, rir: '3-4', rest: '2 min',
    })
    expect(deloadTarget({ sets: 4, min: 12, max: 20 }).sets).toBe(2)
  })

  const ctx = (over: Partial<Parameters<typeof deloadSuggestion>[0]>) => ({
    periods: [], snoozedUntil: null, featureStartAt: '2026-08-01T00:00:00.000Z', sessions: [], stagnating: 0, now, ...over,
  })

  it('suggérée 6 semaines après la première séance de cette version', () => {
    expect(deloadSuggestion(ctx({ sessions: [session(new Date(2026, 8, 10, 18))] }))).toBe('weeks')
    expect(deloadSuggestion(ctx({ sessions: [session(new Date(2026, 8, 12, 18))] }))).toBeNull()
    // Une séance d'avant la mise en place ne compte pas
    expect(deloadSuggestion(ctx({ featureStartAt: '2026-10-01T00:00:00.000Z', sessions: [session(new Date(2026, 6, 1))] }))).toBeNull()
  })

  it('6 semaines après la dernière semaine allégée', () => {
    expect(deloadSuggestion(ctx({ periods: [{ start: '2026-09-04', end: '2026-09-10' }], sessions: [session(new Date(2026, 7, 2))] }))).toBe('weeks')
    expect(deloadSuggestion(ctx({ periods: [{ start: '2026-09-20', end: '2026-09-26' }], sessions: [session(new Date(2026, 7, 2))] }))).toBeNull()
  })

  it('plus tôt avec 3 exercices en stagnation ; jamais pendant « Plus tard » ni pendant une semaine allégée', () => {
    expect(deloadSuggestion(ctx({ stagnating: 3 }))).toBe('stagnation')
    expect(deloadSuggestion(ctx({ stagnating: 3, snoozedUntil: '2026-10-24T00:00:00.000Z' }))).toBeNull()
    expect(deloadSuggestion(ctx({ stagnating: 3, periods: startDeload([], '2026-10-20') }))).toBeNull()
  })
})

describe('série de semaines', () => {
  // Lundi 19 → dimanche 25 octobre 2026 = semaine en cours
  const now = new Date(2026, 9, 22, 12)
  const s = (m: number, d: number, h = 18) => session(new Date(2026, m, d, h))
  const week = (m: number, d: number, count: number) => Array.from({ length: count }, (_, i) => s(m, d + i))

  it('compte les semaines terminées à 3 séances ou plus, la semaine en cours s’ajoute dès sa 3e', () => {
    const sessions = [...week(9, 5, 3), ...week(9, 12, 4), ...s2(9, 19, 2)]
    expect(currentStreak(sessions, now)).toBe(2)
    sessions.push(s(9, 22))
    expect(currentStreak(sessions, now)).toBe(3)
  })

  it('une semaine terminée sous 3 séances remet à zéro', () => {
    expect(currentStreak([...week(9, 5, 3), ...week(9, 12, 2)], now)).toBe(0)
  })

  it('limites de semaine : dimanche soir et lundi matin', () => {
    // Dimanche 18 oct. 23 h compte pour la semaine du 12, pas celle du 19
    const sessions = [s(9, 12), s(9, 13), s(9, 18, 23)]
    expect(currentStreak(sessions, now)).toBe(1)
    expect(sessionCounts([...sessions, s(9, 19, 0)], now)).toEqual({ week: 1, month: 4 })
  })

  it('meilleure série', () => {
    const sessions = [...week(8, 7, 3), ...week(8, 14, 3), ...week(8, 21, 3), ...week(9, 5, 3)]
    expect(currentStreak(sessions, now)).toBe(0)
    expect(bestStreak(sessions, now)).toBe(3)
  })

  function s2(m: number, d: number, count: number) {
    return Array.from({ length: count }, (_, i) => s(m, d + i))
  }
})

describe('migration v5 → v6', () => {
  it('ne perd rien : séances, records, pesées, compléments, réglages', async () => {
    const name = `v5-${crypto.randomUUID()}`
    const v5 = new Dexie(name)
    v5.version(1).stores({ settings: 'key' })
    v5.version(2).stores({
      exercises: 'id, name',
      templates: 'id',
      days: 'date',
      sessions: 'id, status, date, templateId, startedAt, *exerciseIds',
    })
    v5.version(3).stores({ weighIns: 'date' })
    v5.version(4).stores({ supplements: 'id, order', intakes: 'id, date, supplementId' })
    v5.version(5).stores({})
    const { exercises, templates } = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
    // Un pas déjà réglé à la main ne doit pas être remplacé
    await v5.table('exercises').bulkPut(exercises.map((e) => (e.id === 'curl-marteau' ? { ...e, step: 1 } : e)))
    await v5.table('templates').bulkPut(templates)
    const old = session(new Date(2026, 9, 20, 18), [['developpe-couche-barre', [w(10, 60), w(8, 62.5)]]])
    await v5.table('sessions').put(old)
    await v5.table('weighIns').put({ date: '2026-10-22', kg: 74.2 })
    await v5.table('supplements').put({ id: 'creatine', name: 'Créatine', training: 'after', rest: 'lunch', order: 6 })
    await v5.table('settings').bulkPut([{ key: 'theme', value: 'light' }, { key: 'targetWeight', value: 78 }])
    v5.close()

    const v6 = new MuscuDB(name)
    expect(await v6.sessions.get(old.id)).toEqual(old)
    expect(await v6.weighIns.get('2026-10-22')).toEqual({ date: '2026-10-22', kg: 74.2 })
    expect((await v6.supplements.get('creatine'))?.name).toBe('Créatine')
    expect(await readSettings(v6)).toMatchObject({ theme: 'light', targetWeight: 78, deloadPeriods: [] })
    expect(await v6.activities.count()).toBe(0)
    // Paliers et polyarticulaires
    expect((await v6.exercises.get('developpe-incline-halteres'))?.step).toBe(2)
    expect((await v6.exercises.get('curl-marteau'))?.step).toBe(1)
    expect((await v6.exercises.get('developpe-couche-barre'))?.step).toBeUndefined()
    expect((await v6.exercises.get('hack-squat'))?.compound).toBe(true)
    expect((await v6.exercises.get('leg-extension'))?.compound).toBeUndefined()
    await v6.activities.put({ id: '2026-10-21|foot', date: '2026-10-21', type: 'foot' })
    expect(await v6.activities.where('date').equals('2026-10-21').count()).toBe(1)
    await v6.delete()
  })

  it('un export de l’étape 7 (v5) s’importe avec les nouvelles valeurs, et le nouvel export garde tout', async () => {
    const database = new MuscuDB(`import-v5-${crypto.randomUUID()}`)
    const { exercises, templates } = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
    const v5Export = JSON.stringify({
      app: 'appli-muscu',
      schemaVersion: 5,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [], exercises, templates, sessions: [session(new Date(2026, 9, 20, 18), [['squat', [w(5, 100)]]])] },
    })
    await importBackup(database, parseBackup(v5Export))
    expect(await database.sessions.count()).toBe(1)
    expect((await database.exercises.get('curl-incline-halteres'))?.step).toBe(2)
    expect(await database.activities.count()).toBe(0)
    await database.delete()
  })
})
