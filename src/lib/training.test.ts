import { describe, expect, it } from 'vitest'
import type { Session, SetEntry } from '../db/database'
import { formatSetsLine, formatSeconds, parseNumber } from './format'
import { prefillNextSet } from './prefill'
import { dailyObjective, warmupSets } from './objective'
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

describe('objectif du jour', () => {
  const target = { sets: 3, min: 8, max: 12, rir: '1' }

  it('règle 1 : toutes les séries au haut de la fourchette → +1 palier, bas de la fourchette', () => {
    const o = dailyObjective('weight', [w(12, 50), w(12, 50), w(12, 50)], target, 2.5)!
    expect(o.rule).toBe('up')
    expect(o.text).toBe('Passe à 52,5 kg, vise 8+')
    expect(o.plan).toEqual([{ reps: 8, kg: 52.5 }, { reps: 8, kg: 52.5 }, { reps: 8, kg: 52.5 }])
  })

  it('règle 2 : au moins la moitié sous le bas → −10 % arrondi au palier', () => {
    const o = dailyObjective('weight', [w(9, 50), w(7, 50), w(6, 50)], target, 2.5)!
    expect(o.rule).toBe('down')
    expect(o.text).toBe('Baisse à 45 kg (−10 %), vise 8-12')
    expect(o.plan[0]).toEqual({ reps: 8, kg: 45 })
    // Haltères (palier 2 kg) : 22 × 0,9 = 19,8 → 20
    expect(dailyObjective('weight', [w(6, 22), w(6, 22), w(9, 22)], target, 2)!.plan[0].kg).toBe(20)
  })

  it('règle 3 : même charge, +1 rep sur les séries pas au haut', () => {
    const o = dailyObjective('weight', [w(10, 50), w(10, 50), w(9, 50)], target, 2.5)!
    expect(o.rule).toBe('same')
    expect(o.text).toBe('Même charge, vise 10-11 reps')
    expect(o.plan).toEqual([{ reps: 11, kg: 50 }, { reps: 11, kg: 50 }, { reps: 10, kg: 50 }])
    // Une série déjà au haut le reste
    expect(dailyObjective('weight', [w(12, 50), w(11, 50), w(11, 50)], target, 2.5)!.plan.map((p) => p.reps)).toEqual([12, 12, 12])
  })

  it('pas assez de séries pour la règle 1 → règle 3', () => {
    expect(dailyObjective('weight', [w(12, 50), w(12, 50)], target, 2.5)!.rule).toBe('same')
  })

  it('les échauffements sont ignorés', () => {
    const sets = [{ ...w(10, 25), warmup: true }, { ...w(5, 35), warmup: true }, w(12, 50), w(12, 50), w(12, 50)]
    expect(dailyObjective('weight', sets, target, 2.5)!.rule).toBe('up')
  })

  it('poids du corps : tout au haut → +2,5 kg de lest ; sans lest, pas de baisse', () => {
    const t = { sets: 3, min: 5, max: 10 }
    expect(dailyObjective('bodyweight', [w(10, 0), w(10, 0), w(10, 0)], t, 2.5)!.text).toBe('Ajoute du lest : +2,5 kg, vise 5+')
    expect(dailyObjective('bodyweight', [w(10, 5), w(10, 5), w(10, 5)], t, 2.5)!.text).toBe('Passe à 7,5 kg de lest, vise 5+')
    expect(dailyObjective('bodyweight', [w(3, 0), w(3, 0), w(2, 0)], t, 2.5)!.rule).toBe('same')
  })

  it('durée : tout au haut → +5 s, sinon +5 s par série sans dépasser le haut', () => {
    const t = { sets: 2, min: 30, max: 60 }
    expect(dailyObjective('duration', [d(60), d(60)], t, 2.5)!.text).toBe('Passe à 65 s')
    expect(dailyObjective('duration', [d(45), d(58)], t, 2.5)!.plan).toEqual([{ seconds: 50 }, { seconds: 60 }])
  })

  it('première fois et semaine allégée', () => {
    expect(dailyObjective('weight', [], target, 2.5)!.text).toBe('Première fois : trouve une charge qui te laisse 2-3 reps en réserve')
    const o = dailyObjective('weight', [w(10, 50), w(9, 50), w(9, 50)], { ...target, sets: 2, rir: '3-4' }, 2.5, true)!
    expect(o.text).toBe('Semaine allégée : même charge, 2 séries, 3-4 reps en réserve')
    expect(o.plan).toEqual([{ reps: 10, kg: 50 }, { reps: 9, kg: 50 }])
  })

  it('sans objectif dans le modèle → rien', () => {
    expect(dailyObjective('weight', [w(10, 50)], undefined, 2.5)).toBeNull()
  })

  it('pré-remplit série par série, tant que la charge prévue est gardée', () => {
    const plan = [{ reps: 11, kg: 50 }, { reps: 11, kg: 50 }, { reps: 10, kg: 50 }]
    expect(prefillNextSet('weight', [], [], target, plan)).toEqual({ reps: 11, kg: 50 })
    expect(prefillNextSet('weight', [w(11, 50), w(11, 50)], [], target, plan)).toEqual({ reps: 10, kg: 50 })
    // Charge changée : on reprend la dernière série du jour
    expect(prefillNextSet('weight', [w(9, 55)], [], target, plan)).toEqual({ reps: 9, kg: 55 })
    // Les échauffements du jour ne décalent pas le plan
    expect(prefillNextSet('weight', [{ ...w(10, 25), warmup: true }], [], target, plan)).toEqual({ reps: 11, kg: 50 })
  })

  it('première fois : bas de la fourchette', () => {
    expect(prefillNextSet('weight', [], [], target)).toEqual({ reps: 8, kg: 20 })
    expect(prefillNextSet('duration', [], [], { sets: 2, min: 30, max: 60 })).toEqual({ seconds: 30 })
  })
})

describe('échauffements', () => {
  it('1er exercice : 50 % × 10, 70 % × 5, 85 % × 3, arrondis au palier', () => {
    expect(warmupSets('weight', 60, 2.5, 'first')).toEqual([
      { reps: 10, kg: 30, warmup: true },
      { reps: 5, kg: 42.5, warmup: true },
      { reps: 3, kg: 50, warmup: true },
    ])
  })

  it('2e exercice : une série à 70 % × 5 ; rien sans charge ou en durée', () => {
    expect(warmupSets('weight', 30, 2, 'second')).toEqual([{ reps: 5, kg: 22, warmup: true }])
    expect(warmupSets('bodyweight', 0, 2.5, 'first')).toEqual([])
    expect(warmupSets('duration', 60, 2.5, 'first')).toEqual([])
  })

  it('ne comptent ni dans les records, ni le volume, ni les séries', () => {
    const history = [w(10, 60)]
    const today = [{ ...w(10, 80), warmup: true }, w(10, 60)]
    expect(liveRecords('weight', history, today).size).toBe(0)
    expect(computeBests('weight', today)).toEqual({ maxKg: 60, best1RM: 80 })
    const session: Session = {
      id: 'x', templateId: 'jambes', date: '', startedAt: '2026-10-22T18:00:00.000Z', endedAt: '2026-10-22T19:00:00.000Z',
      status: 'done', exerciseIds: [], exercises: [{ exerciseId: 'squat', type: 'weight', note: '', sets: today }],
    }
    expect(sessionStats(session)).toMatchObject({ setCount: 1, volume: 600 })
  })
})
