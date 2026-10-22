import { describe, expect, it } from 'vitest'
import type { ExerciseType, Session, SetEntry } from '../db/database'
import {
  exerciseHistory,
  exerciseRecords,
  exerciseSummaries,
  recordSessionIds,
  startOfWeek,
  weeklyAverage,
  weeklyCounts,
} from './progress'

const set = (reps: number, kg: number): SetEntry => ({ reps, kg, at: '' })

function session(id: string, start: Date, exercises: [string, ExerciseType, SetEntry[]][], status: Session['status'] = 'done'): Session {
  return {
    id,
    templateId: 'dos-biceps',
    date: '',
    startedAt: start.toISOString(),
    endedAt: status === 'done' ? new Date(start.getTime() + 3_600_000).toISOString() : null,
    status,
    exercises: exercises.map(([exerciseId, type, sets]) => ({ exerciseId, type, sets, note: '' })),
    exerciseIds: exercises.map(([exerciseId]) => exerciseId),
  }
}

describe('séances par semaine', () => {
  it('la semaine commence le lundi', () => {
    expect(startOfWeek(new Date(2026, 9, 22, 18)).toDateString()).toBe(new Date(2026, 9, 19).toDateString())
    expect(startOfWeek(new Date(2026, 9, 25, 23)).toDateString()).toBe(new Date(2026, 9, 19).toDateString())
    expect(startOfWeek(new Date(2026, 9, 26, 0, 30)).toDateString()).toBe(new Date(2026, 9, 26).toDateString())
  })

  it('compte les séances terminées des 12 dernières semaines', () => {
    const now = new Date(2026, 10, 4, 12) // mercredi 4 novembre (après le changement d'heure du 25 octobre)
    const weeks = weeklyCounts(
      [
        session('a', new Date(2026, 10, 2, 18), []), // lundi 2 nov. : semaine en cours
        session('b', new Date(2026, 10, 1, 10), []), // dimanche 1er nov. : semaine précédente
        session('c', new Date(2026, 9, 26, 18), []), // lundi 26 oct. : semaine précédente
        session('d', new Date(2026, 10, 3, 18), [], 'active'), // en cours : ignorée
        session('e', new Date(2025, 0, 1), []), // trop ancienne
      ],
      now,
    )
    expect(weeks).toHaveLength(12)
    expect(weeks.at(-1)?.count).toBe(1)
    expect(weeks.at(-2)?.count).toBe(2)
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(3)
    expect(weeks[0].start.getDay()).toBe(1)
  })
})

describe('moyenne par semaine', () => {
  const now = new Date(2026, 9, 22, 12) // jeudi 22 octobre

  it('pas de moyenne la première semaine', () => {
    expect(weeklyAverage([session('a', new Date(2026, 9, 21), [])], now)).toBeNull()
  })

  it('calculée depuis la première séance, pas sur 12 semaines', () => {
    const sessions = [
      session('a', new Date(2026, 9, 8), []), // semaine du 5 oct.
      session('b', new Date(2026, 9, 14), []), // semaine du 12 oct.
      session('c', new Date(2026, 9, 16), []),
      session('d', new Date(2026, 9, 21), []), // semaine en cours
    ]
    expect(weeklyAverage(sessions, now)).toEqual({ average: 4 / 3, weeks: 3 })
  })

  it('plafonnée à 12 semaines', () => {
    expect(weeklyAverage([session('a', new Date(2025, 0, 6), []), session('b', new Date(2026, 9, 20), [])], now)).toEqual({
      average: 1 / 12,
      weeks: 12,
    })
  })
})

describe('historique et records d’un exercice', () => {
  const sessions = [
    session('s1', new Date(2026, 9, 1), [['squat', 'weight', [set(10, 80), set(8, 85)]]]),
    session('s3', new Date(2026, 9, 15), [['squat', 'weight', [set(3, 100)]]]),
    session('s2', new Date(2026, 9, 8), [['squat', 'weight', [set(10, 90)]], ['dips', 'bodyweight', [set(12, 0)]]]),
  ]

  it('trie les séances par date et calcule les meilleures valeurs', () => {
    const history = exerciseHistory(sessions, 'squat')
    expect(history.map((h) => h.sessionId)).toEqual(['s1', 's2', 's3'])
    expect(history[1].bests).toEqual({ maxKg: 90, best1RM: 120 })
  })

  it('date chaque record à la séance où il a été établi', () => {
    const records = exerciseRecords(exerciseHistory(sessions, 'squat'), 'weight')
    expect(records).toEqual([
      { kind: 'maxKg', value: 100, date: sessions[1].startedAt, sessionId: 's3' },
      { kind: 'best1RM', value: 120, date: sessions[2].startedAt, sessionId: 's2' },
    ])
  })

  it('résume les exercices déjà faits, le plus récent d’abord', () => {
    const summaries = exerciseSummaries(sessions)
    expect(summaries.map((s) => s.exerciseId)).toEqual(['squat', 'dips'])
    expect(summaries[0]).toMatchObject({ sessionCount: 3, bests: { maxKg: 100, best1RM: 120 } })
    expect(summaries[1].bests).toEqual({ maxReps: 12, maxLest: undefined })
  })

  it('met un trophée sur les séances qui ont battu un record', () => {
    // s1 : première fois (pas de record) · s2 : 90 kg > 85 · s3 : 100 kg > 90
    expect([...recordSessionIds(sessions)].sort()).toEqual(['s2', 's3'])
  })
})
