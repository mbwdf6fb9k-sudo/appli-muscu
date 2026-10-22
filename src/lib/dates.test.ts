import { describe, expect, it } from 'vitest'
import { daysSince, formatDaysAgo, localDateStamp } from './dates'
import { shouldRemindBackup } from './reminder'

describe('dates', () => {
  const now = new Date(2026, 9, 22, 9, 0) // 22 octobre 2026, 9 h

  it('compte les jours calendaires', () => {
    expect(daysSince(new Date(2026, 9, 22, 1, 0).toISOString(), now)).toBe(0)
    expect(daysSince(new Date(2026, 9, 21, 23, 59).toISOString(), now)).toBe(1)
    expect(daysSince(new Date(2026, 9, 8, 12, 0).toISOString(), now)).toBe(14)
    // Passage à l'heure d'hiver le 25 octobre 2026
    expect(daysSince(new Date(2026, 9, 24, 12, 0).toISOString(), new Date(2026, 9, 26, 12, 0))).toBe(2)
  })

  it('formate « il y a X jours »', () => {
    expect(formatDaysAgo(0)).toBe('aujourd’hui')
    expect(formatDaysAgo(1)).toBe('hier')
    expect(formatDaysAgo(5)).toBe('il y a 5 jours')
  })

  it('nomme le fichier avec la date locale', () => {
    expect(localDateStamp(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('rappel de sauvegarde', () => {
  const now = new Date(2026, 9, 22, 9, 0)
  const daysAgo = (n: number) => new Date(2026, 9, 22 - n, 9, 0).toISOString()
  const base = { firstLaunchAt: null, lastExportAt: null, reminderSnoozedUntil: null }

  it('ne rappelle pas avant 14 jours', () => {
    expect(shouldRemindBackup({ ...base, lastExportAt: daysAgo(14) }, now)).toBe(false)
  })

  it('rappelle au-delà de 14 jours', () => {
    expect(shouldRemindBackup({ ...base, lastExportAt: daysAgo(15) }, now)).toBe(true)
  })

  it('sans export, compte depuis le premier lancement', () => {
    expect(shouldRemindBackup({ ...base, firstLaunchAt: daysAgo(3) }, now)).toBe(false)
    expect(shouldRemindBackup({ ...base, firstLaunchAt: daysAgo(20) }, now)).toBe(true)
  })

  it('« Plus tard » masque le rappel temporairement', () => {
    const snoozed = { ...base, lastExportAt: daysAgo(20), reminderSnoozedUntil: new Date(2026, 9, 23).toISOString() }
    expect(shouldRemindBackup(snoozed, now)).toBe(false)
  })
})
