import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup, parseBackup } from '../db/backup'
import { MuscuDB, type Exercise, type Session, type SetEntry } from '../db/database'
import { applyExerciseDefaults, applyMuscleDefaults, applyProgram } from '../db/program'
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from '../db/seed'
import { readSettings } from '../db/settings'
import { fitSize, dataUrlBytes, formatBytes } from './image'
import { cleanMeasurement, measureReminder, measureSeries, measureSummaries, shoulderWaistRatio } from './measurements'
import { monthlyReview, ofMonth, previousMonth, type MonthlyData } from './monthlyReview'
import { isBehind, muscleVolume } from './muscleVolume'

const w = (reps: number, kg: number, warmup = false): SetEntry => ({ reps, kg, at: '', ...(warmup ? { warmup } : {}) })

let n = 0
function session(start: Date, exercises: [string, SetEntry[]][] = [], extra: Partial<Session> = {}): Session {
  const stamp = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  return {
    id: `s${n++}`,
    templateId: 'pecs-triceps',
    date: stamp,
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
    status: 'done',
    exercises: exercises.map(([exerciseId, sets]) => ({ exerciseId, type: 'weight', sets, note: '' })),
    exerciseIds: exercises.map(([id]) => id),
    ...extra,
  }
}

function programExercises(): Exercise[] {
  const { exercises } = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
  return applyMuscleDefaults(applyExerciseDefaults(exercises))
}
const byId = () => new Map(programExercises().map((e) => [e.id, e]))

describe('muscle principal', () => {
  it('tous les exercices du programme ont un muscle', () => {
    expect(programExercises().filter((e) => !e.muscle).map((e) => e.id)).toEqual([])
  })

  it('un muscle déjà choisi n’est jamais remplacé', () => {
    const [ex] = applyMuscleDefaults([{ id: 'dips', name: 'Dips', type: 'bodyweight', muscle: 'triceps' }])
    expect(ex.muscle).toBe('triceps')
    expect(applyMuscleDefaults([{ id: 'perso', name: 'Perso', type: 'weight' }])[0].muscle).toBeUndefined()
  })
})

