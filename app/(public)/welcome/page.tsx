import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { Onboarding } from './onboarding'

export const metadata = { title: 'Welcome' }

export default async function WelcomePage() {
  const me = await requireUser('/welcome')
  if (me.onboarded) redirect('/')
  const [{ data: row, error }, t] = await Promise.all([createSupabaseAdminClient().from('users').select('bio').eq('id', me.id).maybeSingle(), getT()])
  if (error) throw new Error(`Unable to load onboarding profile: ${error.message}`)
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={48} height={48} className="mx-auto size-12 rounded-full bg-white" />
        <h1 className="mt-4 text-center text-2xl font-bold">{t('onboarding.title', { name: me.fullName.split(' ')[0] })}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{t('onboarding.lead')}</p>
        <Onboarding name={me.fullName} avatarUrl={me.avatarUrl} bio={row?.bio ?? ''} />
      </div>
    </div>
  )
}
