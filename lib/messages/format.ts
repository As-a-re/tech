/** Chat times in Ghana time (UTC), the same on server and phone. */
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', hour: 'numeric', minute: '2-digit', hour12: true })
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'long' })
const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short' })

export const clockTime = (iso: string) => TIME.format(new Date(iso)).replace(' ', '').toLowerCase()
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** "Today", "Yesterday", "Monday" (this week) or "12 Oct 2026". */
export function dayHeading(iso: string, now = new Date(), words: { today: string; yesterday: string }) {
  const d = new Date(iso)
  const diff = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(d))) / 864e5)
  if (diff === 0) return words.today
  if (diff === 1) return words.yesterday
  if (diff < 7) return DAY.format(d)
  return DATE.format(d)
}

/** Chat list: time today, "Yesterday", weekday, or date. */
export function listTime(iso: string, now = new Date(), yesterday = 'Yesterday') {
  const d = new Date(iso)
  const diff = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(d))) / 864e5)
  if (diff === 0) return clockTime(iso)
  if (diff === 1) return yesterday
  if (diff < 7) return DAY.format(d)
  return SHORT.format(d)
}

export const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10)

export function fileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const duration = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`)
