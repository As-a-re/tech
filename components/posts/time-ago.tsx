'use client'

import { useEffect, useState } from 'react'
import { useMounted } from '@/hooks/use-mounted'

const full = (d: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(d)
const short = (d: Date, now: Date) => new Intl.DateTimeFormat('en-GB', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(d)

export function relative(iso: string, now = new Date()) {
  const d = new Date(iso)
  const s = Math.round((now.getTime() - d.getTime()) / 1000)
  if (s < 0) return short(d, now)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return short(d, now)
}

/** "5m", "3h", "26 Oct" — renders a fixed date on the server, then live relative time in the browser. */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const mounted = useMounted()
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 60_000); return () => clearInterval(id) }, [])
  const d = new Date(iso)
  return <time dateTime={iso} title={mounted ? full(d) : undefined} className={className} suppressHydrationWarning>{mounted ? relative(iso) : short(d, d)}</time>
}

export function FullDate({ iso }: { iso: string }) {
  const mounted = useMounted()
  return <time dateTime={iso} suppressHydrationWarning>{mounted ? full(new Date(iso)) : iso.slice(0, 10)}</time>
}
