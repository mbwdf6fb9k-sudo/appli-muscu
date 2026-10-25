import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup, parseBackup } from '../db/backup'
import { MuscuDB, type Exercise, type Session, type SetEntry, type Template } from '../db/database'
import { applyExerciseDefaults, applyMuscleDefaults, applyProgram } from '../db/program'
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from '../db/seed'
import { readSettings } from '../db/settings'
import {
  BARBELL_SESSION,
  INCLINE_BARBELL,
  LATERAL_MACHINE,
  PULLOVER_MACHINE,
  WIDE_CHEST_PRESS,
  applyStep11,
} from '../db/step11'
import { exerciseStagnates } from './stagnation'

const w = (reps: number, kg: number, extra: Partial<SetEntry> = {}): SetEntry => ({ reps, kg, at: '', ...extra })

/** Données comme l'export du 25/10 : base v7 avec 3 exercices créés dans l'appli, sans groupe. */
function v7Data() {
  const program = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
  const exercises: Exercise[] = [
    ...applyMuscleDefaults(applyExerciseDefaults(program.exercises)),
    { id: PULLOVER_MACHINE, name: 'pull-over machine', type: 'weight' },
    { id: WIDE_CHEST_PRESS, name: 'wide chest press', type: 'weight' },
    { id: LATERAL_MACHINE, name: 'élévation latérale machine', type: 'weight' },
  ]
  const templates: Template[] = program.templates.map((t) => {
    // Comme sur le téléphone : couché et élévations poulie remplacés par les exercices créés
    if (t.id === 'pecs-triceps') {
      return {
        ...t,
        exerciseIds: [
          'developpe-incline-halteres',
          WIDE_CHEST_PRESS,
          'ecarte-poulie-vis-a-vis',
          LATERAL_MACHINE,
          'extension-triceps-au-dessus-de-la-tete',
          'extension-triceps-poulie-haute-corde',
        ],
      }
    }
    if (t.id === 'jambes') return { ...t, exerciseIds: ['hack-squat', 'presse-a-cuisses', 'leg-curl', 'leg-extension', 'tirage-vertical-unilateral', LATERAL_MACHINE] }
    return t
  })
  const session = (id: string, templateId: Session['templateId'], date: string, exercises: [string, SetEntry[], string?][]): Session => ({
    id,
    templateId,
    date,
    startedAt: `${date}T16:00:00.000Z`,
    endedAt: `${date}T17:05:00.000Z`,
    status: 'done',
    exercises: exercises.map(([exerciseId, sets, note]) => ({ exerciseId, type: 'weight', sets, note: note ?? '' })),
    exerciseIds: exercises.map(([id]) => id),
  })
  const sessions = [
    session(BARBELL_SESSION, 'pecs-triceps', '2026-10-24', [
      ['developpe-incline-halteres', [w(8, 20, { warmup: true }), w(10, 40), w(7, 40), w(5, 45)]],
      [WIDE_CHEST_PRESS, [w(10, 50), w(9, 50), w(8, 50)]],
      [LATERAL_MACHINE, [w(15, 20), w(14, 20), w(12, 20)], 'multi flight'],
    ]),
    session('5d4e023b-b312-4cb6-a780-edc031d9fad0', 'dos-biceps', '2026-10-24', [[PULLOVER_MACHINE, [w(12, 40), w(12, 40)]]]),
    session('3748700e-6486-453c-a6a1-f731cbb1a9a1', 'jambes', '2026-10-25', [
      ['hack-squat', [w(10, 60), w(10, 60), w(9, 60)]],
      ['presse-a-cuisses', [w(12, 120), w(12, 120)]],
    ]),
  ]
  return { exercises, templates, sessions }
}

