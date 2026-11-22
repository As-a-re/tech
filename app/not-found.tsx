import { SearchX } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { AppShell } from '@/components/shell/app-shell'
import { HomeButton, StatusScreen } from '@/components/common/status-screen'

export default async function NotFound() {
  const t = await getT()
  return (
    <AppShell>
      <StatusScreen icon={<SearchX className="size-7" />} title={t('errors.notFoundTitle')} text={t('errors.notFoundText')} action={<HomeButton label={t('errors.goHome')} />} />
    </AppShell>
  )
}
