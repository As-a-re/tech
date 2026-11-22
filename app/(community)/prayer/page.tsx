import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { listPrayers, type PrayerFilter } from '@/server/devotion/prayer'
import { PageHeader } from '@/components/common/page-header'
import { PagerLinks } from '@/components/common/pager-links'
import { LinkChips } from '@/components/community/tabs'
import { PrayerCard } from '@/components/devotion/prayer-card'

export const metadata = { title: 'Prayer requests' }

export default async function PrayerPage({ searchParams }: { searchParams: Promise<{ f?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const filters: PrayerFilter[] = me ? ['all', 'assembly', 'answered', 'prayed', 'mine'] : ['all', 'answered']
  const f = (filters.includes(sp.f as PrayerFilter) ? sp.f : 'all') as PrayerFilter
  const viewer = me ? { id: me.id, assemblyId: me.assemblyId, isAdmin: me.role === 'tech_admin' } : null
  const list = await listPrayers({ filter: f, viewer, page: Number(sp.page) || 1 })
  return (
    <>
      <PageHeader title={t('prayer.title')} action={me && <Link href="/prayer/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('prayer.new')}</Link>} />
      <div className="space-y-3 border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">{t('prayer.lead')}</p>
        <LinkChips active={f} items={filters.map((k) => ({ key: k, label: t(`prayer.filters.${k}` as MessageKey), href: k === 'all' ? '/prayer' : `/prayer?f=${k}` }))} />
      </div>
      {list.items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('prayer.none')}</p>
        : list.items.map((p) => <PrayerCard key={p.id} p={p} signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />)}
      <PagerLinks base="/prayer" params={{ f: f === 'all' ? undefined : f }} page={list.page} hasMore={list.hasMore} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
    </>
  )
}
