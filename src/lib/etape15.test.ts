import { describe, expect, it, vi } from 'vitest'
import type { Session, SessionExercise, SetEntry } from '../db/database'
import { compareExercise, compareSession } from './compare'
import { startWakeLock } from './wakeLock'

const w = (reps: number, kg: number, extra: Partial<SetEntry> = {}): SetEntry => ({ reps, kg, at: '', ...extra })
const entry = (sets: SetEntry[], over: Partial<SessionExercise> = {}): SessionExercise => ({ exerciseId: 'x', type: 'weight', sets, note: '', target: { sets: 3, min: 6, max: 10 }, ...over })
const s = (day: number, exercises: SessionExercise[], over: Partial<Session> = {}): Session => ({
  id: `s${day}`,
  templateId: 'pecs-triceps',
  date: `2026-11-${String(day).padStart(2, '0')}`,
  startedAt: `2026-11-${String(day).padStart(2, '0')}T17:00:00.000Z`,
  endedAt: `2026-11-${String(day).padStart(2, '0')}T18:00:00.000Z`,
  status: 'done',
  exercises,
  exerciseIds: exercises.map((e) => e.exerciseId),
  ...over,
})

describe('comparaison par exercice', () => {
  const previous = s(1, [entry([w(8, 40), w(8, 40), w(7, 40)])])
  const label = (sets: SetEntry[]) => {
    const e = entry(sets)
    const today = s(5, [e])
    return compareExercise(today, e, [previous, today])
  }

  it('charge, reps, identique, baisse, nouveau', () => {
    expect(label([w(6, 42.5), w(6, 42.5)])).toEqual({ label: '+2,5 kg', tone: 'up' })
    expect(label([w(6, 37.5)])).toEqual({ label: '−2,5 kg', tone: 'down' })
    // Moins lourd mais plus de reps à la charge la plus lourde : les deux écarts, sans verdict
    expect(label([w(10, 37.5), w(10, 37.5), w(10, 37.5)])).toEqual({ label: '−2,5 kg, +7 reps', tone: 'same' })
    expect(label([w(9, 40), w(8, 40), w(8, 40)])).toEqual({ label: '+2 reps', tone: 'up' })
    expect(label([w(8, 40), w(7, 40), w(7, 40)])).toEqual({ label: '−1 rep', tone: 'down' })
    expect(label([w(8, 40), w(8, 40), w(7, 40)])).toEqual({ label: '=', tone: 'same' })
    const e = entry([w(8, 40)], { exerciseId: 'autre' })
    const today = s(5, [e])
    expect(compareExercise(today, e, [previous, today])).toEqual({ label: 'nouveau', tone: 'new' })
  })

  it('séries retenues : sans échauffements, dégressives ni séries en plus', () => {
    expect(label([w(10, 60, { warmup: true }), w(8, 40), w(20, 45, { drop: true }), w(8, 40), w(7, 40), w(30, 40)])).toEqual({ label: '=', tone: 'same' })
    const onlyWarmup = entry([w(10, 20, { warmup: true })])
    expect(compareExercise(s(5, [onlyWarmup]), onlyWarmup, [previous])).toBeNull()
  })

  it('poids du corps et durée', () => {
    const bw = (sets: SetEntry[]) => entry(sets, { type: 'bodyweight' })
    const old = s(1, [bw([w(8, 0), w(8, 0)])])
    const up = bw([w(9, 0), w(8, 0)])
    expect(compareExercise(s(5, [up]), up, [old])).toEqual({ label: '+1 rep', tone: 'up' })
    const lest = bw([w(5, 2.5)])
    expect(compareExercise(s(5, [lest]), lest, [old])).toEqual({ label: '+2,5 kg', tone: 'up' })
    const d = (n: number) => entry([{ seconds: n, at: '' }], { type: 'duration' })
    expect(compareExercise(s(5, [d(50)]), d(50), [s(1, [d(45)])])).toEqual({ label: '+5 s', tone: 'up' })
  })

  it('semaine allégée : ni comparée, ni référence ; séance plus ancienne ignorée', () => {
    const e = entry([w(8, 40)])
    expect(compareExercise(s(5, [e], { deload: true }), e, [previous])).toBeNull()
    const light = s(3, [entry([w(5, 20)])], { deload: true })
    expect(compareExercise(s(5, [e]), e, [previous, light])?.label).toBe('−15 reps')
    const later = s(9, [entry([w(5, 90)])])
    expect(compareExercise(s(5, [e]), e, [previous, later])?.label).toBe('−15 reps')
  })
})

describe('comparaison de la séance', () => {
  const a = s(1, [entry([w(10, 50), w(10, 50)])])
  const b = s(5, [entry([w(10, 50), w(10, 50), w(4, 50)])])

  it('volume et séries par rapport à la dernière du même type', () => {
    const other = s(3, [entry([w(1, 1)])], { templateId: 'bras' })
    expect(compareSession(b, [a, other, b])).toEqual({ date: a.startedAt, volume: expect.closeTo(0.2), sets: 1 })
  })

  it('pas de comparaison : première du type, séance libre, séance allégée', () => {
    expect(compareSession(a, [a])).toBeNull()
    expect(compareSession({ ...b, templateId: 'libre' }, [{ ...a, templateId: 'libre' }])).toBeNull()
    expect(compareSession({ ...b, deload: true }, [a])).toBeNull()
    expect(compareSession(b, [{ ...a, deload: true }])).toBeNull()
  })
})

describe('écran allumé', () => {
  function fake() {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
    const sentinels: (EventTarget & { release: ReturnType<typeof vi.fn> })[] = []
    const request = vi.fn(async () => {
      const sentinel = Object.assign(new EventTarget(), { release: vi.fn(async () => {}) })
      sentinels.push(sentinel)
      return sentinel as unknown as WakeLockSentinel
    })
    return { doc: doc as never, raw: doc, request, sentinels, host: { wakeLock: { request } } }
  }
  const flush = () => new Promise((r) => setTimeout(r))

  it('demande, redemande au retour dans l’appli, rend la main en quittant', async () => {
    const f = fake()
    const stop = startWakeLock(f.host, f.doc)
    await flush()
    expect(f.request).toHaveBeenCalledTimes(1)
    // Déjà tenu : on ne redemande pas
    f.raw.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(f.request).toHaveBeenCalledTimes(1)
    // L'iPhone le libère quand on quitte l'appli
    f.raw.visibilityState = 'hidden'
    f.sentinels[0].dispatchEvent(new Event('release'))
    f.raw.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(f.request).toHaveBeenCalledTimes(1)
    f.raw.visibilityState = 'visible'
    f.raw.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(f.request).toHaveBeenCalledTimes(2)
    stop()
    expect(f.sentinels[1].release).toHaveBeenCalled()
    f.raw.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(f.request).toHaveBeenCalledTimes(2)
  })

  it('sans effet si non pris en charge ou refusé', async () => {
    const f = fake()
    expect(() => startWakeLock({}, f.doc)()).not.toThrow()
    f.request.mockRejectedValueOnce(new Error('refus'))
    const stop = startWakeLock(f.host, f.doc)
    await flush()
    expect(() => stop()).not.toThrow()
  })
})
