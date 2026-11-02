import { describe, expect, it } from 'vitest'
import type { Session, SetEntry } from '../db/database'
import { adviceOfDay } from './advice'
import { formatClock, formatRange, parseRest, restState } from './rest'

describe('chronomètre de repos', () => {
  it('lit les repos du programme', () => {
    expect(parseRest('2-3 min')).toEqual({ min: 120, max: 180 })
    expect(parseRest('1,5-2 min')).toEqual({ min: 90, max: 120 })
    expect(parseRest('1 min')).toEqual({ min: 60, max: 60 })
    expect(parseRest('1,5 min après la paire')).toEqual({ min: 90, max: 90 })
    expect(parseRest('1-1,5 min')).toEqual({ min: 60, max: 90 })
    expect(parseRest('90 s')).toEqual({ min: 90, max: 90 })
    expect(parseRest(undefined)).toBeNull()
    expect(parseRest('court')).toBeNull()
    expect(formatClock(83)).toBe('1:23')
    expect(formatRange({ min: 120, max: 180 })).toBe('2-3 min')
    expect(formatRange({ min: 90, max: 120 })).toBe('1:30-2:00')
    expect(formatRange({ min: 60, max: 60 })).toBe('1 min')
  })

  const set = (at: string, extra: Partial<SetEntry> = {}): SetEntry => ({ reps: 8, kg: 50, at, ...extra })
  const session: Session = {
    id: 's',
    templateId: 'bras',
    date: '2026-11-02',
    startedAt: '2026-11-02T17:00:00.000Z',
    endedAt: null,
    status: 'active',
    exercises: [
      { exerciseId: 'a', type: 'weight', sets: [set('2026-11-02T17:05:00.000Z')], note: '', target: { sets: 3, min: 6, max: 10, rest: '2-3 min' } },
      { exerciseId: 'b', type: 'weight', sets: [set('2026-11-02T17:10:00.000Z')], note: '', target: { sets: 3, min: 6, max: 10, superset: 'A' } },
      { exerciseId: 'c', type: 'weight', sets: [], note: '', target: { sets: 3, min: 8, max: 12, rest: '1,5-2 min après la paire', superset: 'A' } },
      { exerciseId: 'd', type: 'weight', sets: [], note: '' },
    ],
    exerciseIds: ['a', 'b'],
  }
  const at = (iso: string) => new Date(iso)

  it('part de la dernière série validée, quel que soit l’exercice', () => {
    const state = restState(session, at('2026-11-02T17:11:10.000Z'))!
    expect(state).toMatchObject({ exerciseIndex: 1, elapsed: 70, phase: 'chain', nextExerciseId: 'c' })
  })

  it('avant le minimum, minimum atteint, au-delà du maximum', () => {
    const only: Session = { ...session, exercises: [session.exercises[0]] }
    expect(restState(only, at('2026-11-02T17:06:00.000Z'))).toMatchObject({ phase: 'resting', elapsed: 60, range: { min: 120, max: 180 } })
    expect(restState(only, at('2026-11-02T17:07:00.000Z'))?.phase).toBe('ready')
    expect(restState(only, at('2026-11-02T17:08:00.000Z'))?.phase).toBe('ready')
    expect(restState(only, at('2026-11-02T17:08:01.000Z'))?.phase).toBe('over')
  })

  it('superset : après le 2e de la paire, le repos « après la paire » ; sans repos conseillé : le chrono compte', () => {
    const pair: Session = {
      ...session,
      exercises: [session.exercises[1], { ...session.exercises[2], sets: [set('2026-11-02T17:11:00.000Z')] }],
    }
    expect(restState(pair, at('2026-11-02T17:12:00.000Z'))).toMatchObject({ phase: 'resting', range: { min: 90, max: 120 } })
    const free: Session = { ...session, exercises: [{ ...session.exercises[3], sets: [set('2026-11-02T17:11:00.000Z', { warmup: true })] }] }
    expect(restState(free, at('2026-11-02T17:11:30.000Z'))).toMatchObject({ phase: 'free', elapsed: 30, range: null })
    expect(restState({ ...session, exercises: [] }, new Date())).toBeNull()
  })
})

describe('séance conseillée : pourquoi pas une autre ?', () => {
  // Jeudi 22 octobre 2026, 9 h
  const now = new Date(2026, 9, 22, 9)
  const s = (day: number, templateId: Session['templateId'], hour = 18): Session => {
    const d = new Date(2026, 9, day, hour)
    return { id: `${templateId}-${day}`, templateId, date: `2026-10-${day}`, startedAt: d.toISOString(), endedAt: null, status: 'done', exercises: [], exerciseIds: [] }
  }
  const reasons = (a: ReturnType<typeof adviceOfDay>) => Object.fromEntries(a.others.map((o) => [o.templateId, o.reason]))

  it('une raison pour chaque autre séance, cohérente avec la règle', () => {
    const advice = adviceOfDay({
      sessions: [s(21, 'pecs-triceps'), s(12, 'dos-biceps'), s(18, 'jambes')],
      activities: [{ id: 'f', date: '2026-10-21', type: 'foot' }],
      footDays: [],
      now,
    })
    expect(advice).toMatchObject({ kind: 'session', templateId: 'dos-biceps' })
    expect(reasons(advice)).toEqual({
      'pecs-triceps': 'faite hier : pas encore 48 h de récupération',
      bras: 'Pecs-Triceps faite hier : triceps pas encore récupérés',
      jambes: 'Foot hier : jambes pas encore récupérées',
    })
  })

  it('séance possible mais moins prioritaire ; foot demain ; Bras hier', () => {
    const advice = adviceOfDay({ sessions: [s(12, 'dos-biceps'), s(16, 'pecs-triceps'), s(21, 'bras')], activities: [], footDays: [], now })
    expect(advice).toMatchObject({ kind: 'session', templateId: 'jambes' })
    // Jambes n'a jamais été faite… mais demain c'est foot : elle est écartée, donc Dos-Biceps
    const withFoot = adviceOfDay({ sessions: [s(12, 'dos-biceps'), s(16, 'pecs-triceps'), s(19, 'bras')], activities: [], footDays: [5], now })
    expect(withFoot).toMatchObject({ templateId: 'dos-biceps' })
    expect(reasons(withFoot)).toEqual({
      'pecs-triceps': 'faite il y a 6 jours, Dos-Biceps attend depuis plus longtemps',
      bras: 'faite il y a 3 jours, Dos-Biceps attend depuis plus longtemps',
      jambes: 'demain c’est ton jour de foot : jambes fraîches pour le match',
    })
    expect(reasons(advice)['dos-biceps']).toBe('Bras faite hier : biceps pas encore récupérés')
  })

  it('repos : la raison, et la situation de chaque séance', () => {
    const advice = adviceOfDay({ sessions: [s(19, 'dos-biceps'), s(20, 'jambes'), s(21, 'pecs-triceps')], activities: [], footDays: [], now })
    expect(advice.kind).toBe('rest')
    expect(advice.others).toHaveLength(4)
    expect(reasons(advice).bras).toBe('Pecs-Triceps faite hier : triceps pas encore récupérés')
    expect(reasons(advice)['dos-biceps']).toBe('faite il y a 3 jours, possible un autre jour')
  })
})
