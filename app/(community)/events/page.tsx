import Link from 'next/link'
import { CalendarDays, List, Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { listEvents, type EventFilter } from '@/server/community/events'
import { addMonths, longDate, monthStart } from '@/lib/community/dates'
import { SectionTabs } from '@/components/shell/section-tabs'
import { EventRow } from '@/components/community/event-row'
import { MonthCalendar } from '@/components/community/month-calendar'
import { LinkChips, SearchForm } from '@/components/community/tabs'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Events' }
const MEMBER_FILTERS: EventFilter[] = ['all', 'national', 'district', 'local', 'going', 'hosting', 'past']

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ f?: string; view?: string; m?: string; day?: string; q?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const filters: EventFilter[] = me ? MEMBER_FILTERS : ['all', 'national', 'past']
  const f = (filters.includes(sp.f as EventFilter) ? sp.f : 'all') as EventFilter
  const view = sp.view === 'calendar' ? 'calendar' : 'list'
  const home = me ? { districtId: me.districtId, assemblyId: me.assemblyId } : null
  const q = sp.q?.trim() || undefined
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ f: f === 'all' ? undefined : f, view: view === 'list' ? undefined : view, q, ...o }).filter(([, v]) => v) as [string, string][]).toString()
    return `/events${p ? `?${p}` : ''}`
  }
  const labels = { national: t('levels.national'), going: t('events.rsvp.goingCount'), cancelled: t('events.cancelled'), online: t('events.joinOnline') }

  let body: React.ReactNode
  if (view === 'calendar') {
    const month = monthStart(sp.m)
    const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null
    const { items } = await listEvents({ filter: f === 'past' ? 'all' : f, viewerId: me?.id ?? null, home, from: month, to: addMonths(month, 1), q, limit: 300 })
    const dayList = day ? items.filter((e) => e.startsAt.startsWith(day)) : []
    body = (
      <>
        <MonthCalendar month={month} events={items} day={day} base={(o) => qs({ m: o.m, day: o.day })}
          days={Array.from({ length: 7 }, (_, i) => t(`directory.daysShort.${i}` as MessageKey))}
          labels={{ prev: t('events.prevMonth'), next: t('events.nextMonth'), today: t('events.today') }} />
        {day && <div className="border-t"><h3 className="px-4 pt-3 text-sm font-semibold text-muted-foreground">{longDate(`${day}T12:00:00Z`)}</h3>
          {dayList.length ? dayList.map((e) => <EventRow key={e.id} e={e} labels={labels} />) : <p className="px-4 py-6 text-sm text-muted-foreground">{t('events.noneDay')}</p>}</div>}
      </>
    )
  } else {
    const page = Number(sp.page) || 1
    const list = await listEvents({ filter: f, viewerId: me?.id ?? null, home, q, page })
    body = list.items.length === 0 && page === 1 ? <p className="px-8 py-16 text-center text-muted-foreground">{f === 'past' ? t('events.nonePast') : t('events.none')}</p> : (
      <>
        {list.items.map((e) => <EventRow key={e.id} e={e} labels={labels} />)}
        {(page > 1 || list.hasMore) && (
          <nav className="flex justify-between px-4 py-4 text-sm font-medium">
            {page > 1 ? <Link href={qs({ page: page > 2 ? String(page - 1) : undefined })} className="rounded-full border px-4 py-1.5 hover:bg-muted">← {t('announcements.prev')}</Link> : <span />}
            {list.hasMore && <Link href={qs({ page: String(page + 1) })} className="rounded-full border px-4 py-1.5 hover:bg-muted">{t('announcements.next')} →</Link>}
          </nav>
        )}
      </>
    )
  }

  return (
    <>
      <SectionTabs active="events" signedIn={!!me} />
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <h1 className="text-lg font-bold">{t('events.title')}</h1>
        {me && <Link href="/events/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('events.new')}</Link>}
      </div>
      <div className="space-y-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><SearchForm action="/events" q={q} placeholder={t('events.searchPh')} hidden={{ f: f === 'all' ? undefined : f, view: view === 'list' ? undefined : view }} /></div>
          <div className="flex shrink-0 overflow-hidden rounded-full border">
            <Link href={qs({ view: undefined })} aria-label={t('events.list')} aria-current={view === 'list' ? 'page' : undefined} className={cn('p-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><List className="size-4" /></Link>
            <Link href={qs({ view: 'calendar' })} aria-label={t('events.calendar')} aria-current={view === 'calendar' ? 'page' : undefined} className={cn('p-2', view === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><CalendarDays className="size-4" /></Link>
          </div>
        </div>
        {me && <Link href="/events/mine" className="inline-block text-sm font-medium text-primary hover:underline">{t('events.mine')}</Link>}
        <LinkChips active={f} items={filters.filter((k) => view === 'list' || k !== 'past').map((k) => ({ key: k, label: t(`events.filters.${k}` as MessageKey), href: qs({ f: k === 'all' ? undefined : k, page: undefined, day: undefined }).replace(/([?&])f=all&?/, '$1') }))} />
      </div>
      {body}
    </>
  )
}
