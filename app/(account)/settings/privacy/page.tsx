import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getPreferences } from '@/server/social/relationships'
import { SettingsPage } from '@/components/settings/section'
import { PrivacySwitches } from './switches'

export const metadata = { title: 'Privacy' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/privacy'), getT()])
  const p = await getPreferences(me.id)
  return <SettingsPage title={t('settings.sections.privacy')}><PrivacySwitches privateProfile={p.privateProfile} visibleToGuests={p.visibleToGuests} showBirthday={p.showBirthday} messagesFrom={p.messagesFrom} callsFrom={p.callsFrom} readReceipts={p.readReceipts} showLastSeen={p.showLastSeen} /></SettingsPage>
}
