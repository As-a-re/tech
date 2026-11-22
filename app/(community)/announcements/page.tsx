import Link from 'next/link'
import { Church, MapPinned, Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { listAnnouncements, markAnnouncementsSeen } from '@/server/community/announcements'
import { isSubscribed, scopeKey, searchScopes, type Scope } from '@/server/community/levels'
import { PageHeader } from '@/components/common/page-header'
import { AnnouncementList } from '@/components/community/announcement-list'
import { LinkTabs, SearchForm } from '@/components/community/tabs'
import { NotifyToggle } from '@/components/community/notify-toggle'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; find?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const tab = me && (sp.tab === 'district' || sp.tab === 'local') ? sp.tab : 'national'
  const scope: Scope = tab === 'national' || !me ? { level: 'national' } : tab === 'district' ? { level: 'district', districtId: me.districtId } : { level: 'local', assemblyId: me.assemblyId }
  const q = sp.q?.trim() || undefined
  const page = Number(sp.page) || 1
  const [list, subscribed, found] = await Promise.all([
    listAnnouncements(q ? { q, page, viewerId: me?.id ?? null } : { scope, page, viewerId: me?.id ?? null }),
    me ? isSubscribed(me.id, scopeKey(scope)) : false,
    sp.find ? searchScopes(sp.find) : Promise.resolve([]),
  ])
  if (me) await markAnnouncementsSeen(me.id)
  const tabs = [{ key: 'national', label: t('announcements.tabs.national'), href: '/announcements' }]
  if (me) tabs.push({ key: 'district', label: t('announcements.tabs.district'), href: '/announcements?tab=district' }, { key: 'local', label: t('announcements.tabs.local'), href: '/announcements?tab=local' })
  const where = tab === 'national' ? t('levels.nationalLong') : tab === 'district' ? me!.districtName : me!.assemblyName
  return (
    <>
      <PageHeader title={t('announcements.title')} action={me && (
        <Link href="/announcements/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('announcements.new')}</Link>
      )} />
      {!q && <LinkTabs items={tabs} active={tab} />}
      <div className="space-y-3 border-b px-4 py-3">
        <SearchForm action="/announcements" q={q} placeholder={t('announcements.searchPh')} />
        {!q && (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-muted-foreground">{where}</p>
            {me && <NotifyToggle key={scopeKey(scope)} scopeKey={scopeKey(scope)} initial={subscribed} />}
          </div>
        )}
        {!me && <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">{t('announcements.guestNote')}</p>}
        {me && <Link href="/announcements/mine" className="inline-block text-sm font-medium text-primary hover:underline">{t('announcements.mine')}</Link>}
      </div>
      <AnnouncementList items={list.items} page={list.page} hasMore={list.hasMore} base="/announcements" params={{ tab: tab === 'national' ? undefined : tab, q }}
        empty={q ? t('announcements.noneSearch', { q }) : t('announcements.none')} signedIn={!!me} isAdmin={me?.role === 'tech_admin'}
        labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
      <section className="border-t px-4 py-5">
        <h2 className="mb-2 font-bold">{t('levels.find')}</h2>
        <FindForm value={sp.find} placeholder={t('levels.findPh')} tab={tab === 'national' ? undefined : tab} />
        {sp.find && (found.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('levels.noMatch', { q: sp.find })}</p> : (
          <ul className="mt-3 divide-y rounded-xl border">
            {found.map((f) => (
              <li key={f.id}><Link href={`/announcements/${f.kind === 'district' ? 'd' : 'a'}/${f.slug}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                {f.kind === 'district' ? <MapPinned className="size-4 text-primary" /> : <Church className="size-4 text-primary" />}
                <span className="min-w-0 flex-1 truncate text-sm"><b>{f.name}</b>{f.sub && <span className="text-muted-foreground"> · {f.sub}</span>}</span>
                <span className="text-xs text-muted-foreground">{f.kind === 'district' ? t('levels.district') : t('levels.local')}</span>
              </Link></li>
            ))}
          </ul>
        ))}
      </section>
    </>
  )
}

function FindForm({ value, placeholder, tab }: { value?: string; placeholder: string; tab?: string }) {
  return (
    <form action="/announcements" className="relative">
      {tab && <input type="hidden" name="tab" value={tab} />}
      <input name="find" defaultValue={value} placeholder={placeholder} aria-label={placeholder} className="h-10 w-full rounded-full border bg-muted/60 px-4 text-sm outline-none focus:border-primary focus:bg-background" />
    </form>
  )
}