describe('migration v6 → v7', () => {
  it('ne perd rien : séances, échauffements, foot/tennis, pesées, compléments, réglages', async () => {
    const name = `v6-${crypto.randomUUID()}`
    const v6 = new Dexie(name)
    v6.version(1).stores({ settings: 'key' })
    v6.version(2).stores({
      exercises: 'id, name',
      templates: 'id',
      days: 'date',
      sessions: 'id, status, date, templateId, startedAt, *exerciseIds',
    })
    v6.version(3).stores({ weighIns: 'date' })
    v6.version(4).stores({ supplements: 'id, order', intakes: 'id, date, supplementId' })
    v6.version(5).stores({})
    v6.version(6).stores({ activities: 'id, date' })
    const { exercises, templates } = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
    await v6.table('exercises').bulkPut(applyExerciseDefaults(exercises).map((e) => (e.id === 'dips' ? { ...e, muscle: 'triceps' } : e)))
    await v6.table('templates').bulkPut(templates)
    const old = session(new Date(2026, 9, 20, 18), [['developpe-couche-barre', [w(10, 30, true), w(8, 62.5)]]], { deload: true })
    await v6.table('sessions').put(old)
    await v6.table('weighIns').put({ date: '2026-10-22', kg: 74.2 })
    await v6.table('activities').put({ id: '2026-10-21|foot', date: '2026-10-21', type: 'foot' })
    await v6.table('supplements').put({ id: 'creatine', name: 'Créatine', training: 'after', rest: 'lunch', order: 6 })
    await v6.table('settings').bulkPut([
      { key: 'theme', value: 'light' },
      { key: 'deloadPeriods', value: [{ start: '2026-10-19', end: '2026-10-25' }] },
    ])
    v6.close()

    const v7 = new MuscuDB(name)
    expect(await v7.sessions.get(old.id)).toEqual(old)
    expect(await v7.weighIns.get('2026-10-22')).toEqual({ date: '2026-10-22', kg: 74.2 })
    expect(await v7.activities.get('2026-10-21|foot')).toEqual({ id: '2026-10-21|foot', date: '2026-10-21', type: 'foot' })
    expect((await v7.supplements.get('creatine'))?.name).toBe('Créatine')
    expect(await readSettings(v7)).toMatchObject({
      theme: 'light',
      deloadPeriods: [{ start: '2026-10-19', end: '2026-10-25' }],
      monthlyReviewSeen: null,
    })
    expect((await v7.exercises.get('developpe-incline-halteres'))?.step).toBe(2)
    expect((await v7.exercises.get('developpe-incline-halteres'))?.muscle).toBe('pecs')
    expect((await v7.exercises.get('dips'))?.muscle).toBe('triceps')
    expect(await v7.measurements.count()).toBe(0)
    expect(await v7.photos.count()).toBe(0)
    await v7.measurements.put({ date: '2026-10-23', bras: 36.5 })
    await v7.photos.put({ id: 'p1', date: '2026-10-23', pose: 'face', dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1 })
    expect(await v7.photos.where('date').equals('2026-10-23').count()).toBe(1)
    await v7.delete()
  })

  it('un export v6 s’importe ; le nouvel export contient mesures et photos', async () => {
    const database = new MuscuDB(`import-v6-${crypto.randomUUID()}`)
    const { exercises, templates } = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
    const v6Export = JSON.stringify({
      app: 'appli-muscu',
      schemaVersion: 6,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: {
        settings: [],
        exercises: applyExerciseDefaults(exercises),
        templates,
        sessions: [session(new Date(2026, 9, 20, 18), [['squat', [w(5, 100)]]])],
        activities: [{ id: '2026-10-21|tennis', date: '2026-10-21', type: 'tennis' }],
      },
    })
    await importBackup(database, parseBackup(v6Export))
    expect(await database.sessions.count()).toBe(1)
    expect(await database.activities.count()).toBe(1)
    expect((await database.exercises.get('squat'))?.muscle).toBe('quadriceps')

    await database.measurements.put({ date: '2026-10-23', taille: 80 })
    await database.photos.put({ id: 'p1', date: '2026-10-23', pose: 'dos', dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1 })
    const backup = await exportBackup(database)
    expect(backup.schemaVersion).toBe(8)
    expect(backup.tables.measurements).toHaveLength(1)
    expect(backup.tables.photos).toHaveLength(1)
    // Réimport du nouvel export : identique
    const copy = new MuscuDB(`reimport-${crypto.randomUUID()}`)
    await importBackup(copy, parseBackup(JSON.stringify(backup)))
    expect(await copy.photos.get('p1')).toMatchObject({ pose: 'dos', dataUrl: 'data:image/jpeg;base64,AAAA' })
    expect(await copy.measurements.get('2026-10-23')).toEqual({ date: '2026-10-23', taille: 80 })
    await database.delete()
    await copy.delete()
  })
})

describe('mensurations', () => {
  const list = [
    { date: '2026-10-01', bras: 35, epaules: 115, taille: 82 },
    { date: '2026-11-01', bras: 35.5, taille: 81 },
    { date: '2026-12-01', bras: 36.5, epaules: 118 },
  ]

  it('dernière valeur et écart depuis la première, mesure par mesure', () => {
    expect(measureSummaries(list)).toEqual([
      { key: 'bras', latest: 36.5, latestDate: '2026-12-01', change: 1.5 },
      { key: 'epaules', latest: 118, latestDate: '2026-12-01', change: 3 },
      { key: 'taille', latest: 81, latestDate: '2026-11-01', change: -1 },
    ])
    expect(measureSeries(list, 'epaules')).toEqual([
      { date: '2026-10-01', value: 115 },
      { date: '2026-12-01', value: 118 },
    ])
  })

  it('rapport épaules / taille avec les dernières valeurs connues', () => {
    expect(shoulderWaistRatio(list)).toBe(1.46)
    expect(shoulderWaistRatio([{ date: '2026-10-01', bras: 35 }])).toBeNull()
  })

  it('rappel au-delà de 30 jours', () => {
    expect(measureReminder(list, new Date(2026, 11, 31))).toBeNull()
    expect(measureReminder(list, new Date(2027, 0, 4))).toBe(34)
    expect(measureReminder([], new Date())).toBeNull()
  })

  it('seules les valeurs saisies sont gardées, au dixième', () => {
    expect(cleanMeasurement('2026-10-23', { bras: 36.54, taille: undefined, cuisse: 0, poitrine: Number.NaN })).toEqual({
      date: '2026-10-23',
      bras: 36.5,
    })
  })
})

