import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { maskPhone } from '@/lib/identity/normalise'
import { getCurrentUser } from '@/server/identity/session'
import { readRegTicket } from '@/server/actions/auth'
import { StepAccount, StepCode, StepMember } from './steps'

export const metadata = { title: 'Join PAPA' }

/** Church ID → SMS code → username & password. The step comes from a signed, short-lived cookie, so refreshing is safe. */
export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/')
  const [ticket, t] = await Promise.all([readRegTicket(), getT()])
  const step = !ticket ? 1 : ticket.verified ? 3 : 2
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-red">{t('auth.step', { n: step })}</p>
      <div className="mt-2 flex gap-1.5" aria-hidden>{[1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
      {step === 1 && <StepMember />}
      {step === 2 && <StepCode masked={maskPhone(ticket!.phone)} />}
      {step === 3 && <StepAccount churchId={ticket!.churchId} />}
      <p className="mt-8 text-center text-sm text-muted-foreground">{t('auth.haveAccount')} <Link href="/login" className="font-semibold text-primary hover:underline">{t('auth.signIn')}</Link></p>
    </>
  )
}
