import { describe, expect, it } from 'vitest'
import type { Session, SetEntry } from '../db/database'
import { formatSetsLine, formatSeconds, parseNumber } from './format'
import { prefillNextSet } from './prefill'
import { computeBests, epley1RM, findBrokenRecords, liveRecords } from './records'
import { sessionStats } from './sessionStats'

const at = '2026-10-22T18:00:00.000Z'
const w = (reps: number, kg: number): SetEntry => ({ reps, kg, at })
const d = (seconds: number): SetEntry => ({ seconds, at })

describe('1RM d’Epley', () => {
  it('calcule kg × (1 + reps / 30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley1RM(60, 1)).toBe(62)
  })

  it('ignore les séries de plus de 12 reps', () => {
    expect(epley1RM(40, 13)).toBeUndefined()
    expect(epley1RM(40, 12)).toBeCloseTo(56)
  })
})

describe('records', () => {
  it('charge max et 1RM pour la charge × reps', () => {
    expect(computeBests('weight', [w(10, 60), w(3, 70), w(15, 50)])).toEqual({
      maxKg: 70,
      best1RM: 80, // 60 × (1 + 10/30) = 80 > 70 × 1,1 = 77
    })
  })

  it('aucun record la première fois', () => {
    expect(findBrokenRecords('weight', [], [w(10, 60)])).toEqual([])
  })

  it('détecte une charge max battue', () => {
    const broken = findBrokenRecords('weight', [w(10, 60)], [w(5, 65)])
    expect(broken.map((r) => r.kind)).toEqual(['maxKg'])
    expect(broken[0]).toMatchObject({ value: 65, previous: 60 })
  })

  it('poids du corps : reps max et premier lest', () => {
    const broken = findBrokenRecords('bodyweight', [w(8, 0), w(10, 0)], [w(11, 0), w(6, 5)])
    expect(broken).toEqual([
      { kind: 'maxReps', value: 11, previous: 10 },
      { kind: 'maxLest', value: 5, previous: 0 },
    ])
  })

  it('gainage : meilleure durée', () => {
    expect(findBrokenRecords('duration', [d(45)], [d(40), d(60)])).toEqual([
      { kind: 'maxSeconds', value: 60, previous: 45 },
    ])
  })

  it('égaler un record ne compte pas', () => {
    expect(findBrokenRecords('weight', [w(10, 60)], [w(10, 60)])).toEqual([])
  })
})

describe('records en direct (pendant la séance)', () => {
  it('chaque série est comparée à l’historique et aux séries précédentes du jour', () => {
    const records = liveRecords('weight', [w(10, 60)], [w(10, 60), w(8, 65), w(8, 65), w(6, 70)])
    // 60 : égal (rien) · 65 : record · 65 encore : égal à la série d'avant (rien) · 70 : nouveau record
    expect([...records.keys()]).toEqual([1, 3])
    expect(records.get(3)?.find((r) => r.kind === 'maxKg')).toEqual({ kind: 'maxKg', value: 70, previous: 65 })
  })

  it('rien la première fois qu’on fait l’exercice, même si la 2e série est plus lourde', () => {
    expect(liveRecords('weight', [], [w(10, 60), w(10, 80)]).size).toBe(0)
  })

  it('poids du corps et gainage', () => {
    expect([...liveRecords('bodyweight', [w(10, 0)], [w(9, 0), w(11, 0)]).keys()]).toEqual([1])
    expect([...liveRecords('duration', [d(60)], [d(45), d(75)]).keys()]).toEqual([1])
  })

  it('corriger une série recalcule les records', () => {
    expect(liveRecords('weight', [w(10, 60)], [w(10, 62.5)]).size).toBe(1)
    expect(liveRecords('weight', [w(10, 60)], [w(10, 57.5)]).size).toBe(0)
  })
})

describe('statistiques de séance', () => {
  it('durée, séries et volume (lest seulement au poids du corps, pas de gainage)', () => {
    const session: Session = {
      id: 's',
      templateId: 'dos-biceps',
      date: '2026-10-22',
      startedAt: '2026-10-22T18:00:00.000Z',
      endedAt: '2026-10-22T19:05:00.000Z',
      status: 'done',
      exerciseIds: [],
      exercises: [
        { exerciseId: 'tractions', type: 'bodyweight', note: '', sets: [w(10, 0), w(8, 10)] },
        { exerciseId: 'rowing-barre', type: 'weight', note: '', sets: [w(10, 60)] },
        { exerciseId: 'gainage', type: 'duration', note: '', sets: [d(60)] },
      ],
    }
    expect(sessionStats(session)).toEqual({ durationMs: 65 * 60_000, setCount: 4, volume: 80 + 600 })
  })
})

describe('pré-remplissage', () => {
  const last = [w(10, 60), w(8, 65), w(6, 70)]

  it('1re série = 1re série de la dernière fois', () => {
    expect(prefillNextSet('weight', [], last)).toEqual({ reps: 10, kg: 60 })
  })

  it('suit la dernière fois tant qu’on la refait à l’identique', () => {
    expect(prefillNextSet('weight', [w(10, 60)], last)).toEqual({ reps: 8, kg: 65 })
  })

  it('reprend la dernière série du jour dès qu’on s’en écarte', () => {
    expect(prefillNextSet('weight', [w(10, 62.5)], last)).toEqual({ reps: 10, kg: 62.5 })
  })

  it('valeurs par défaut la première fois', () => {
    expect(prefillNextSet('weight', [], [])).toEqual({ reps: 10, kg: 20 })
    expect(prefillNextSet('duration', [], [])).toEqual({ seconds: 30 })
  })
})

describe('affichage', () => {
  it('formate une ligne de séries', () => {
    expect(formatSetsLine('weight', [w(10, 60), w(8, 62.5)])).toBe('10 × 60 · 8 × 62,5 kg')
    expect(formatSetsLine('bodyweight', [w(10, 0), w(8, 0)])).toBe('10 · 8 reps')
    expect(formatSetsLine('duration', [d(45), d(75)])).toBe('45 s · 1 min 15')
    expect(formatSeconds(120)).toBe('2 min')
  })

  it('lit les nombres tapés avec une virgule', () => {
    expect(parseNumber('62,5')).toBe(62.5)
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
  })
})
