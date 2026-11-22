import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { readResetTicket } from '@/server/actions/auth'
import { ResetFinish, ResetStart } from './forms'

export const metadata = { title: 'Reset password' }

export default async function ForgotPasswordPage() {
  const [ticket, t] = await Promise.all([readResetTicket(), getT()])
  return (
    <>
      {ticket ? <ResetFinish /> : <ResetStart />}
      <p className="mt-8 text-center text-sm"><Link href="/login" className="font-semibold text-primary hover:underline">{t('auth.backToSignIn')}</Link></p>
    </>
  )
}
