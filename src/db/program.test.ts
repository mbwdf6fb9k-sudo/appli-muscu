import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { importBackup, parseBackup } from './backup'
import { MuscuDB } from './database'
import { applyProgram } from './program'
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from './seed'

describe('programme personnel', () => {
  const { exercises, templates } = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
  const tpl = (id: string) => templates.find((t) => t.id === id)!
  const name = (id: string) => exercises.find((e) => e.id === id)?.name

  it('les 4 séances du fichier, dans l’ordre', () => {
    expect(tpl('dos-biceps').exerciseIds.map(name)).toEqual([
      'Tractions',
      'Rowing poitrine appuyée, coudes serrés',
      'Tirage horizontal, prise large, coudes ouverts',
      'Pull-over à la poulie, bras tendus',
      'Curl incliné haltères',
      'Curl marteau',
    ])
    expect(tpl('pecs-triceps').exerciseIds).toHaveLength(6)
    expect(tpl('jambes').exerciseIds.map(name)).toEqual([
      'Hack squat',
      'Soulevé de terre roumain haltères',
      'Leg curl assis',
      'Leg extension',
      'Mollets à la presse',
      'Tirage vertical unilatéral à la poulie',
      'Élévations latérales à la poulie',
    ])
    expect(tpl('bras').exerciseIds).toHaveLength(6)
    expect(tpl('jambes').name).toBe('Jambes + rappel dos et épaules')
    expect(tpl('bras').duration).toBe('≈ 55 min')
  })

  it('objectifs, supersets et abdos', () => {
    expect(tpl('dos-biceps').targets?.tractions).toEqual({ sets: 3, min: 5, max: 10, rir: '1-2', rest: '2-3 min' })
    expect(tpl('bras').targets?.['curl-barre-ez']?.superset).toBe('A')
    expect(tpl('bras').targets?.['barre-au-front']?.superset).toBe('A')
    expect(tpl('bras').targets?.['extension-triceps-poulie']).toMatchObject({ superset: 'B', sets: 2, min: 12, max: 15 })
    expect(tpl('abdos').targets?.gainage).toEqual({ sets: 2, min: 30, max: 60 })
  })

  it('consignes et exercices qui sortent des modèles', () => {
    expect(exercises.find((e) => e.id === 'hack-squat')?.tips?.replacement).toBe('Presse à cuisses.')
    for (const id of ['squat', 'presse-a-cuisses', 'dips', 'face-pull', 'developpe-militaire-halteres']) {
      expect(exercises.some((e) => e.id === id)).toBe(true)
      expect(templates.some((t) => t.exerciseIds.includes(id))).toBe(false)
    }
  })

  it('peut être rejoué sans doublon et garde les exercices perso', () => {
    const perso = { id: 'perso', name: 'Mon exercice', type: 'weight' as const }
    const once = applyProgram([...structuredClone(DEFAULT_EXERCISES), perso], structuredClone(DEFAULT_TEMPLATES))
    const twice = applyProgram(once.exercises, once.templates)
    expect(twice.exercises).toHaveLength(DEFAULT_EXERCISES.length + 6)
    expect(twice.templates).toHaveLength(5)
    expect(twice.exercises.find((e) => e.id === 'perso')).toEqual(perso)
  })
})

describe('migration v4 → v5', () => {
  it('applique le programme sans toucher aux séances, pesées et compléments', async () => {
    const name = `v4-${crypto.randomUUID()}`
    const v4 = new Dexie(name)
    v4.version(1).stores({ settings: 'key' })
    v4.version(2).stores({
      exercises: 'id, name',
      templates: 'id',
      days: 'date',
      sessions: 'id, status, date, templateId, startedAt, *exerciseIds',
    })
    v4.version(3).stores({ weighIns: 'date' })
    v4.version(4).stores({ supplements: 'id, order', intakes: 'id, date, supplementId' })
    await v4.table('exercises').bulkPut(structuredClone(DEFAULT_EXERCISES))
    await v4.table('templates').bulkPut(structuredClone(DEFAULT_TEMPLATES))
    await v4.table('sessions').put({ id: 's1', status: 'done', exerciseIds: ['leg-curl'], exercises: [] })
    await v4.table('weighIns').put({ date: '2026-10-22', kg: 74 })
    await v4.table('supplements').put({ id: 'zinc', name: 'Zinc', training: 'dinner', rest: 'dinner', order: 9 })
    v4.close()

    const v5 = new MuscuDB(name)
    expect(await v5.sessions.count()).toBe(1)
    expect(await v5.weighIns.count()).toBe(1)
    expect((await v5.supplements.get('zinc'))?.name).toBe('Zinc')
    // Même id, nouveau nom : l'historique du leg curl suit
    expect((await v5.exercises.get('leg-curl'))?.name).toBe('Leg curl assis')
    // Ouvert avec la dernière version : le modèle Jambes de l'étape 11 commence par la presse
    expect((await v5.templates.get('jambes'))?.exerciseIds[0]).toBe('presse-a-cuisses')
    await v5.delete()
  })

  it('une base neuve reçoit directement le programme', async () => {
    const fresh = new MuscuDB(`neuve-v5-${crypto.randomUUID()}`)
    expect((await fresh.templates.get('bras'))?.name).toBe('Bras + épaules')
    expect((await fresh.exercises.get('mollets-presse'))?.name).toBe('Mollets à la presse')
    await fresh.delete()
  })

  it('un export de l’étape 6 (v4) s’importe avec le programme', async () => {
    const database = new MuscuDB(`import-v4-${crypto.randomUUID()}`)
    const v4Export = JSON.stringify({
      app: 'appli-muscu',
      schemaVersion: 4,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [], exercises: DEFAULT_EXERCISES, templates: DEFAULT_TEMPLATES, sessions: [] },
    })
    await importBackup(database, parseBackup(v4Export))
    expect((await database.templates.get('pecs-triceps'))?.targets?.['developpe-couche-barre']?.rir).toBe('2')
    await database.delete()
  })
})