async function createV7(name: string) {
  const v7 = new Dexie(name)
  v7.version(1).stores({ settings: 'key' })
  v7.version(2).stores({ exercises: 'id, name', templates: 'id', days: 'date', sessions: 'id, status, date, templateId, startedAt, *exerciseIds' })
  v7.version(3).stores({ weighIns: 'date' })
  v7.version(4).stores({ supplements: 'id, order', intakes: 'id, date, supplementId' })
  v7.version(5).stores({})
  v7.version(6).stores({ activities: 'id, date' })
  v7.version(7).stores({ measurements: 'date', photos: 'id, date' })
  const data = v7Data()
  await v7.table('exercises').bulkPut(data.exercises)
  await v7.table('templates').bulkPut(data.templates)
  await v7.table('sessions').bulkPut(data.sessions)
  await v7.table('weighIns').bulkPut([{ date: '2026-10-23', kg: 74 }, { date: '2026-10-24', kg: 75 }])
  await v7.table('activities').bulkPut([{ id: '2026-10-24|tennis', date: '2026-10-24', type: 'tennis' }])
  await v7.table('photos').put({ id: 'p', date: '2026-10-24', pose: 'face', dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1 })
  await v7.table('supplements').put({ id: 'creatine', name: 'Créatine', training: 'after', rest: 'lunch', order: 6 })
  await v7.table('settings').bulkPut([{ key: 'theme', value: 'dark' }, { key: 'featureStartAt', value: '2026-10-23T15:53:30.686Z' }])
  v7.close()
  return data
}

