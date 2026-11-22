import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { AnnouncementForm } from '@/components/community/announcement-form'

export const metadata = { title: 'New announcement' }

export default async function NewAnnouncement() {
  const [me, t] = await Promise.all([requireUser('/announcements/new'), getT()])
  return <><PageHeader title={t('announcements.new')} back="/announcements" /><AnnouncementForm home={{ districtName: me.districtName, assemblyName: me.assemblyName }} /></>
}
