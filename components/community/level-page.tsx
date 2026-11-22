import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { listAnnouncements } from '@/server/community/announcements'
import { isSubscribed, scopeKey, type Scope } from '@/server/community/levels'
import { PageHeader } from '@/components/common/page-header'
import { AnnouncementList } from './announcement-list'
import { NotifyToggle } from './notify-toggle'

/** Announcements of one district or assembly (any member can follow any level). */
export async function LevelAnnouncements({ scope, name, sub, base, page, directoryHref }: { scope: Scope; name: string; sub: string; base: string; page: number; directoryHref: string }) {
  const [t, me] = await Promise.all([getT(), getCurrentUser()])
  const [list, on] = await Promise.all([listAnnouncements({ scope, page, viewerId: me?.id ?? null }), me ? isSubscribed(me.id, scopeKey(scope)) : false])
  return (
    <>
      <PageHeader title={name} subtitle={`${t('announcements.title')} · ${sub}`} back="/announcements" />
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <Link href={directoryHref} className="text-sm font-medium text-primary hover:underline">{t('directory.short')}</Link>
        {me && <NotifyToggle scopeKey={scopeKey(scope)} initial={on} />}
      </div>
      <AnnouncementList items={list.items} page={list.page} hasMore={list.hasMore} base={base} empty={t('announcements.none')}
        signedIn={!!me} isAdmin={me?.role === 'tech_admin'} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
    </>
  )
}