describe('migration v7 → v8', () => {
  it('ne perd rien et applique les changements de l’étape 11', async () => {
    const name = `v7-${crypto.randomUUID()}`
    const before = await createV7(name)
    const db = new MuscuDB(name)

    // Rien de perdu
    expect(await db.sessions.count()).toBe(3)
    expect(await db.weighIns.count()).toBe(2)
    expect(await db.activities.count()).toBe(1)
    expect(await db.photos.count()).toBe(1)
    expect((await db.supplements.get('creatine'))?.name).toBe('Créatine')
    expect(await readSettings(db)).toMatchObject({ theme: 'dark', featureStartAt: '2026-10-23T15:53:30.686Z', footDays: [] })
    const untouched = before.sessions[1]
    expect(await db.sessions.get(untouched.id)).toEqual(untouched)

    // Exercices : mêmes identifiants, renommés et classés
    expect(await db.exercises.get(PULLOVER_MACHINE)).toMatchObject({ name: 'Pull-over machine', muscle: 'dos', step: 2.5 })
    expect((await db.exercises.get(PULLOVER_MACHINE))?.compound).toBeUndefined()
    expect(await db.exercises.get(WIDE_CHEST_PRESS)).toMatchObject({ name: 'Wide chest press', muscle: 'pecs', compound: true, step: 2.5 })
    expect(await db.exercises.get(LATERAL_MACHINE)).toMatchObject({ name: 'Élévations latérales machine', muscle: 'epaules', step: 2.5 })
    expect((await db.exercises.get(WIDE_CHEST_PRESS))?.tips?.replacement).toBe('Développé couché barre.')
    expect((await db.exercises.get('hip-thrust'))?.muscle).toBe('fessiers')
    expect((await db.exercises.get('presse-a-cuisses'))?.tips?.replacement).toBe('Hack squat.')
    expect(await db.exercises.get(INCLINE_BARBELL)).toMatchObject({ name: 'Développé incliné barre', muscle: 'pecs', compound: true, step: 2.5 })
    // Les exercices retirés des modèles restent dans la liste
    expect((await db.exercises.get('hack-squat'))?.hidden).toBeUndefined()
    expect((await db.exercises.get('pull-over-poulie'))?.hidden).toBeUndefined()

    // Modèles
    const dos = (await db.templates.get('dos-biceps'))!
    expect(dos.exerciseIds[3]).toBe(PULLOVER_MACHINE)
    expect(dos.exerciseIds).not.toContain('pull-over-poulie')
    expect(dos.targets?.[PULLOVER_MACHINE]).toEqual({ sets: 2, min: 12, max: 15, rir: '0-1', rest: '1-1,5 min' })
    const pecs = (await db.templates.get('pecs-triceps'))!
    expect(pecs.exerciseIds.slice(0, 4)).toEqual([INCLINE_BARBELL, WIDE_CHEST_PRESS, 'ecarte-poulie-vis-a-vis', LATERAL_MACHINE])
    expect(pecs.exerciseIds).toHaveLength(6)
    expect(pecs.targets?.[INCLINE_BARBELL]).toEqual({ sets: 3, min: 6, max: 10, rir: '2', rest: '2-3 min' })
    expect(pecs.targets?.[WIDE_CHEST_PRESS]).toEqual({ sets: 3, min: 6, max: 10, rir: '1-2', rest: '2-3 min' })
    expect(pecs.targets?.[LATERAL_MACHINE]).toEqual({ sets: 3, min: 12, max: 20, rir: '0-1', rest: '1 min' })
    const jambes = (await db.templates.get('jambes'))!
    expect(jambes.exerciseIds).toEqual(['presse-a-cuisses', 'hip-thrust', 'leg-curl', 'leg-extension', 'tirage-vertical-unilateral', LATERAL_MACHINE])
    expect(jambes.targets?.['leg-curl']?.sets).toBe(4)
    expect(jambes.targets?.['hack-squat']).toBeUndefined()
    expect((await db.templates.get('bras'))?.exerciseIds).toEqual(before.templates.find((t) => t.id === 'bras')!.exerciseIds)

    // Historique : séries du développé incliné rattachées à la barre
    const fixed = (await db.sessions.get(BARBELL_SESSION))!
    expect(fixed.exercises[0].exerciseId).toBe(INCLINE_BARBELL)
    expect(fixed.exercises[0].sets).toEqual(before.sessions[0].exercises[0].sets)
    expect(fixed.exerciseIds[0]).toBe(INCLINE_BARBELL)
    expect(await db.sessions.where('exerciseIds').equals('developpe-incline-halteres').count()).toBe(0)
    expect(await db.sessions.where('exerciseIds').equals(INCLINE_BARBELL).count()).toBe(1)
    await db.delete()
  })

  it('peut être appliquée deux fois sans rien changer de plus', () => {
    const once = applyStep11(v7Data())
    expect(applyStep11(structuredClone(once))).toEqual(once)
  })

  it('un export v7 s’importe avec les mêmes changements ; un export v1 aussi', async () => {
    const data = v7Data()
    const database = new MuscuDB(`import-v7-${crypto.randomUUID()}`)
    const file = JSON.stringify({ app: 'appli-muscu', schemaVersion: 7, exportedAt: '2026-10-25T18:00:00.000Z', tables: { settings: [], ...data } })
    await importBackup(database, parseBackup(file))
    expect((await database.exercises.get(WIDE_CHEST_PRESS))?.name).toBe('Wide chest press')
    expect((await database.sessions.get(BARBELL_SESSION))?.exercises[0].exerciseId).toBe(INCLINE_BARBELL)
    expect((await exportBackup(database)).schemaVersion).toBe(8)

    const old = new MuscuDB(`import-v1-${crypto.randomUUID()}`)
    await importBackup(old, parseBackup(JSON.stringify({ app: 'appli-muscu', schemaVersion: 1, exportedAt: '2026-10-01T10:00:00.000Z', tables: { settings: [{ key: 'theme', value: 'light' }] } })))
    expect((await old.templates.get('pecs-triceps'))?.exerciseIds[0]).toBe(INCLINE_BARBELL)
    expect((await old.exercises.get('hip-thrust'))?.muscle).toBe('fessiers')
    await database.delete()
    await old.delete()
  })
})

