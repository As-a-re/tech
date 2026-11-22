import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const [{ next }, t] = await Promise.all([searchParams, getT()])
  return (
    <>
      <h1 className="text-2xl font-bold">{t('auth.signInTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('auth.signInLead')}</p>
      <LoginForm next={next} />
      <p className="mt-8 text-center text-sm text-muted-foreground">{t('auth.newHere')} <Link href="/register" className="font-semibold text-primary hover:underline">{t('auth.joinLink')}</Link></p>
      <p className="mt-2 text-center text-sm"><Link href="/" className="text-muted-foreground hover:underline">{t('auth.guest')}</Link></p>
    </>
  )
}
