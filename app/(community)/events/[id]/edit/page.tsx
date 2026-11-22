import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getEvent } from '@/server/community/events'
import { PageHeader } from '@/components/common/page-header'
import { EventForm } from '@/components/community/event-form'

export const metadata = { title: 'Edit event' }

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()])
  const me = await requireUser(`/events/${id}/edit`)
  const e = await getEvent(id, me.id)
  if (!e || !e.viewer.isAuthor || e.cancelled) notFound()
  return (
    <>
      <PageHeader title={t('events.edit')} back={`/events/${id}`} />
      <EventForm home={{ districtName: e.district?.name ?? me.districtName, assemblyName: e.assembly?.name ?? me.assemblyName }} initial={e} />
    </>
  )
}
