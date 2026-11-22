import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EventView } from '@/server/community/events'
import { addMonths, monthYear, ymOf } from '@/lib/community/dates'
import { cn } from '@/lib/utils'

/** Month grid (weeks start on Sunday). Days with events link to that day's list. */
export function MonthCalendar({ month, events, day, base, days, labels }: {
  month: Date; events: EventView[]; day: string | null; base: (o: { m?: string; day?: string }) => string
  days: string[]; labels: { prev: string; next: string; today: string }
}) {
  const first = month.getUTCDay()
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
  const today = new Date().toISOString().slice(0, 10)
  const byDay = new Map<string, EventView[]>()
  for (const e of events) { const k = e.startsAt.slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), e]) }
  const cells = Array.from({ length: Math.ceil((first + count) / 7) * 7 }, (_, i) => i - first + 1)
  const ym = ymOf(month)
  return (
    <div className="px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">{monthYear(month)}</h2>
        <Link href={base({ m: ymOf(addMonths(month, -1)) })} aria-label={labels.prev} className="rounded-full border p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></Link>
        <Link href={base({})} className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted">{labels.today}</Link>
        <Link href={base({ m: ymOf(addMonths(month, 1)) })} aria-label={labels.next} className="rounded-full border p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></Link>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border text-sm">
        {days.map((d) => <div key={d} className="border-b bg-muted/40 py-1.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        {cells.map((n, i) => {
          if (n < 1 || n > count) return <div key={i} className="min-h-16 min-w-0 border-b border-r bg-muted/20 sm:min-h-20 [&:nth-child(7n)]:border-r-0" />
          const key = `${ym}-${String(n).padStart(2, '0')}`
          const list = byDay.get(key) ?? []
          const inner = (
            <>
              <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-semibold', key === today && 'bg-brand-red text-white', key === day && key !== today && 'bg-primary text-primary-foreground')}>{n}</span>
              <span className="mt-1 hidden w-full min-w-0 space-y-0.5 sm:block">{list.slice(0, 2).map((e) => <span key={e.id} className={cn('block truncate rounded px-1 text-[11px] font-medium', e.level === 'national' ? 'bg-brand-red/10 text-brand-red' : 'bg-primary/10 text-primary', e.cancelled && 'line-through')}>{e.title}</span>)}
                {list.length > 2 && <span className="block px-1 text-[11px] text-muted-foreground">+{list.length - 2}</span>}</span>
              {list.length > 0 && <span className="mt-1 flex gap-0.5 sm:hidden">{list.slice(0, 3).map((e) => <span key={e.id} className={cn('size-1.5 rounded-full', e.level === 'national' ? 'bg-brand-red' : 'bg-primary')} />)}</span>}
            </>
          )
          const cls = cn('flex min-h-16 min-w-0 flex-col items-start overflow-hidden border-b border-r p-1 sm:min-h-20 [&:nth-child(7n)]:border-r-0', key === day && 'bg-primary/5')
          return list.length ? <Link key={i} href={base({ m: ym, day: key })} className={cn(cls, 'hover:bg-muted/50')}>{inner}</Link> : <div key={i} className={cls}>{inner}</div>
        })}
      </div>
    </div>
  )
}