describe('séries retenues : les N premières séries de travail', () => {
  it('une série en plus ne compte pas dans la stagnation', () => {
    let n = 0
    const s = (sets: SetEntry[]): Session => ({
      id: `s${n}`,
      templateId: 'pecs-triceps',
      date: `2026-10-0${++n}`,
      startedAt: `2026-10-0${n}T16:00:00.000Z`,
      endedAt: null,
      status: 'done',
      exercises: [{ exerciseId: 'x', type: 'weight', sets, note: '', target: { sets: 2, min: 8, max: 12 } }],
      exerciseIds: ['x'],
    })
    // 60 × 10, 10 à chaque fois : une 3e série en plus (60 × 12) ne doit pas compter comme un progrès
    const sessions = [s([w(10, 60), w(10, 60)]), s([w(10, 60), w(9, 60)]), s([w(10, 60), w(10, 60), w(12, 60)]), s([w(9, 60), w(9, 60), w(12, 60)])]
    expect(exerciseStagnates(sessions, 'x')).toBe(true)
  })
})

describe('exercices : création, groupe, fusion', () => {
  it('un exercice créé a toujours un groupe ; changer de groupe recalcule les séries par muscle', async () => {
    const { db } = await import('../db/database')
    const { createExercise, updateExercise, unclassified } = await import('../db/exercises')
    const { muscleVolume } = await import('./muscleVolume')
    await db.delete()
    await db.open()
    const created = await createExercise('Pec deck', 'weight', 'pecs')
    expect((await db.exercises.get(created.id))?.muscle).toBe('pecs')
    expect(unclassified(await db.exercises.toArray())).toEqual([])

    const now = new Date(2026, 9, 22, 20)
    const session: Session = {
      id: 'v',
      templateId: 'pecs-triceps',
      date: '2026-10-21',
      startedAt: new Date(2026, 9, 21, 18).toISOString(),
      endedAt: null,
      status: 'done',
      exercises: [{ exerciseId: created.id, type: 'weight', sets: [w(10, 40), w(10, 40)], note: '' }],
      exerciseIds: [created.id],
    }
    const byId = async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
    const pecs = (v: ReturnType<typeof muscleVolume>) => v.rows.find((r) => r.muscle === 'pecs')!.week
    expect(pecs(muscleVolume([session], await byId(), now))).toBe(2)
    await updateExercise(created.id, { name: 'Pec deck', type: 'weight', muscle: 'epaules' })
    const after = muscleVolume([session], await byId(), now)
    expect(pecs(after)).toBe(0)
    expect(after.rows.find((r) => r.muscle === 'epaules')!.week).toBe(2)
  })

  it('fusionner : historique regroupé, modèles mis à jour, l’autre supprimé', async () => {
    const { db } = await import('../db/database')
    const { mergeExercises } = await import('../db/exercises')
    await db.delete()
    await db.open()
    await db.exercises.bulkPut([
      { id: 'a', name: 'Pec deck', type: 'weight', muscle: 'pecs' },
      { id: 'b', name: 'Butterfly', type: 'weight', muscle: 'pecs' },
    ])
    const base = { templateId: 'pecs-triceps' as const, endedAt: null, status: 'done' as const }
    await db.sessions.bulkPut([
      { ...base, id: 's1', date: '2026-10-20', startedAt: '2026-10-20T16:00:00.000Z', exerciseIds: ['a'], exercises: [{ exerciseId: 'a', type: 'weight', sets: [w(10, 30, { at: '1' })], note: 'siège 3' }] },
      {
        ...base,
        id: 's2',
        date: '2026-10-22',
        startedAt: '2026-10-22T16:00:00.000Z',
        exerciseIds: ['b', 'a'],
        exercises: [
          { exerciseId: 'b', type: 'weight', sets: [w(12, 30, { at: '2' })], note: '' },
          { exerciseId: 'a', type: 'weight', sets: [w(8, 35, { at: '1' })], note: 'lent' },
        ],
      },
    ])
    const pecs = (await db.templates.get('pecs-triceps'))!
    await db.templates.put({ ...pecs, exerciseIds: ['a', ...pecs.exerciseIds], targets: { ...pecs.targets, a: { sets: 3, min: 10, max: 15 } } })
    await db.templates.put({ id: 'bras', name: 'Bras', exerciseIds: ['b', 'a'] })

    await mergeExercises('a', 'b')
    expect(await db.exercises.get('a')).toBeUndefined()
    const s1 = (await db.sessions.get('s1'))!
    expect(s1.exercises[0].exerciseId).toBe('b')
    expect(s1.exerciseIds).toEqual(['b'])
    const s2 = (await db.sessions.get('s2'))!
    expect(s2.exercises).toHaveLength(1)
    expect(s2.exercises[0].sets.map((s) => s.kg)).toEqual([35, 30])
    expect(s2.exercises[0].note).toBe('lent')
    const tpl = (await db.templates.get('pecs-triceps'))!
    expect(tpl.exerciseIds[0]).toBe('b')
    expect(tpl.targets?.b).toEqual({ sets: 3, min: 10, max: 15 })
    expect(tpl.targets?.a).toBeUndefined()
    expect((await db.templates.get('bras'))?.exerciseIds).toEqual(['b'])
    expect(await db.sessions.where('exerciseIds').equals('b').count()).toBe(2)
  })
})