describe('séries par muscle', () => {
  // Vendredi 23 octobre 2026 ; la semaine commence le lundi 19
  const now = new Date(2026, 9, 23, 20)

  it('compte les séries de travail de la semaine, sans les échauffements ni les séances en cours', () => {
    const sessions = [
      session(new Date(2026, 9, 19, 18), [
        ['developpe-couche-barre', [w(10, 30, true), w(8, 60), w(8, 60)]],
        ['extension-triceps-poulie', [w(12, 20)]],
      ]),
      session(new Date(2026, 9, 18, 23, 30), [['squat', [w(5, 100)]]]), // dimanche : semaine d'avant
      session(new Date(2026, 9, 23, 18), [['tractions', [w(8, 0)]]], { status: 'active' }),
    ]
    const { rows } = muscleVolume(sessions, byId(), now)
    const get = (m: string) => rows.find((r) => r.muscle === m)!
    expect(get('pecs').week).toBe(2)
    expect(get('triceps').week).toBe(1)
    expect(get('quadriceps').week).toBe(0)
    expect(get('dos').week).toBe(0)
    expect(rows.some((r) => r.muscle === 'autre')).toBe(false)
  })

  it('moyenne des semaines terminées depuis la première séance (4 au plus)', () => {
    const sessions = [
      session(new Date(2026, 9, 6, 18), [['developpe-couche-barre', [w(8, 60), w(8, 60), w(8, 60)]]]),
      session(new Date(2026, 9, 14, 18), [['developpe-couche-barre', [w(8, 60), w(8, 60), w(8, 60)]]]),
      session(new Date(2026, 9, 21, 18), [['developpe-couche-barre', [w(8, 60)]]]),
    ]
    const volume = muscleVolume(sessions, byId(), now)
    // Semaines terminées depuis le lundi 5 : 5 et 12 octobre
    expect(volume.averageWeeks).toBe(2)
    const pecs = volume.rows.find((r) => r.muscle === 'pecs')!
    expect(pecs).toEqual({ muscle: 'pecs', week: 1, average: 3 })
    expect(isBehind(pecs)).toBe(true)
    expect(isBehind({ muscle: 'abdos', week: 0, average: 2 })).toBe(false)
    expect(isBehind({ muscle: 'dos', week: 0, average: 12 })).toBe(false)
  })

  it('pas de moyenne avant la première semaine terminée ; exercice sans muscle → « Autre »', () => {
    const exercises = byId()
    exercises.set('perso', { id: 'perso', name: 'Perso', type: 'weight' })
    const volume = muscleVolume([session(new Date(2026, 9, 20, 18), [['perso', [w(10, 20)]]])], exercises, now)
    expect(volume.averageWeeks).toBe(0)
    expect(volume.rows.at(-1)).toEqual({ muscle: 'autre', week: 1, average: null })
  })
})

