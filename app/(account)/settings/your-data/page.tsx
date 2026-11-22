import { Download } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { Card, SettingsPage } from '@/components/settings/section'
import { DeleteForm } from './delete-form'

export const metadata = { title: 'Your data' }

export default async function Page() {
  const [, t] = await Promise.all([requireUser('/settings/your-data'), getT()])
  return (
    <SettingsPage title={t('settings.sections.yourData')}>
      <Card title={t('settings.yourData.downloadTitle')} text={t('settings.yourData.downloadText')}>
        <a href="/settings/your-data/export" download className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"><Download className="size-4" />{t('settings.yourData.download')}</a>
      </Card>
      <Card title={t('settings.yourData.deleteTitle')} text={t('settings.yourData.deleteText')}><DeleteForm /></Card>
    </SettingsPage>
  )
}
