import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normaliseChurchId, normalisePhone } from '@/lib/identity/normalise'
import { passwordProblem } from '@/lib/identity/rules'
import { checkCode, sendCode } from './codes'
import { hashPassword } from './register'
import { hit } from './rate-limit'
import { audit } from './audit'
import { destroyAllSessions } from './session'

export async function startReset(identifier: string, ip: string | null): Promise<{ ok: true; userId: string | null; phone: string | null } | { ok: false; error: 'missing' | 'too_many' | 'sms_failed' }> {
  const ident = identifier.trim(); if (!ident) return { ok: false, error: 'missing' }
  if (!(await hit(`reset:ip:${ip ?? 'unknown'}`, 10, 3600))) return { ok: false, error: 'too_many' }
  const phone = normalisePhone(ident), sb = createSupabaseAdminClient()
  const safeIdent = ident.replace(/^@/, '').replace(/[%,()]/g, '')
  const filter = phone.length === 12 ? `church_id.eq.${normaliseChurchId(ident)},username.ilike.${safeIdent},phone.eq.${phone}` : `church_id.eq.${normaliseChurchId(ident)},username.ilike.${safeIdent}`
  const { data: u, error } = await sb.from('users').select('id,phone').or(filter).limit(1).maybeSingle()
  if (error) throw new Error(`Unable to find account: ${error.message}`)
  if (!u) return { ok: true, userId: null, phone: null }
  const sent = await sendCode(u.phone, 'reset_password')
  if (!sent.ok) return { ok: false, error: 'reason' in sent && (sent.reason === 'too_many' || sent.reason === 'sms_failed') ? sent.reason : 'missing' }
  return { ok: true, userId: u.id, phone: u.phone }
}
export type FinishResult = { ok: true; userId: string } | { ok: false; error: 'code_wrong' | 'code_expired' | 'code_locked' | 'password_short' | 'password_long' | 'password_weak' | 'password_mismatch' }
export async function finishReset(input: { userId: string | null; phone: string | null; code: string; password: string; confirm: string; ip: string | null }): Promise<FinishResult> {
  const pp = passwordProblem(input.password); if (pp) return { ok: false, error: `password_${pp}` }
  if (input.password !== input.confirm) return { ok: false, error: 'password_mismatch' }
  if (!input.userId || !input.phone) return { ok: false, error: 'code_wrong' }
  const r = await checkCode(input.phone, 'reset_password', input.code)
  if (r !== 'ok') return { ok: false, error: r === 'wrong' ? 'code_wrong' : r === 'locked' ? 'code_locked' : 'code_expired' }
  const { error } = await createSupabaseAdminClient().from('users').update({ password_hash: await hashPassword(input.password), password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', input.userId)
  if (error) throw new Error(`Unable to reset password: ${error.message}`)
  await destroyAllSessions(input.userId)
  await audit('account.password_reset', { actorId: input.userId, ip: input.ip })
  return { ok: true, userId: input.userId }
}
