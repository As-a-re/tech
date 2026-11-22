/**
 * Event and service times are shown in Ghana time (Africa/Accra, UTC+0) on every device,
 * so the server and the browser always print the same thing.
 */
export const TZ = 'Africa/Accra'
const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o })
const DAY = f({ weekday: 'short', day: 'numeric', month: 'short' })
const LONG = f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const TIME = f({ hour: 'numeric', minute: '2-digit', hour12: true })
const MON = f({ month: 'short' })
const MONTH_YEAR = f({ month: 'long', year: 'numeric' })

export const dayLabel = (iso: string) => DAY.format(new Date(iso))
export const longDate = (iso: string) => LONG.format(new Date(iso))
export const timeLabel = (iso: string) => TIME.format(new Date(iso)).replace(' ', '').toLowerCase()
export const monthShort = (iso: string) => MON.format(new Date(iso)).toUpperCase()
export const dayNumber = (iso: string) => new Date(iso).getUTCDate()
export const monthYear = (d: Date) => MONTH_YEAR.format(d)

/** "Sat 14 Nov, 4:00pm – 7:00pm" (or across days). */
export function whenLabel(startsAt: string, endsAt: string | null) {
  const s = `${dayLabel(startsAt)}, ${timeLabel(startsAt)}`
  if (!endsAt) return s
  return dayLabel(startsAt) === dayLabel(endsAt) ? `${s} – ${timeLabel(endsAt)}` : `${s} – ${dayLabel(endsAt)}, ${timeLabel(endsAt)}`
}

/** "08:30" → "8:30am" */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

/** Values for <input type="date"> / <input type="time"> from an ISO time (Ghana time = UTC). */
export const toDateInput = (iso: string) => iso.slice(0, 10)
export const toTimeInput = (iso: string) => iso.slice(11, 16)
/** Ghana time inputs → Date (UTC+0, no daylight saving). */
export const fromInputs = (date: string, time: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? new Date(`${date}T${time}:00Z`) : null)

/** First day of the month (UTC) for "2026-11", or this month. */
export function monthStart(ym?: string | null) {
  const m = ym?.match(/^(\d{4})-(\d{2})$/)
  const now = new Date()
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
export const ymOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
export const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
