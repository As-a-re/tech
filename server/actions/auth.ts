'use server'

import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { signPayload, verifyPayload } from '@/lib/crypto'
import { getLocale } from '@/lib/i18n/server'
import { completeRegistration, startRegistration, verifyRegistrationCode } from '@/server/identity/register'
import { verifySupabaseCredentials } from '@/server/identity/login'
import { normaliseChurchId, normalisePhone } from '@/lib/identity/normalise'
import { hit, clear } from '@/server/identity/rate-limit'
import { supabaseUserServer } from '@/lib/supabase/server'
import { finishReset, startReset } from '@/server/identity/password-reset'
import { sendCode } from '@/server/identity/codes'
import { createSession, destroyCurrentSession, getCurrentUser, requestMeta } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import { checkSecondFactor, isEnabled as twoFactorEnabled } from '@/server/account/two-factor'

/** Returned to forms. `error` and field errors are translation keys under auth.err.* */
export type AuthState = { error?: string; fields?: Record<string, string>; notice?: string; values?: Record<string, string> }

const REG = 'papa_reg'
const RESET = 'papa_reset'
const TWO_FA = 'papa_2fa'
type TwoFaTicket = { userId: string; phone: string; next: string }
type RegTicket = { churchId: string; phone: string; verified: boolean }
type ResetTicket = { userId: string | null; phone: string | null }

const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: env.isProduction, path: '/', maxAge })
const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/')
const str = (f: FormData, k: string) => String(f.get(k) ?? '')

export async function readRegTicket() {
  return verifyPayload<RegTicket>((await cookies()).get(REG)?.value, env.authSecret)
}
export async function readResetTicket() {
  return verifyPayload<ResetTicket>((await cookies()).get(RESET)?.value, env.authSecret)
}

/* ───────── Registration ───────── */

export async function registerStart(_: AuthState, form: FormData): Promise<AuthState> {
  const { ip } = await requestMeta()
  const r = await startRegistration(str(form, 'churchId'), str(form, 'phone'), ip)
  if (!r.ok) return { error: ('error' in r ? r.error : 'unknown'), values: { churchId: str(form, 'churchId'), phone: str(form, 'phone') } }
  ;(await cookies()).set(REG, signPayload({ churchId: r.churchId, phone: r.phone, verified: false } satisfies RegTicket, env.authSecret, 30 * 60), cookieOpts(30 * 60))
  redirect('/register')
}

export async function registerVerify(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await readRegTicket()
  if (!t) return { error: 'session_expired' }
  const r = await verifyRegistrationCode(t.phone, str(form, 'code').replace(/\D/g, ''))
  if (r !== 'ok') return { error: r === 'wrong' ? 'code_wrong' : r === 'locked' ? 'code_locked' : 'code_expired' }
  ;(await cookies()).set(REG, signPayload({ ...t, verified: true }, env.authSecret, 30 * 60), cookieOpts(30 * 60))
  redirect('/register')
}

export async function registerResend(_prev?: AuthState, _form?: FormData): Promise<AuthState> {
  const t = await readRegTicket()
  if (!t || t.verified) return { error: 'session_expired' }
  const r = await sendCode(t.phone, 'register')
  return r.ok ? { notice: 'resent' } : { error: ('reason' in r ? r.reason : 'unknown') }
}

export async function registerRestart() {
  ;(await cookies()).delete(REG)
  redirect('/register')
}

export async function registerComplete(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await readRegTicket()
  if (!t?.verified) return { error: 'session_expired' }
  const { ip } = await requestMeta()
  const r = await completeRegistration({
    churchId: t.churchId, phone: t.phone, username: str(form, 'username'), password: str(form, 'password'),
    confirm: str(form, 'confirm'), locale: await getLocale(), ip,
  })
  if (!r.ok) {
    const field = ('error' in r ? r.error : 'unknown').startsWith('username') ? 'username' : ('error' in r ? r.error : 'unknown') === 'password_mismatch' ? 'confirm' : ('error' in r ? r.error : 'unknown').startsWith('password') ? 'password' : null
    return field ? { fields: { [field]: ('error' in r ? r.error : 'unknown') }, values: { username: str(form, 'username') } } : { error: ('error' in r ? r.error : 'unknown') }
  }
  ;(await cookies()).delete(REG)
  const auth = await supabaseUserServer()
  const { error: signInError } = await auth.auth.signInWithPassword({ phone: t.phone, password: str(form, 'password') })
  if (signInError) {
    redirect('/login?notice=account_created')
  }
  await createSession(r.userId)
  redirect('/welcome')
}

