import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { discoverGroups, myGroups } from '@/server/messages/groups'
import { PageHeader } from '@/components/common/page-header'
import { PagerLinks } from '@/components/common/pager-links'
import { LinkChips } from '@/components/community/tabs'
import { JoinButton } from '@/components/groups/join-button'

export const metadata = { title: 'Groups' }

function Photo({ url }: { url: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="size-12 shrink-0 rounded-full object-cover" />
    : <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-6" /></span>
}

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), requireUser('/groups'), searchParams])
  const tab = sp.tab === 'discover' ? 'discover' : 'mine'
  const action = <Link href="/groups/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('groups.new')}</Link>
  return (
    <>
      <PageHeader title={t('groups.title')} action={action} />
      <div className="space-y-3 border-b px-4 py-3">
        <LinkChips active={tab} items={[{ key: 'mine', label: t('groups.mine'), href: '/groups' }, { key: 'discover', label: t('groups.discover'), href: '/groups?tab=discover' }]} />
        {tab === 'discover' && (
          <form action="/groups" className="flex gap-2">
            <input type="hidden" name="tab" value="discover" />
            <input name="q" defaultValue={sp.q ?? ''} placeholder={t('groups.searchPh')} aria-label={t('groups.searchPh')}
              className="h-10 min-w-0 flex-1 rounded-full border bg-muted/60 px-4 text-sm outline-none focus:border-primary focus:bg-background" />
          </form>
        )}
      </div>
      {tab === 'mine' ? await (async () => {
        const list = await myGroups(me.id)
        if (!list.length) return <p className="px-8 py-16 text-center text-muted-foreground">{t('groups.none')} <Link href="/groups?tab=discover" className="font-semibold text-primary hover:underline">{t('groups.discover')}</Link></p>
        return <ul className="divide-y">{list.map((g) => (
          <li key={g.id}><Link href={`/messages/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <Photo url={g.avatarUrl} />
            <span className="min-w-0 flex-1"><b className="block truncate">{g.title}</b>
              <span className="block truncate text-sm text-muted-foreground">{t('groups.members', { n: g.members })}{g.role === 'admin' && ` · ${t('groups.youAdmin')}`}</span></span>
          </Link></li>
        ))}</ul>
      })() : await (async () => {
        const list = await discoverGroups(me.id, sp.q, Number(sp.page) || 1)
        if (!list.items.length) return <p className="px-8 py-16 text-center text-muted-foreground">{t('groups.noneDiscover')}</p>
        return <>
          <ul className="divide-y">{list.items.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <Photo url={g.avatarUrl} />
              <span className="min-w-0 flex-1"><b className="block truncate">{g.title}</b>
                <span className="block truncate text-sm text-muted-foreground">{t('groups.members', { n: g.members })}{g.approveJoins && ` · ${t('groups.needsApproval')}`}</span>
                {g.description && <span className="line-clamp-2 text-sm">{g.description}</span>}</span>
              <JoinButton id={g.id} via="discover" member={g.member} requested={g.requested} approve={g.approveJoins} />
            </li>
          ))}</ul>
          <PagerLinks base="/groups" params={{ tab: 'discover', q: sp.q || undefined }} page={list.page} hasMore={list.hasMore} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
        </>
      })()}
    </>
  )
}
