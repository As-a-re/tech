import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getPrefs } from '@/server/notifications/notify'
import { pushPublicKey } from '@/integrations/push'
import { SettingsPage } from '@/components/settings/section'
import { MessagePushRow, NotificationPrefs, PushToggle } from './controls'

export const metadata = { title: 'Notifications' }
const TYPES = ['like', 'repost', 'reply', 'quote', 'mention', 'follow', 'follow_request', 'follow_accept', 'announcement', 'event', 'event_reminder', 'event_cancelled', 'publication', 'live', 'payment', 'resource_order', 'market_order', 'market_sale', 'market_question', 'market_review', 'market_alert', 'market_new', 'market_delivery', 'market_payout', 'market_rider'] as const

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/notifications'), getT()])
  const prefs = await getPrefs(me.id)
  return (
    <SettingsPage title={t('notifSettings.title')}>
      <PushToggle publicKey={pushPublicKey()} />
      <MessagePushRow initial={prefs.message.push} />
      <MessagePushRow kind="call" initial={prefs.call.push} />
      <NotificationPrefs types={[...TYPES]} prefs={Object.fromEntries(TYPES.map((k) => [k, prefs[k]]))} />
    </SettingsPage>
  )
}
