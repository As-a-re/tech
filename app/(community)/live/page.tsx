import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { listLives } from '@/server/live/live'
import { hasMinistryRole } from '@/server/library/permissions'
import { PageHeader } from '@/components/common/page-header'
import { PagerLinks } from '@/components/common/pager-links'
import { LinkTabs } from '@/components/community/tabs'
import { LiveTile } from '@/components/live/live-card'

export const metadata = { title: 'Live' }

export default async function LivePage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const tab = sp.tab === 'replays' ? 'replays' : 'live'
  const [list, host] = await Promise.all([listLives(tab, Number(sp.page) || 1), hasMinistryRole(me, 'media_team')])
  return (
    <>
      <PageHeader title={t('live.title')} action={host && <Link href="/live/new" className="flex items-center gap-1 rounded-full bg-[#FF3333] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#ff4d4d]"><Plus className="size-4" />{t('live.new')}</Link>} />
      <p className="border-b px-4 py-3 text-sm text-muted-foreground">{t('live.lead')}</p>
      <LinkTabs sticky={false} active={tab} items={[{ key: 'live', label: t('live.tabs.live'), href: '/live' }, { key: 'replays', label: t('live.tabs.replays'), href: '/live?tab=replays' }]} />
      {list.items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{tab === 'live' ? t('live.none') : t('live.noneReplays')}</p>
        : <div className="grid gap-x-4 gap-y-6 p-4 sm:grid-cols-2">{list.items.map((l) => <LiveTile key={l.id} l={l} t={t} />)}</div>}
      <PagerLinks base="/live" params={{ tab: tab === 'live' ? undefined : tab }} page={list.page} hasMore={list.hasMore} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
    </>
  )
}