/* ───────── Sign in / out ───────── */

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const identifier = str(form, 'identifier').trim()
  const password = str(form, 'password')
  const { ip } = await requestMeta()
  if (!identifier || !password) return { error: 'missing', values: { identifier } }
  const loginKey = identifier.toLowerCase()
  if (!(await hit(`login:id:${loginKey}`, 10, 900)) || !(await hit(`login:ip:${ip ?? 'unknown'}`, 50, 900))) return { error: 'too_many', values: { identifier } }

  const phone = normalisePhone(identifier)
  const safeIdentifier = identifier.replace(/^@/, '').replace(/[%,()]/g, '')
  let accountQuery = createSupabaseAdminClient().from('users').select('id,auth_user_id,phone,status,church_id').limit(1)
  accountQuery = phone.length === 12
    ? accountQuery.or(`church_id.eq.${normaliseChurchId(identifier)},username.ilike.${safeIdentifier},phone.eq.${phone}`)
    : accountQuery.or(`church_id.eq.${normaliseChurchId(identifier)},username.ilike.${safeIdentifier}`)
  const { data: account, error: accountError } = await accountQuery.maybeSingle()
  if (accountError) throw new Error(`Unable to look up account: ${accountError.message}`)
  if (!account?.auth_user_id) return { error: 'login_invalid', values: { identifier } }

  const authUser = await verifySupabaseCredentials(account.phone, password)
  if (!authUser || authUser.id !== account.auth_user_id) {
    await audit('account.login_failed', { target: identifier.slice(0, 40), ip })
    return { error: 'login_invalid', values: { identifier } }
  }
  if (account.status === 'suspended') return { error: 'suspended', values: { identifier } }
  const { data: member, error: memberError } = await createSupabaseAdminClient().from('church_members').select('active').eq('church_id', account.church_id).maybeSingle()
  if (memberError) throw new Error(`Unable to check church membership: ${memberError.message}`)
  if (!member?.active) return { error: 'inactive', values: { identifier } }

  if (await twoFactorEnabled(account.id)) {
    ;(await cookies()).set(TWO_FA, signPayload({ userId: account.id, phone: account.phone, next: safeNext(form.get('next')) } satisfies TwoFaTicket, env.authSecret, 5 * 60), cookieOpts(5 * 60))
    redirect('/login/verify')
  }

  const auth = await supabaseUserServer()
  const { data: session, error: signInError } = await auth.auth.signInWithPassword({ phone: account.phone, password })
  if (signInError || session.user?.id !== account.auth_user_id) return { error: 'login_invalid', values: { identifier } }
  await clear(`login:id:${loginKey}`)
  await audit('account.login', { actorId: account.id, ip })
  await createSession(account.id)
  const me = await getCurrentUser()
  redirect(me && !me.onboarded ? '/welcome' : safeNext(form.get('next')))
}

/* ───────── 2-step verification at sign-in ───────── */

export async function readTwoFaTicket() {
  return verifyPayload<TwoFaTicket>((await cookies()).get(TWO_FA)?.value, env.authSecret)
}

export async function verifySecondStep(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await readTwoFaTicket()
  if (!t) return { error: 'session_expired' }
  const { data: account, error: accountError } = await createSupabaseAdminClient().from('users').select('auth_user_id,status,church_id').eq('id', t.userId).maybeSingle()
  if (accountError) throw new Error(`Unable to look up account: ${accountError.message}`)
  const authUser = await verifySupabaseCredentials(t.phone, str(form, 'password'))
  if (!account?.auth_user_id || !authUser || authUser.id !== account.auth_user_id) return { error: 'login_invalid' }
  if (account.status === 'suspended') return { error: 'suspended' }
  const { data: member, error: memberError } = await createSupabaseAdminClient().from('church_members').select('active').eq('church_id', account.church_id).maybeSingle()
  if (memberError) throw new Error(`Unable to check church membership: ${memberError.message}`)
  if (!member?.active) return { error: 'inactive' }
  const r = await checkSecondFactor(t.userId, str(form, 'code').trim())
  if (r !== 'ok') return { error: r === 'too_many' ? 'too_many' : 'code_wrong' }
  const auth = await supabaseUserServer()
  const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({ phone: t.phone, password: str(form, 'password') })
  if (signInError || signedIn.user?.id !== account.auth_user_id) return { error: 'login_invalid' }
  ;(await cookies()).delete(TWO_FA)
  await createSession(t.userId)
  await audit('account.login_2fa', { actorId: t.userId, ip: (await requestMeta()).ip })
  const me = await getCurrentUser()
  redirect(me && !me.onboarded ? '/welcome' : safeNext(t.next))
}

export async function signOut() {
  const me = await getCurrentUser()
  // In the Android/iOS app: stop this device's notifications for this account
  const jar = await cookies()
  const native = jar.get('papa_native_push')?.value
  if (me && native?.startsWith('fcm:')) { const { error } = await createSupabaseAdminClient().from('push_subscriptions').delete().eq('user_id', me.id).eq('endpoint', native); if (error) throw new Error(`Unable to remove push subscription: ${error.message}`) }
  await destroyCurrentSession()
  if (me) await audit('account.logout', { actorId: me.id, ip: (await requestMeta()).ip })
  redirect('/')
}

/* ───────── Forgot password ───────── */

export async function resetStart(_: AuthState, form: FormData): Promise<AuthState> {
  const { ip } = await requestMeta()
  const r = await startReset(str(form, 'identifier'), ip)
  if (!r.ok) return { error: ('error' in r ? r.error : 'unknown'), values: { identifier: str(form, 'identifier') } }
  ;(await cookies()).set(RESET, signPayload({ userId: r.userId, phone: r.phone } satisfies ResetTicket, env.authSecret, 15 * 60), cookieOpts(15 * 60))
  redirect('/forgot-password')
}

export async function resetFinish(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await readResetTicket()
  if (!t) return { error: 'session_expired' }
  const { ip } = await requestMeta()
  const r = await finishReset({ ...t, code: str(form, 'code').replace(/\D/g, ''), password: str(form, 'password'), confirm: str(form, 'confirm'), ip })
  if (!r.ok) {
    const field = ('error' in r ? r.error : 'unknown').startsWith('code') ? 'code' : ('error' in r ? r.error : 'unknown') === 'password_mismatch' ? 'confirm' : 'password'
    return { fields: { [field]: ('error' in r ? r.error : 'unknown') } }
  }
  ;(await cookies()).delete(RESET)
  if (!t.phone) return { error: 'session_expired' }
  const auth = await supabaseUserServer()
  const { error: signInError } = await auth.auth.signInWithPassword({ phone: t.phone, password: str(form, 'password') })
  if (signInError) return { error: 'login_invalid' }
  await createSession(r.userId)
  redirect('/?notice=password_reset')
}

export async function resetRestart() {
  ;(await cookies()).delete(RESET)
  redirect('/forgot-password')
}
