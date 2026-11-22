import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { listContent } from '@/server/admin/content'
import { AdminHeading, Chips, SearchBox, fmtDate } from '@/components/admin/ui'
import { RemoveContent } from '@/components/admin/remove-content'

export const metadata = { title: 'Content' }

export default async function Content({ searchParams }: { searchParams: Promise<{ k?: string; q?: string; page?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const KINDS = ['announcements', 'events', 'prayers', 'testimonies', 'publications', 'kids', 'live', 'resources'] as const
  const kind = KINDS.includes(sp.k as never) ? (sp.k as (typeof KINDS)[number]) : 'announcements'
  const path = { announcements: 'announcements', events: 'events', prayers: 'prayer', testimonies: 'testimonies', publications: 'publications', kids: 'children', live: 'live', resources: 'resources' }[kind]
  const single = { announcements: 'announcement', events: 'event', prayers: 'prayer', testimonies: 'testimony', publications: 'publication', kids: 'kids', live: 'live', resources: 'resource' } as const
  const page = Number(sp.page) || 1
  const r = await listContent(kind, sp.q, page)
  const qs = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ k: kind === 'announcements' ? undefined : kind, q: sp.q, ...o }).filter(([, v]) => v) as [string, string][]).toString()
  return (
    <>
      <AdminHeading title={t('admin.tabs.content')} />
      <div className="space-y-3 px-4 py-3 sm:px-6">
        <Chips active={kind} items={KINDS.map((k) => ({ key: k, label: t(`admin.content.${k}`), href: `/admin/content${k === 'announcements' ? '' : `?k=${k}`}` }))} />
        <SearchBox value={sp.q} placeholder={t('admin.content.searchPh')} hidden={{ k: kind === 'announcements' ? undefined : kind }} />
      </div>
      {r.rows.length === 0 ? <p className="px-6 py-12 text-center text-muted-foreground">{t('admin.content.none')}</p> : (
        <ul className="divide-y border-t">
          {r.rows.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <Link href={`/${path}/${x.id}`} className="font-semibold hover:underline">{x.title}</Link>
                <p className="text-xs text-muted-foreground">
                  {['announcements', 'events', 'publications', 'kids', 'live', 'resources'].includes(kind) && t(`levels.${String(x.level)}`)}{x.where && ` · ${x.where}`} · {t('admin.content.by', { username: String(x.username) })} · {fmtDate(x.createdAt, true)}
                  {x.startsAt && ` · ${fmtDate(x.startsAt, true)}`}
                </p>
              </div>
              {x.reports > 0 && <Link href="/admin/reports" className="rounded-full bg-brand-red/10 px-2.5 py-0.5 text-xs font-semibold text-brand-red">{t('admin.reports.times', { n: x.reports })}</Link>}
              <RemoveContent kind={single[kind]} id={x.id} />
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || r.hasMore) && (
        <nav className="flex justify-between px-4 py-4 text-sm sm:px-6">
          {page > 1 ? <Link href={`/admin/content${qs({ page: page > 2 ? String(page - 1) : undefined })}`} className="rounded-md border px-3 py-1.5">{t('admin.pager.prev')}</Link> : <span />}
          {r.hasMore && <Link href={`/admin/content${qs({ page: String(page + 1) })}`} className="rounded-md border px-3 py-1.5">{t('admin.pager.next')}</Link>}
        </nav>
      )}
    </>
  )
}
