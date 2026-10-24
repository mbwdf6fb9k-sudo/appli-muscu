import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db, type Session, type SetEntry } from '../db/database'
import { addSet, deleteSet, lastPerformance, updateSet } from '../db/sessions'
import { effortShort, effortText, formatSetsLine } from './format'
import { dailyObjective } from './objective'
import { prefillNextSet } from './prefill'
import { liveRecords } from './records'
import { sessionStats } from './sessionStats'
import { canBeDrop, effortSets, normalizeDrops, setLabel, setTitle, workSets } from './sets'
import { isStagnating } from './stagnation'

const w = (reps: number, kg: number, extra: Partial<SetEntry> = {}): SetEntry => ({ reps, kg, at: '', ...extra })
const d = (reps: number, kg: number) => w(reps, kg, { drop: true })
const target = { sets: 3, min: 8, max: 12 }

describe('séries dégressives', () => {
  it('une dégressive n’est pas une série de travail, mais compte dans le volume', () => {
    const sets = [w(10, 20, { warmup: true }), w(12, 20), w(12, 20), d(6, 15), w(12, 20), d(5, 15), d(4, 10)]
    expect(workSets(sets)).toHaveLength(3)
    expect(effortSets(sets)).toHaveLength(6)
    const session: Session = {
      id: 's',
      templateId: 'pecs-triceps',
      date: '2026-10-24',
      startedAt: '2026-10-24T16:00:00.000Z',
      endedAt: '2026-10-24T17:00:00.000Z',
      status: 'done',
      exercises: [{ exerciseId: 'x', type: 'weight', sets, note: '' }],
      exerciseIds: ['x'],
    }
    const stats = sessionStats(session)
    expect(stats.setCount).toBe(3)
    expect(stats.volume).toBe(3 * 12 * 20 + 6 * 15 + 5 * 15 + 4 * 10)
  })

  it('objectif du jour : les dégressives ne bloquent pas la montée de charge', () => {
    const last = [w(12, 20), w(12, 20), d(6, 15), w(12, 20), d(5, 15)]
    expect(dailyObjective('weight', last, target, 2.5)!.text).toBe('Passe à 22,5 kg, vise 8+')
    // Sans le champ (ancienne façon de noter) : la partie légère notée au milieu fausserait l'objectif
    expect(dailyObjective('weight', [w(12, 20), w(6, 15), w(12, 20)], target, 2.5)!.rule).not.toBe('up')
  })

  it('records et stagnation ignorent les dégressives', () => {
    const history = [w(10, 20)]
    // 12 × 30 en dégressive ne serait pas un record (c'est la suite d'une série)
    expect(liveRecords('weight', history, [w(8, 20), d(12, 30)]).has(1)).toBe(false)
    expect(isStagnating('weight', [[w(10, 60)], [w(9, 60), d(20, 40)], [w(10, 60), d(20, 40)], [w(8, 60), d(20, 40)]])).toBe(true)
  })

  it('pré-remplissage : après une dégressive, la série normale suivante', () => {
    const plan = [w(12, 20), w(12, 20), w(12, 20)].map(({ reps, kg }) => ({ reps, kg }))
    expect(prefillNextSet('weight', [w(12, 20), d(6, 15)], [], target, plan)).toEqual({ reps: 12, kg: 20 })
  })

  it('affichage : la dégressive est reliée à sa série par une flèche', () => {
    expect(formatSetsLine('weight', [w(10, 20), w(10, 20), d(5, 15)])).toBe('10 × 20 · 10 × 20 → 5 × 15 kg')
    expect(formatSetsLine('bodyweight', [w(8, 0), d(4, 0)])).toBe('8 → 4 reps')
    const sets = [w(10, 10, { warmup: true }), w(10, 20), d(5, 15), w(10, 20)]
    expect(sets.map((_, i) => setLabel(sets, i))).toEqual(['É', '1', '↘', '2'])
    expect(setTitle(sets, 2)).toBe('Dégressive de la série 1')
  })

  it('cohérence : une dégressive suit toujours une série de travail', () => {
    expect(canBeDrop([w(10, 20)], 1)).toBe(true)
    expect(canBeDrop([w(10, 10, { warmup: true })], 1)).toBe(false)
    expect(canBeDrop([], 0)).toBe(false)
    // Série principale supprimée : la dégressive redevient une série normale (rien n'est perdu)
    expect(normalizeDrops([d(5, 15), d(4, 10)])).toEqual([w(5, 15), d(4, 10)])
    // Série principale passée en échauffement
    expect(normalizeDrops([w(10, 20, { warmup: true }), d(5, 15)])).toEqual([w(10, 20, { warmup: true }), w(5, 15)])
    const fine = [w(10, 20), d(5, 15)]
    expect(normalizeDrops(fine)).toEqual(fine)
  })

  it('séance enregistrée : rattacher la 4e série, puis supprimer sa série principale', async () => {
    await db.delete()
    await db.open()
    const old: Session = {
      id: 'old',
      templateId: 'pecs-triceps',
      date: '2026-10-20',
      startedAt: '2026-10-20T16:00:00.000Z',
      endedAt: '2026-10-20T17:00:00.000Z',
      status: 'done',
      exercises: [{ exerciseId: 'x', type: 'weight', sets: [w(10, 20), w(10, 20), w(10, 20), w(5, 15)], note: '' }],
      exerciseIds: ['x'],
    }
    await db.sessions.put(structuredClone(old))
    // Une ancienne séance sans le champ reste identique, et sa dernière fois affiche les 4 séries
    expect(await db.sessions.get('old')).toEqual(old)
    expect((await lastPerformance('x'))!.sets).toHaveLength(4)

    await updateSet('old', 0, 3, { reps: 5, kg: 15, drop: true })
    let sets = (await db.sessions.get('old'))!.exercises[0].sets
    expect(sets[3]).toMatchObject({ reps: 5, kg: 15, drop: true })
    expect(workSets(sets)).toHaveLength(3)
    expect(formatSetsLine('weight', (await lastPerformance('x'))!.sets)).toBe('10 × 20 · 10 × 20 · 10 × 20 → 5 × 15 kg')

    // Ajouter une 2e descente, puis supprimer la série principale : les descentes restent, la 1re redevient normale
    await addSet('old', 0, { reps: 4, kg: 10, drop: true })
    await deleteSet('old', 0, 2)
    sets = (await db.sessions.get('old'))!.exercises[0].sets
    expect(sets.map((s) => [s.reps, s.kg, !!s.drop])).toEqual([
      [10, 20, false],
      [10, 20, false],
      [5, 15, true],
      [4, 10, true],
    ])
    // Valider une série normale ne garde jamais un champ drop vide
    await addSet('old', 0, { reps: 10, kg: 20, drop: undefined })
    expect('drop' in (await db.sessions.get('old'))!.exercises[0].sets.at(-1)!).toBe(false)
  })
})

describe('consignes en clair (à la place du RIR)', () => {
  it('textes', () => {
    expect(effortText('1-2')).toBe('Arrête la série quand tu pourrais encore faire 1 à 2 reps.')
    expect(effortText('2')).toBe('Arrête la série quand tu pourrais encore faire 2 reps.')
    expect(effortText('1')).toBe('Arrête la série quand tu pourrais encore faire 1 rep.')
    expect(effortText('0-1')).toBe('Va presque au bout : au plus 1 rep encore possible.')
    expect(effortText('0')).toBe('Va au bout : plus aucune rep possible.')
    expect(effortText('3–4')).toBe('Arrête la série quand tu pourrais encore faire 3 à 4 reps.')
    expect(effortText('facile')).toBe('Reps qu’il doit te rester en fin de série : facile.')
    expect(effortShort('1-2')).toBe('garde 1-2 reps')
    expect(effortShort('1')).toBe('garde 1 rep')
    expect(effortShort('0')).toBe('jusqu’au bout')
  })
})