describe('objectif du jour expliqué', () => {
  const target = { sets: 3, min: 8, max: 12 }
  it('les trois règles, le poids du corps, la durée, la première fois et la semaine allégée', async () => {
    const { dailyObjective } = await import('./objective')
    expect(dailyObjective('weight', [w(12, 50), w(12, 50), w(12, 50)], target, 2.5)!.reason).toBe(
      'Dernière fois : 12, 12, 12 à 50 kg → haut de la fourchette atteint sur toutes tes séries : passe à 52,5 kg.',
    )
    expect(dailyObjective('weight', [w(10, 50), w(9, 50), w(8, 50)], target, 2.5)!.reason).toBe(
      'Dernière fois : 10, 9, 8 à 50 kg → même charge, vise 11, 10, 9.',
    )
    expect(dailyObjective('weight', [w(5, 60), w(4, 60), w(4, 60)], { sets: 3, min: 6, max: 10 }, 2.5)!.reason).toBe(
      'Dernière fois : 5, 4, 4 à 60 kg, sous la fourchette (6-10) → baisse à 55 kg pour rester dans la fourchette.',
    )
    expect(dailyObjective('bodyweight', [w(12, 0), w(12, 0), w(12, 0)], target, 2.5)!.reason).toBe(
      'Dernière fois : 12, 12, 12 → ajoute 2,5 kg de lest.',
    )
    const secs = (n: number): SetEntry => ({ seconds: n, at: '' })
    expect(dailyObjective('duration', [secs(60), secs(60)], { sets: 2, min: 30, max: 60 }, 2.5)!.reason).toBe(
      'Dernière fois : 60 s sur toutes les séries → vise 65 s.',
    )
    expect(dailyObjective('weight', [], target, 2.5)!.reason).toMatch(/^Pas encore de séance/)
    expect(dailyObjective('weight', [w(10, 50)], target, 2.5, true)!.reason).toMatch(/^Semaine allégée/)
    // Une série en plus (la 4e) ne compte pas
    expect(dailyObjective('weight', [w(12, 50), w(12, 50), w(12, 50), w(6, 50)], target, 2.5)!.rule).toBe('up')
  })
})

