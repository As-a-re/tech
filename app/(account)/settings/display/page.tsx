import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getPreferences } from '@/server/social/relationships'
import { SettingsPage } from '@/components/settings/section'
import { DisplayForm } from './form'

export const metadata = { title: 'Display' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/display'), getT()])
  const p = await getPreferences(me.id)
  return <SettingsPage title={t('settings.sections.display')}><DisplayForm textSize={p.textSize} /></SettingsPage>
}
