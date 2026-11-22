import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { formatPhone } from '@/lib/identity/normalise'
import { requireUser } from '@/server/identity/session'
import { Card, SettingsPage } from '@/components/settings/section'
import { EmailForm, UsernameForm } from './forms'

export const metadata = { title: 'Account' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/account'), getT()])
  const { data: u, error } = await createSupabaseAdminClient().from('users').select('email,phone').eq('id', me.id).maybeSingle()
  if (error || !u) throw new Error(`Unable to load account settings${error ? `: ${error.message}` : ''}`)
  const rows: [string, string][] = [
    [t('settings.account.churchId'), me.churchId], [t('settings.account.fullName'), me.fullName], [t('settings.account.phone'), formatPhone(u.phone)],
    [t('settings.account.assembly'), me.assemblyName], [t('settings.account.district'), me.districtName],
    [t('settings.account.role'), me.role === 'tech_admin' ? t('settings.account.techAdmin') : t('settings.account.member')],
  ]
  return (
    <SettingsPage title={t('settings.sections.account')}>
      <Card><UsernameForm username={me.username} /></Card>
      <Card><EmailForm email={u.email ?? ''} /></Card>
      <Card title={t('settings.account.churchTitle')} text={t('settings.account.churchNote')}>
        <dl className="divide-y rounded-xl bg-muted/50 text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
      </Card>
    </SettingsPage>
  )
}
