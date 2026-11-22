import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { EventForm } from '@/components/community/event-form'

export const metadata = { title: 'New event' }

export default async function NewEvent() {
  const [me, t] = await Promise.all([requireUser('/events/new'), getT()])
  return <><PageHeader title={t('events.new')} back="/events" /><EventForm home={{ districtName: me.districtName, assemblyName: me.assemblyName }} /></>
}
