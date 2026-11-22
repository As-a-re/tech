import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { SettingsPage } from '@/components/settings/section'
import { ProfileForm } from './form'

export const metadata = { title: 'Edit profile' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/profile'), getT()])
  const { data: u, error } = await createSupabaseAdminClient().from('users').select('bio,website,cover_url,anniversary').eq('id', me.id).maybeSingle()
  if (error || !u) throw new Error(`Unable to load profile settings${error ? `: ${error.message}` : ''}`)
  return (
    <SettingsPage title={t('settings.sections.profile')}>
      <ProfileForm name={me.fullName} username={me.username} avatarUrl={me.avatarUrl} coverUrl={u.cover_url} bio={u.bio ?? ''} website={u.website ?? ''} anniversary={u.anniversary ?? ''} />
    </SettingsPage>
  )
}
