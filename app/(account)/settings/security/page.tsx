import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { isEnabled, remainingBackupCodes } from '@/server/account/two-factor'
import { Card, SettingsPage } from '@/components/settings/section'
import { PasswordForm, TwoFactor } from './forms'

export const metadata = { title: 'Password & security' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/security'), getT()])
  const [on, left] = await Promise.all([isEnabled(me.id), remainingBackupCodes(me.id)])
  return (
    <SettingsPage title={t('settings.sections.security')}>
      <Card title={t('settings.security.passwordTitle')} text={t('settings.security.passwordNote')}><PasswordForm /></Card>
      <Card title={t('settings.security.twoFaTitle')}><TwoFactor enabled={on} backupLeft={left} /></Card>
    </SettingsPage>
  )
}
