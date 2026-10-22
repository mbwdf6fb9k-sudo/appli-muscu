import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { importBackup, parseBackup } from '../db/backup'
import { MuscuDB, type Day, type Session } from '../db/database'
import { DEFAULT_SUPPLEMENTS } from '../db/seed'
import { buildSchedule, dayType, formatHour, isLateSession, minutesBefore } from './supplements'

const names = (groups: ReturnType<typeof buildSchedule>) =>
  groups.map((g) => `${g.label}${g.time ? ` (${g.time})` : ''} : ${g.items.map((s) => s.name).join(', ')}`)

describe('type de journée', () => {
  const session = { templateId: 'jambes', startedAt: '2026-10-22T08:00:00.000Z' } as Session
  const day = (choice: Day['choice']): Day => ({ date: '2026-10-22', choice })

  it('séance choisie → entraînement', () => {
    expect(dayType(day('pecs-triceps'), [])).toEqual({ type: 'training', templateId: 'pecs-triceps' })
  })
  it('séance faite sans choix (ou malgré « repos ») → entraînement', () => {
    expect(dayType(null, [session])).toEqual({ type: 'training', templateId: 'jambes' })
    expect(dayType(day('repos'), [session])).toEqual({ type: 'training', templateId: 'jambes' })
  })
  it('repos choisi ou rien → repos', () => {
    expect(dayType(day('repos'), []).type).toBe('rest')
    expect(dayType(null, []).type).toBe('rest')
  })
})

describe('planning du jour', () => {
  it('jour d’entraînement avec séance à 18 h (cahier des charges)', () => {
    expect(names(buildSchedule(DEFAULT_SUPPLEMENTS, 'training', '18:00'))).toEqual([
      'Petit-déjeuner : Bion 3',
      'Déjeuner : Vitamine D3, Oméga 3',
      '~45 min avant la séance (17:15) : Collagène + vitamine C',
      '20-30 min avant la séance (17:30) : Préworkout',
      'Pendant la séance : BCAA',
      'Après la séance : Créatine',
      'Coucher : Magnésium bisglycinate, Ashwagandha KSM-66',
    ])
  })

  it('sans heure de séance : pas d’heure précise', () => {
    expect(buildSchedule(DEFAULT_SUPPLEMENTS, 'training').every((g) => g.time === null)).toBe(true)
  })

  it('jour de repos (cahier des charges)', () => {
    expect(names(buildSchedule(DEFAULT_SUPPLEMENTS, 'rest', '18:00'))).toEqual([
      'Petit-déjeuner : Bion 3, Collagène + vitamine C',
      'Déjeuner : Vitamine D3, Oméga 3, Créatine',
      'Coucher : Magnésium bisglycinate, Ashwagandha KSM-66',
    ])
  })

  it('la créatine est prise tous les jours', () => {
    const creatine = DEFAULT_SUPPLEMENTS.find((s) => s.name === 'Créatine')!
    expect(creatine.training).not.toBeNull()
    expect(creatine.rest).not.toBeNull()
  })
})

describe('heures et avertissement', () => {
  it('calcule l’heure avant la séance', () => {
    expect(minutesBefore('18:00', 45)).toBe('17:15')
    expect(minutesBefore('00:20', 45)).toBe('23:35')
    expect(formatHour('17:15')).toBe('17 h 15')
    expect(formatHour('09:00')).toBe('9 h')
  })

  it('avertissement caféine seulement après 18 h', () => {
    expect(isLateSession('18:00')).toBe(false)
    expect(isLateSession('18:30')).toBe(true)
    expect(isLateSession('07:00')).toBe(false)
    expect(isLateSession(undefined)).toBe(false)
  })
})

describe('cases à cocher', () => {
  it('une case par complément et par jour : demain repart à zéro', async () => {
    const db = new MuscuDB(`cases-${crypto.randomUUID()}`)
    const toggle = async (date: string, id: string) => {
      const key = `${date}|${id}`
      if (await db.intakes.get(key)) await db.intakes.delete(key)
      else await db.intakes.add({ id: key, date, supplementId: id, at: '' })
    }
    await toggle('2026-10-22', 'creatine')
    await toggle('2026-10-22', 'bion-3')
    await toggle('2026-10-22', 'bion-3') // décoché
    expect((await db.intakes.where('date').equals('2026-10-22').toArray()).map((i) => i.supplementId)).toEqual(['creatine'])
    expect(await db.intakes.where('date').equals('2026-10-23').count()).toBe(0)
    await db.delete()
  })
})

describe('migration v3 → v4', () => {
  it('ajoute les 9 compléments sans toucher aux séances ni aux pesées', async () => {
    const name = `v3-${crypto.randomUUID()}`
    const v3 = new Dexie(name)
    v3.version(1).stores({ settings: 'key' })
    v3.version(2).stores({
      exercises: 'id, name',
      templates: 'id',
      days: 'date',
      sessions: 'id, status, date, templateId, startedAt, *exerciseIds',
    })
    v3.version(3).stores({ weighIns: 'date' })
    await v3.table('sessions').put({ id: 's1', status: 'done', exerciseIds: [] })
    await v3.table('weighIns').put({ date: '2026-10-22', kg: 74 })
    v3.close()

    const v4 = new MuscuDB(name)
    expect(await v4.sessions.count()).toBe(1)
    expect(await v4.weighIns.get('2026-10-22')).toEqual({ date: '2026-10-22', kg: 74 })
    expect(await v4.supplements.count()).toBe(9)
    expect((await v4.supplements.get('preworkout'))?.caffeine).toBe(true)
    await v4.delete()
  })

  it('un export de l’étape 4 (v3) s’importe avec les compléments par défaut', async () => {
    const database = new MuscuDB(`import-v3-${crypto.randomUUID()}`)
    const v3Export = JSON.stringify({
      app: 'appli-muscu',
      schemaVersion: 3,
      exportedAt: '2026-10-22T10:00:00.000Z',
      tables: { settings: [], weighIns: [{ date: '2026-10-22', kg: 74 }] },
    })
    await importBackup(database, parseBackup(v3Export))
    expect(await database.weighIns.count()).toBe(1)
    expect(await database.supplements.count()).toBe(9)
    expect(await database.intakes.count()).toBe(0)
    await database.delete()
  })
})
