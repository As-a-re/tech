import { Wrench } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { Brand } from '@/components/shell/brand'
import { StatusScreen } from '@/components/common/status-screen'

export const metadata = { title: 'Maintenance' }

export default async function MaintenancePage() {
  const t = await getT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <Brand subtitle={t('app.church')} />
      <StatusScreen className="py-10" icon={<Wrench className="size-7" />} title={t('errors.maintenanceTitle')} text={t('errors.maintenanceText')} />
    </div>
  )
}
