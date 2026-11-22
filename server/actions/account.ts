'use server'

import { marketBlockers } from '@/server/market/payouts'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { currentSessionId, requireUser } from '@/server/identity/session'
import * as account from '@/server/account/account'
import * as twoFactor from '@/server/account/two-factor'
import { updateProfile } from '@/server/account/profile'
import { otpauthUrl } from '@/lib/totp'
import { DISPLAY_COOKIES } from '@/lib/display'

export type FormResult = { ok?: boolean; error?: string; fields?: Record<string, string>; data?: Record<string, unknown> }
const s = (f: FormData, k: string) => String(f.get(k) ?? '')
const refresh = () => revalidatePath('/', 'layout')

export async function saveProfile(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/profile')
  const file = (k: string) => { const v = f.get(k); return v instanceof File ? v : null }
  const r = await updateProfile(me.id, {
    bio: s(f, 'bio'), website: s(f, 'website'), anniversary: s(f, 'anniversary'), avatar: file('avatar'), cover: file('cover'),
    removeAvatar: f.get('removeAvatar') === '1', removeCover: f.get('removeCover') === '1',
  })
  if (!r.ok) return { fields: { [('field' in r ? r.field : 'form')]: ('error' in r ? r.error : 'unknown') } }
  refresh()
  return { ok: true }
}

export async function saveUsername(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/account')
  const r = await account.changeUsername(me.id, s(f, 'username'))
  if (!r.ok) return { fields: { username: ('error' in r ? r.error : 'unknown') }, data: { days: ('days' in r ? r.days : 0) ?? 0 } }
  refresh()
  return { ok: true }
}

export async function saveEmail(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/account')
  if (!(await account.changeEmail(me.id, s(f, 'email')))) return { fields: { email: 'email_invalid' } }
  refresh()
  return { ok: true }
}

export async function savePassword(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/security')
  const r = await account.changePassword(me.id, s(f, 'current'), s(f, 'password'), s(f, 'confirm'), await currentSessionId())
  return r.ok ? { ok: true } : { fields: { [('field' in r ? r.field : 'form')]: ('error' in r ? r.error : 'unknown') } }
}

export async function startTwoFactor(): Promise<{ secret: string; qr: string }> {
  const me = await requireUser('/settings/security')
  const secret = await twoFactor.beginSetup(me.id)
  const qr = await QRCode.toString(otpauthUrl(secret, me.username), { type: 'svg', margin: 1, width: 200, color: { dark: '#1E3FA0', light: '#ffffff' } })
  return { secret, qr }
}

export async function confirmTwoFactor(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/security')
  const codes = await twoFactor.confirmSetup(me.id, s(f, 'code'))
  if (!codes) return { fields: { code: 'code_wrong' } }
  revalidatePath('/settings/security')
  return { ok: true, data: { codes } }
}

export async function disableTwoFactor(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/security')
  if (!(await twoFactor.disable(me.id, s(f, 'password')))) return { fields: { password: 'current_wrong' } }
  revalidatePath('/settings/security')
  return { ok: true }
}

export async function revokeSessionAction(sessionId: string) {
  const me = await requireUser('/settings/devices')
  await account.revokeSession(me.id, sessionId)
  revalidatePath('/settings/devices')
}

export async function signOutOtherDevices() {
  const me = await requireUser('/settings/devices')
  const keep = await currentSessionId()
  for (const ses of await account.listSessions(me.id)) if (ses.id !== keep) await account.revokeSession(me.id, ses.id)
  revalidatePath('/settings/devices')
}

export async function savePrivacy(patch: account.PrivacyPatch) {
  const me = await requireUser('/settings/privacy')
  await account.updatePrivacy(me.id, patch)
  refresh()
}

/** Text size and data saver: saved on the account and on this device. */
export async function saveDisplay(patch: { textSize?: 'small' | 'default' | 'large' | 'xlarge'; dataSaver?: boolean }) {
  const me = await requireUser('/settings/display')
  await account.updateDisplay(me.id, patch)
  const jar = await cookies()
  const opts = { path: '/', maxAge: 31536000, sameSite: 'lax' as const }
  if (patch.textSize) jar.set(DISPLAY_COOKIES.textSize, patch.textSize, opts)
  if (patch.dataSaver !== undefined) jar.set(DISPLAY_COOKIES.dataSaver, patch.dataSaver ? '1' : '0', opts)
  refresh()
}

export async function deleteAccountAction(_: FormResult, f: FormData): Promise<FormResult> {
  const me = await requireUser('/settings/your-data')
  if (s(f, 'confirm').trim().toUpperCase() !== 'DELETE') return { fields: { confirm: 'confirm_word' } }
  // Orders in progress, money held or payouts not yet sent must be settled first
  if (await marketBlockers(me.id)) return { error: 'market_open' }
  if (!(await account.deleteAccount(me.id, s(f, 'password')))) return { fields: { password: 'current_wrong' } }
  ;(await cookies()).delete('papa_session')
  redirect('/?notice=account_deleted')
}