describe('bilan du mois', () => {
  const empty: MonthlyData = {
    sessions: [],
    exercisesById: byId(),
    activities: [],
    weighIns: [],
    measurements: [],
    photos: [],
    deloadPeriods: [],
  }

  it('régularité, travail, records et progression', () => {
    const sessions = [
      session(new Date(2026, 8, 28, 18), [['developpe-couche-barre', [w(8, 60), w(8, 60)]]]),
      // Octobre : semaine du lundi 5 à 3 séances
      session(new Date(2026, 9, 5, 18), [['developpe-couche-barre', [w(10, 30, true), w(8, 62.5)]]]),
      session(new Date(2026, 9, 7, 18), [['squat', [w(5, 100)]]], { templateId: 'jambes' }),
      session(new Date(2026, 9, 9, 18), [['developpe-couche-barre', [w(8, 65)]]]),
      session(new Date(2026, 10, 2, 18), [['developpe-couche-barre', [w(8, 80)]]]),
    ]
    const review = monthlyReview('2026-10', {
      ...empty,
      sessions,
      activities: [
        { id: '2026-10-08|foot', date: '2026-10-08', type: 'foot' },
        { id: '2026-11-01|tennis', date: '2026-11-01', type: 'tennis' },
      ],
      deloadPeriods: [{ start: '2026-10-26', end: '2026-11-01' }],
    })
    expect(review.sessions).toBe(3)
    expect(review.previousSessions).toBe(1)
    expect(review.byTemplate).toEqual([
      { templateId: 'pecs-triceps', count: 2 },
      { templateId: 'jambes', count: 1 },
    ])
    expect(review).toMatchObject({ foot: 1, tennis: 0, weeksAtTarget: 1, weeks: 4, deloadDays: 6, workSets: 3 })
    expect(review.volume).toBe(8 * 62.5 + 5 * 100 + 8 * 65)
    expect(review.durationMs).toBe(3 * 60 * 60_000)
    expect(review.muscles.get('pecs')).toBe(2)
    // Couché : charge max et 1RM battus (le meilleur du mois est gardé) ; squat : première fois, pas de record
    expect(review.records).toEqual([
      { exerciseId: 'developpe-couche-barre', kind: 'maxKg', value: 65 },
      { exerciseId: 'developpe-couche-barre', kind: 'best1RM', value: 82.33 },
    ])
    expect(review.progress).toHaveLength(1)
    expect(review.progress[0]).toMatchObject({ exerciseId: 'developpe-couche-barre', before: 76, after: 82.33 })
    expect(review.progress[0].gain).toBeCloseTo(0.0833, 3)
  })

  it('corps : poids moyen, mesure du mois et la précédente, photos du mois', () => {
    const review = monthlyReview('2026-10', {
      ...empty,
      weighIns: [
        { date: '2026-09-30', kg: 74 },
        { date: '2026-10-01', kg: 74.4 },
        { date: '2026-10-31', kg: 75 },
      ],
      measurements: [
        { date: '2026-09-01', bras: 35 },
        { date: '2026-10-01', bras: 35.5 },
        { date: '2026-11-01', bras: 36 },
      ],
      photos: [
        { id: 'a', date: '2026-10-02', pose: 'face', dataUrl: '', width: 1, height: 1 },
        { id: 'b', date: '2026-11-02', pose: 'face', dataUrl: '', width: 1, height: 1 },
      ],
    })
    expect(review.weight).toEqual({ start: 74.2, end: 75 })
    expect(review.measurement).toEqual({ latest: { date: '2026-10-01', bras: 35.5 }, previous: { date: '2026-09-01', bras: 35 } })
    expect(review.photos.map((p) => p.id)).toEqual(['a'])
  })

  it('mois vide', () => {
    const review = monthlyReview('2026-10', empty)
    expect(review).toMatchObject({ sessions: 0, records: [], progress: [], weight: null, measurement: null, photos: [] })
  })

  it('noms de mois', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
    expect(ofMonth('2026-10')).toBe('d’octobre')
    expect(ofMonth('2026-09')).toBe('de septembre')
    expect(ofMonth('2026-04')).toBe('d’avril')
  })
})

describe('photos', () => {
  it('réduction à 1280 px sur le côté le plus long, jamais agrandie', () => {
    expect(fitSize(3024, 4032)).toEqual({ width: 960, height: 1280 })
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('taille affichée', () => {
    expect(dataUrlBytes(`data:image/jpeg;base64,${'A'.repeat(400)}`)).toBe(300)
    expect(formatBytes(240_000)).toBe('240 Ko')
    expect(formatBytes(3_140_000)).toBe('3,1 Mo')
  })
})
