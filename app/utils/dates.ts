/**
 * Human-readable dates. Month names instead of numbers, because "11/12/2026"
 * reads differently across locales; the year appears only when it is not the
 * current one.
 */
type DateInput = string | number | Date

const toDate = (value: DateInput) => value instanceof Date ? value : new Date(value)

/** "Nov 24", or "Nov 24, 2025" outside the current year. */
export function humanDate(value: DateInput): string {
  const date = toDate(value)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric'
  return date.toLocaleDateString([], options)
}

/** "Nov 24, 2026, 3:04 PM": a full timestamp for tooltips. */
export function humanDateTime(value: DateInput): string {
  return toDate(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const relativeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]

/** "Just now", "3 hours ago", "yesterday", "in 2 weeks". */
export function humanRelative(value: DateInput): string {
  const seconds = (toDate(value).getTime() - Date.now()) / 1000
  if (Math.abs(seconds) < 60) return 'Just now'
  const [unit, size] = relativeUnits.find(([, size]) => Math.abs(seconds) >= size)!
  return new Intl.RelativeTimeFormat([], { numeric: 'auto' }).format(Math.round(seconds / size), unit)
}
