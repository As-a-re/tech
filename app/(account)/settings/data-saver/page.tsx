import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getPreferences } from '@/server/social/relationships'
import { SettingsPage } from '@/components/settings/section'
import { DataSaverSwitch } from './switch'

export const metadata = { title: 'Data saver' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/data-saver'), getT()])
  const p = await getPreferences(me.id)
  return <SettingsPage title={t('settings.sections.dataSaver')}><DataSaverSwitch on={p.dataSaver} /></SettingsPage>
}
