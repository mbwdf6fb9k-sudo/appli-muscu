import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { BackupError, exportBackup, importBackup, migrateBackup, parseBackup, type BackupFile } from './backup'
import { MuscuDB, SCHEMA_VERSION } from './database'
import { readSettings, setSetting } from './settings'

const databases: MuscuDB[] = []
function freshDb(): MuscuDB {
  const database = new MuscuDB(`test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

afterEach(async () => {
  for (const database of databases.splice(0)) await database.delete()
})

describe('sauvegarde', () => {
  it('le schéma déclaré correspond à SCHEMA_VERSION', async () => {
    const database = freshDb()
    await database.open()
    expect(database.verno).toBe(SCHEMA_VERSION)
  })

  it('export puis import redonne exactement les mêmes données', async () => {
    const source = freshDb()
    await setSetting('theme', 'light', source)
    await setSetting('firstLaunchAt', '2026-10-01T08:00:00.000Z', source)

    const backup = await exportBackup(source, new Date('2026-10-22T10:00:00.000Z'))
    const text = JSON.stringify(backup)

    const target = freshDb()
    await setSetting('theme', 'dark', target)
    await importBackup(target, parseBackup(text))

    const settings = await readSettings(target)
    expect(settings.theme).toBe('light')
    expect(settings.firstLaunchAt).toBe('2026-10-01T08:00:00.000Z')
    expect(settings.lastExportAt).toBe('2026-10-22T10:00:00.000Z')
  })

  it.each([
    ['du texte qui n’est pas du JSON', 'coucou'],
    ['un JSON d’une autre appli', JSON.stringify({ app: 'autre', schemaVersion: 1, exportedAt: '2026-10-22', tables: {} })],
    ['des tables mal formées', JSON.stringify({ app: 'appli-muscu', schemaVersion: 1, exportedAt: '2026-10-22', tables: { settings: 'x' } })],
    ['une date invalide', JSON.stringify({ app: 'appli-muscu', schemaVersion: 1, exportedAt: 'hier', tables: {} })],
  ])('refuse %s', (_label, text) => {
    expect(() => parseBackup(text)).toThrow(BackupError)
  })

  it('refuse une sauvegarde d’une version plus récente sans toucher aux données', async () => {
    const database = freshDb()
    await setSetting('theme', 'light', database)
    const future: BackupFile = {
      app: 'appli-muscu',
      schemaVersion: SCHEMA_VERSION + 1,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [] },
    }
    await expect(importBackup(database, future)).rejects.toThrow(BackupError)
    expect((await readSettings(database)).theme).toBe('light')
  })

  it('un import qui échoue en cours de route ne laisse rien à moitié', async () => {
    const database = freshDb()
    await setSetting('theme', 'light', database)
    const broken: BackupFile = {
      app: 'appli-muscu',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-10-22T10:00:00.000Z',
      // Deux lignes avec la même clé : l'ajout échoue
      tables: { settings: [{ key: 'theme', value: 'dark' }, { key: 'theme', value: 'dark' }] },
    }
    await expect(importBackup(database, broken)).rejects.toThrow()
    expect((await readSettings(database)).theme).toBe('light')
  })

  it('migrateBackup garde une sauvegarde déjà à jour', () => {
    const backup: BackupFile = {
      app: 'appli-muscu',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [{ key: 'theme', value: 'dark' }] },
    }
    expect(migrateBackup(backup)).toEqual(backup)
  })
})
