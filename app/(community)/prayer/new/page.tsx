import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { PrayerForm } from '@/components/devotion/prayer-form'

export const metadata = { title: 'New prayer request' }

export default async function NewPrayer() {
  const [me, t] = await Promise.all([requireUser('/prayer/new'), getT()])
  return <><PageHeader title={t('prayer.new')} back="/prayer" /><PrayerForm assemblyName={me.assemblyName} /></>
}
