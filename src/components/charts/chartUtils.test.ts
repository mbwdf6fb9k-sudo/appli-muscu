import { describe, expect, it } from 'vitest'
import { niceTicks } from './chartUtils'

describe('graduations', () => {
  it('un seul poids : échelle serrée autour de la valeur', () => {
    const ticks = niceTicks(74, 74)
    expect(ticks[0]).toBeGreaterThanOrEqual(72)
    expect(ticks.at(-1)).toBeLessThanOrEqual(76)
    expect(ticks[0]).toBeLessThan(74)
    expect(ticks.at(-1)).toBeGreaterThan(74)
  })

  it('valeurs étalées : graduations rondes qui englobent tout', () => {
    expect(niceTicks(62, 88)).toEqual([60, 70, 80, 90])
  })

  it('petites valeurs (reps) : au moins 1 d’écart', () => {
    const ticks = niceTicks(12, 12)
    expect(ticks[0]).toBeLessThan(12)
    expect(ticks.at(-1)).toBeGreaterThan(12)
    expect(ticks.at(-1)! - ticks[0]).toBeLessThanOrEqual(2)
  })
})
