import { WifiOff } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { Brand } from '@/components/shell/brand'
import { StatusScreen } from '@/components/common/status-screen'

export const metadata = { title: 'Offline' }
export const dynamic = 'force-static'

export default async function OfflinePage() {
  const t = await getT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <Brand subtitle={t('app.church')} />
      <StatusScreen className="py-10" icon={<WifiOff className="size-7" />} title={t('errors.offlineTitle')} text={t('errors.offlineText')} />
    </div>
  )
}
