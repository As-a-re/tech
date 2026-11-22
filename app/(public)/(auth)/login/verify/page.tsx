import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { readTwoFaTicket } from '@/server/actions/auth'
import { VerifyForm } from './form'

export const metadata = { title: '2-step verification' }

export default async function VerifyPage() {
  const [ticket, t] = await Promise.all([readTwoFaTicket(), getT()])
  if (!ticket) redirect('/login')
  return (
    <>
      <h1 className="text-2xl font-bold">{t('auth.twoFaTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('auth.twoFaLead')}</p>
      <VerifyForm />
      <p className="mt-8 text-center text-sm"><Link href="/login" className="font-semibold text-primary hover:underline">{t('auth.backToSignIn')}</Link></p>
    </>
  )
}