describe('records plus complets', () => {
  it('reps à charge égale ou supérieure, volume de séance ; échauffements et dégressives exclus', async () => {
    const { findBrokenRecords, liveRecords, formatRecord } = await import('./records')
    const before = [w(8, 40), w(6, 45), w(10, 35)]
    const broken = findBrokenRecords('weight', before, [w(10, 40), w(10, 40, { warmup: true }), w(20, 40, { drop: true })])
    const reps = broken.find((r) => r.kind === 'repsAtLoad')!
    expect(reps).toEqual({ kind: 'repsAtLoad', value: 10, previous: 8, load: 40 })
    expect(formatRecord(reps)).toEqual({ value: '10 reps à 40 kg', previous: '8 reps' })
    // Charge jamais soulevée : pas de « reps à charge » (c'est la charge max)
    expect(findBrokenRecords('weight', before, [w(3, 50)]).map((r) => r.kind)).not.toContain('repsAtLoad')
    // Volume : meilleur qu'une séance passée
    const volume = findBrokenRecords('weight', before, [w(8, 40), w(8, 40), w(8, 40)], 900)
    expect(volume.find((r) => r.kind === 'maxVolume')).toEqual({ kind: 'maxVolume', value: 960, previous: 900 })
    expect(formatRecord(volume.find((r) => r.kind === 'maxVolume')!).value).toBe('960 kg')
    // Pendant la séance : la série qui fait dépasser l'ancien volume, une seule fois
    const live = liveRecords('weight', before, [w(8, 40), w(8, 40), w(8, 40), w(8, 40)], 900)
    expect([...live.entries()].filter(([, r]) => r.some((x) => x.kind === 'maxVolume')).map(([i]) => i)).toEqual([2])
  })

  it('records par séance (★ du calendrier, bilan) et dernière note', async () => {
    const { sessionRecords } = await import('./progress')
    const { db } = await import('../db/database')
    const { lastNote } = await import('../db/sessions')
    const s = (id: string, day: number, sets: SetEntry[], note = ''): Session => ({
      id,
      templateId: 'pecs-triceps',
      date: `2026-10-${day}`,
      startedAt: `2026-10-${day}T16:00:00.000Z`,
      endedAt: null,
      status: 'done',
      exercises: [{ exerciseId: 'x', type: 'weight', sets, note }],
      exerciseIds: ['x'],
    })
    const sessions = [s('a', 10, [w(8, 40)], 'siège 4, poulie cran 6'), s('b', 12, [w(8, 40)]), s('c', 14, [w(9, 40), w(8, 40)], '  ')]
    const records = sessionRecords(sessions)
    expect(records.has('a')).toBe(false)
    expect(records.has('b')).toBe(false)
    expect(records.get('c')![0].records.map((r) => r.kind).sort()).toEqual(['best1RM', 'maxVolume', 'repsAtLoad'])

    await db.delete()
    await db.open()
    await db.sessions.bulkPut(sessions)
    expect(await lastNote('x', '2026-10-20T00:00:00.000Z')).toEqual({ note: 'siège 4, poulie cran 6', date: '2026-10-10T16:00:00.000Z' })
    expect(await lastNote('x', '2026-10-05T00:00:00.000Z')).toBeNull()
  })

  it('explication de la stagnation', async () => {
    const { stagnationDetail, describeSets } = await import('./stagnation')
    const s = (day: number, sets: SetEntry[]): Session => ({
      id: `d${day}`,
      templateId: 'pecs-triceps',
      date: `2026-10-${day}`,
      startedAt: `2026-10-${day}T16:00:00.000Z`,
      endedAt: null,
      status: 'done',
      exercises: [{ exerciseId: 'x', type: 'weight', sets, note: '', target: { sets: 3, min: 8, max: 12 } }],
      exerciseIds: ['x'],
    })
    const sessions = [s(10, [w(9, 60), w(9, 60), w(8, 60)]), s(12, [w(8, 60), w(8, 60), w(8, 60)]), s(14, [w(9, 60), w(8, 60), w(7, 60)]), s(16, [w(8, 60), w(8, 60), w(7, 60), w(12, 50)])]
    expect(stagnationDetail(sessions, 'x')).toBe('Pas de progrès depuis 3 séances (60 kg × 8, 8, 7)')
    expect(describeSets('bodyweight', [w(8, 0), w(7, 0)])).toBe('8, 7 reps')
    expect(describeSets('weight', [w(8, 60), w(8, 62.5)])).toBe('8 × 60, 8 × 62,5 kg')
  })
})
