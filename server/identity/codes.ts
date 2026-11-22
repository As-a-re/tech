import 'server-only'
import { randomUUID } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { randomCode, safeEqual, sha256 } from '@/lib/crypto'
import { sendSms } from '@/integrations/sms'
import { hit } from './rate-limit'

type Purpose = 'register' | 'reset_password' | 'change_phone'
const TTL_MIN = 10
const MAX_ATTEMPTS = 5
const hashCode = (id: string, code: string) => sha256(`${id}:${code}:${env.authSecret}`)
const MESSAGES: Record<Purpose, (c: string) => string> = {
  register: c => `${c} is your PAPA verification code. It expires in ${TTL_MIN} minutes. Do not share it with anyone.`,
  reset_password: c => `${c} is your PAPA password reset code. It expires in ${TTL_MIN} minutes. If you did not ask for this, ignore this message.`,
  change_phone: c => `${c} is your PAPA code to confirm this phone number. It expires in ${TTL_MIN} minutes.`,
}
export type SendResult = { ok: true } | { ok: false; reason: 'too_many' | 'sms_failed' }
export async function sendCode(phone: string, purpose: Purpose): Promise<SendResult> {
  if (!(await hit(`sms:${purpose}:${phone}`, 3, 900))) return { ok: false, reason: 'too_many' }
  const sb = createSupabaseAdminClient(), code = randomCode(), now = new Date().toISOString(), id = randomUUID()
  const { error: consumeError } = await sb.from('verification_codes').update({ consumed_at: now }).eq('phone', phone).eq('purpose', purpose).is('consumed_at', null)
  if (consumeError) throw new Error(`Unable to invalidate previous codes: ${consumeError.message}`)
  const { error } = await sb.from('verification_codes').insert({ id, phone, purpose, code_hash: hashCode(id, code), expires_at: new Date(Date.now() + TTL_MIN * 60_000).toISOString() })
  if (error) throw new Error(`Unable to create verification code: ${error.message}`)
  try { await sendSms(phone, MESSAGES[purpose](code)); return { ok: true } }
  catch (e) {
    console.error('SMS send failed', e)
    await sb.from('verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', id)
    return { ok: false, reason: 'sms_failed' }
  }
}
export type CheckResult = 'ok' | 'wrong' | 'expired' | 'locked'
export async function checkCode(phone: string, purpose: Purpose, code: string): Promise<CheckResult> {
  const sb = createSupabaseAdminClient()
  const { data: row, error } = await sb.from('verification_codes').select('id,code_hash,attempts,expires_at,consumed_at').eq('phone', phone).eq('purpose', purpose).is('consumed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`Unable to read verification code: ${error.message}`)
  if (!row || Date.parse(row.expires_at) < Date.now()) return 'expired'
  if (row.attempts >= MAX_ATTEMPTS) return 'locked'
  if (!safeEqual(row.code_hash, hashCode(row.id, code.trim()))) {
    const attempts = row.attempts + 1
    const { error: updateError } = await sb.from('verification_codes').update({ attempts }).eq('id', row.id).is('consumed_at', null)
    if (updateError) throw new Error(`Unable to record verification attempt: ${updateError.message}`)
    return attempts >= MAX_ATTEMPTS ? 'locked' : 'wrong'
  }
  const { data: used, error: consumeError } = await sb.from('verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id).is('consumed_at', null).gt('expires_at', new Date().toISOString()).select('id').maybeSingle()
  if (consumeError) throw new Error(`Unable to consume verification code: ${consumeError.message}`)
  return used ? 'ok' : 'expired'
}
