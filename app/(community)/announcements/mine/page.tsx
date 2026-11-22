import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { listAnnouncements } from '@/server/community/announcements'
import { PageHeader } from '@/components/common/page-header'
import { AnnouncementList } from '@/components/community/announcement-list'

export const metadata = { title: 'My announcements' }

export default async function MyAnnouncements({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/announcements/mine'), getT(), searchParams])
  const list = await listAnnouncements({ authorId: me.id, page: Number(sp.page) || 1, viewerId: me.id })
  return (
    <>
      <PageHeader title={t('announcements.mine')} back="/announcements" />
      <AnnouncementList items={list.items} page={list.page} hasMore={list.hasMore} base="/announcements/mine" empty={t('announcements.noneMine')}
        signedIn isAdmin={me.role === 'tech_admin'} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
    </>
  )
}
