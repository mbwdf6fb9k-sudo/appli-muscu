import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { importBackup, parseBackup } from './backup'
import { MuscuDB } from './database'
import { DEFAULT_EXERCISES } from './seed'
import { readSettings } from './settings'

describe('migration v1 → v2', () => {
  it('garde les réglages et ajoute les exercices et modèles par défaut', async () => {
    const name = `migration-${crypto.randomUUID()}`
    // Base telle qu'elle existe sur le téléphone après l'étape 1
    const v1 = new Dexie(name)
    v1.version(1).stores({ settings: 'key' })
    await v1.table('settings').bulkPut([
      { key: 'theme', value: 'light' },
      { key: 'lastExportAt', value: '2026-10-20T10:00:00.000Z' },
    ])
    v1.close()

    const v2 = new MuscuDB(name)
    const settings = await readSettings(v2)
    expect(settings.theme).toBe('light')
    expect(settings.lastExportAt).toBe('2026-10-20T10:00:00.000Z')
    expect(await v2.exercises.count()).toBe(DEFAULT_EXERCISES.length)
    expect((await v2.templates.get('dos-biceps'))?.exerciseIds[0]).toBe('tractions')
    expect((await v2.exercises.get('tractions'))?.type).toBe('bodyweight')
    expect((await v2.exercises.get('gainage'))?.type).toBe('duration')
    expect((await v2.exercises.get('squat'))?.type).toBe('weight')
    await v2.delete()
  })

  it('une base neuve est remplie directement', async () => {
    const fresh = new MuscuDB(`neuve-${crypto.randomUUID()}`)
    expect(await fresh.templates.count()).toBe(5)
    expect((await fresh.templates.get('abdos'))?.exerciseIds).toEqual([
      'crunch-poulie',
      'releves-de-jambes-suspendu',
      'roue-abdominale',
      'gainage',
    ])
    await fresh.delete()
  })

  it('un export de l’étape 1 (v1) s’importe avec les exercices par défaut', async () => {
    const database = new MuscuDB(`import-v1-${crypto.randomUUID()}`)
    const oldExport = JSON.stringify({
      app: 'appli-muscu',
      schemaVersion: 1,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [{ key: 'theme', value: 'light' }] },
    })
    await importBackup(database, parseBackup(oldExport))
    expect((await readSettings(database)).theme).toBe('light')
    expect(await database.exercises.count()).toBe(DEFAULT_EXERCISES.length)
    expect(await database.sessions.count()).toBe(0)
    await database.delete()
  })
})

describe('exercices pré-remplis', () => {
  it('ont tous un identifiant unique', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
