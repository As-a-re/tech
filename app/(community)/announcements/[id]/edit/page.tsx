import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getAnnouncement } from '@/server/community/announcements'
import { PageHeader } from '@/components/common/page-header'
import { AnnouncementForm } from '@/components/community/announcement-form'

export const metadata = { title: 'Edit announcement' }

export default async function EditAnnouncement({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()])
  const me = await requireUser(`/announcements/${id}/edit`)
  const a = await getAnnouncement(id, me.id)
  if (!a || !a.viewer.isAuthor) notFound()
  return (
    <>
      <PageHeader title={t('announcements.edit')} back={`/announcements/${id}`} />
      <AnnouncementForm home={{ districtName: a.district?.name ?? me.districtName, assemblyName: a.assembly?.name ?? me.assemblyName }}
        initial={{ id, level: a.level, title: a.title, body: a.body, important: a.important, media: a.media }} />
    </>
  )
}
