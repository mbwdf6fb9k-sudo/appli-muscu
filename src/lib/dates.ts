const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Nombre de jours calendaires écoulés depuis la date (0 = aujourd'hui). */
export function daysSince(iso: string, now = new Date()): number {
  // Math.round absorbe les jours de 23 h ou 25 h (changement d'heure)
  return Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY_MS)
}

export function formatDaysAgo(days: number): string {
  if (days <= 0) return 'aujourd’hui'
  if (days === 1) return 'hier'
  return `il y a ${days} jours`
}

/** AAAA-MM-JJ en heure locale. */
export function localDateStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** « mercredi 22 octobre » */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** « 22 octobre 2026 » */
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
