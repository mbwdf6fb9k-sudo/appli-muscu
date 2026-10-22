import type { Settings } from '../db/settings'
import { daysSince } from './dates'

export const BACKUP_REMINDER_DAYS = 14
export const REMINDER_SNOOZE_DAYS = 3

type ReminderSettings = Pick<Settings, 'lastExportAt' | 'firstLaunchAt' | 'reminderSnoozedUntil'>

/** Rappel affiché quand la dernière sauvegarde (ou le premier lancement) date de plus de 14 jours. */
export function shouldRemindBackup(settings: ReminderSettings, now = new Date()): boolean {
  if (settings.reminderSnoozedUntil && new Date(settings.reminderSnoozedUntil) > now) return false
  const reference = settings.lastExportAt ?? settings.firstLaunchAt
  if (!reference) return false
  return daysSince(reference, now) > BACKUP_REMINDER_DAYS
}

export function snoozeUntil(now = new Date()): string {
  return new Date(now.getTime() + REMINDER_SNOOZE_DAYS * 86_400_000).toISOString()
}
