import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { getAnnouncement, markAnnouncementsSeen } from '@/server/community/announcements'
import { PageHeader } from '@/components/common/page-header'
import { AnnouncementCard } from '@/components/community/announcement-card'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = await getAnnouncement((await params).id, null)
  return { title: a?.title ?? 'Announcement', description: a?.body.slice(0, 160) }
}

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const a = await getAnnouncement(id, me?.id ?? null, true)
  if (!a) notFound()
  if (me) await markAnnouncementsSeen(me.id, id)
  const back = a.level === 'national' ? '/announcements' : a.level === 'district' ? `/announcements/d/${a.district!.slug}` : `/announcements/a/${a.assembly!.slug}`
  return (
    <>
      <PageHeader title={t('announcements.title')} back={back} />
      <AnnouncementCard a={a} full signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />
    </>
  )
}
