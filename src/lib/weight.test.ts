import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { importBackup, parseBackup } from '../db/backup'
import { MuscuDB } from '../db/database'
import { filterRange, movingAverage, proteinRange, weightSummary } from './weight'

describe('moyenne glissante sur 7 jours', () => {
  it('moyenne des pesées du jour et des 6 jours précédents', () => {
    const points = movingAverage([
      { date: '2026-10-01', kg: 74 },
      { date: '2026-10-02', kg: 75 },
      { date: '2026-10-04', kg: 76 }, // jour manquant le 3 : ignoré
      { date: '2026-10-08', kg: 77 }, // fenêtre du 2 au 8
      { date: '2026-10-20', kg: 78 }, // seule dans sa fenêtre
    ])
    expect(points.map((p) => p.average)).toEqual([74, 74.5, 75, 76, 78])
  })

  it('trie les pesées par date', () => {
    expect(movingAverage([{ date: '2026-10-02', kg: 76 }, { date: '2026-10-01', kg: 74 }]).map((p) => p.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
    ])
  })

  it('passe le changement d’heure sans décalage', () => {
    const points = movingAverage([
      { date: '2026-10-19', kg: 74 },
      { date: '2026-10-26', kg: 76 }, // 7 jours plus tard (heure d'hiver le 25) : hors fenêtre
    ])
    expect(points[1].average).toBe(76)
  })
})

describe('résumé du poids', () => {
  const weighIns = [
    { date: '2026-10-20', kg: 74.4 },
    { date: '2026-10-21', kg: 74.8 },
    { date: '2026-10-22', kg: 74.6 },
  ]

  it('écart depuis le départ et reste à faire', () => {
    expect(weightSummary(weighIns, { startWeight: 74, targetWeight: 80 })).toEqual({
      current: 74.6,
      currentDate: '2026-10-22',
      sinceStart: 0.6,
      onTrack: true,
      toTarget: 5.4,
    })
  })

  it('sans poids visé, une hausse va dans le sens de la prise de muscle', () => {
    expect(weightSummary(weighIns, { startWeight: 75, targetWeight: null })?.onTrack).toBe(false)
    expect(weightSummary(weighIns, { startWeight: 74, targetWeight: null })?.toTarget).toBeNull()
  })

  it('rien sans pesée', () => {
    expect(weightSummary([], { startWeight: 74, targetWeight: null })).toBeNull()
  })
})

describe('protéines visées', () => {
  it('1,6 à 2 g par kg, arrondi à 5 g', () => {
    expect(proteinRange(74)).toEqual({ low: 120, high: 150 })
    expect(proteinRange(80)).toEqual({ low: 130, high: 160 })
  })
})

describe('période affichée', () => {
  it('garde les 31 derniers jours pour « 1 mois »', () => {
    const points = [{ date: '2026-09-21' }, { date: '2026-09-22' }, { date: '2026-10-22' }]
    expect(filterRange(points, '1m', '2026-10-22').map((p) => p.date)).toEqual(['2026-09-22', '2026-10-22'])
  })
})

describe('migration v2 → v3', () => {
  it('ajoute les pesées sans toucher aux séances', async () => {
    const name = `v2-${crypto.randomUUID()}`
    // Base telle qu'elle existe sur le téléphone après l'étape 3
    const v2 = new Dexie(name)
    v2.version(1).stores({ settings: 'key' })
    v2.version(2).stores({
      exercises: 'id, name',
      templates: 'id',
      days: 'date',
      sessions: 'id, status, date, templateId, startedAt, *exerciseIds',
    })
    await v2.table('sessions').put({ id: 's1', status: 'done', date: '2026-10-22', templateId: 'bras', startedAt: '2026-10-22T18:00:00.000Z', exerciseIds: ['shrugs'], exercises: [] })
    await v2.table('settings').put({ key: 'theme', value: 'light' })
    v2.close()

    const v3 = new MuscuDB(name)
    expect(await v3.sessions.count()).toBe(1)
    expect((await v3.settings.get('theme'))?.value).toBe('light')
    expect(await v3.weighIns.count()).toBe(0)
    await v3.weighIns.put({ date: '2026-10-22', kg: 74.3 })
    await v3.weighIns.put({ date: '2026-10-22', kg: 74.1 }) // la dernière remplace
    expect(await v3.weighIns.toArray()).toEqual([{ date: '2026-10-22', kg: 74.1 }])
    await v3.delete()
  })

  it('un export de l’étape 3 (v2) s’importe', async () => {
    const database = new MuscuDB(`import-v2-${crypto.randomUUID()}`)
    const v2Export = JSON.stringify({
      app: 'appli-muscu',
      schemaVersion: 2,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [], exercises: [], templates: [], days: [], sessions: [{ id: 's1', status: 'done', exerciseIds: [] }] },
    })
    await importBackup(database, parseBackup(v2Export))
    expect(await database.sessions.count()).toBe(1)
    expect(await database.weighIns.count()).toBe(0)
    await database.delete()
  })
})
