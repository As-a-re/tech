import 'server-only'
import { randomBytes } from 'node:crypto'
import { verify } from '@node-rs/argon2'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { sha256 } from '@/lib/crypto'
import { open, seal } from '@/lib/secret-box'
import { newTotpSecret, verifyTotp } from '@/lib/totp'
import { audit } from '@/server/identity/audit'
import { hit } from '@/server/identity/rate-limit'
const codeHash = (userId:string, code:string) => sha256(`${userId}:${code.replace(/[\s-]/g, '').toLowerCase()}:${env.authSecret}`)
export async function beginSetup(userId:string) {
  const secret = newTotpSecret()
  const { error } = await createSupabaseAdminClient().from('users').update({ totp_secret:seal(secret, env.authSecret), totp_enabled_at:null }).eq('id', userId)
  if (error) throw new Error(`Unable to start two-factor setup: ${error.message}`)
  return secret
}
export async function confirmSetup(userId:string, code:string):Promise<string[]|null> {
  const sb = createSupabaseAdminClient()
  const { data:u, error } = await sb.from('users').select('totp_secret,totp_enabled_at').eq('id', userId).maybeSingle()
  if (error) throw new Error(`Unable to load two-factor setup: ${error.message}`)
  if (!u?.totp_secret || u.totp_enabled_at || !verifyTotp(open(u.totp_secret, env.authSecret), code)) return null
  const codes = Array.from({length:10}, () => randomBytes(5).toString('hex').replace(/(.{5})/, '$1-'))
  const { error: enableError } = await sb.from('users').update({ totp_enabled_at:new Date().toISOString() }).eq('id', userId).is('totp_enabled_at', null)
  if (enableError) throw new Error(`Unable to enable two-factor authentication: ${enableError.message}`)
  const { error: deleteError } = await sb.from('backup_codes').delete().eq('user_id', userId)
  if (deleteError) throw new Error(`Unable to rotate backup codes: ${deleteError.message}`)
  const { error: insertError } = await sb.from('backup_codes').insert(codes.map(c => ({ user_id:userId, code_hash:codeHash(userId,c) })))
  if (insertError) throw new Error(`Unable to save backup codes: ${insertError.message}`)
  await audit('security.2fa_enabled', { actorId:userId })
  return codes
}
export async function disable(userId:string, password:string) {
  const sb = createSupabaseAdminClient()
  const { data:u, error } = await sb.from('users').select('password_hash').eq('id', userId).maybeSingle()
  if (error) throw new Error(`Unable to verify account: ${error.message}`)
  if (!u || !(await verify(u.password_hash, password).catch(() => false))) return false
  const { error: updateError } = await sb.from('users').update({ totp_secret:null, totp_enabled_at:null }).eq('id', userId)
  if (updateError) throw new Error(`Unable to disable two-factor authentication: ${updateError.message}`)
  const { error: deleteError } = await sb.from('backup_codes').delete().eq('user_id', userId)
  if (deleteError) throw new Error(`Unable to remove backup codes: ${deleteError.message}`)
  await audit('security.2fa_disabled', { actorId:userId }); return true
}
export async function isEnabled(userId:string) {
  const { data, error } = await createSupabaseAdminClient().from('users').select('totp_enabled_at').eq('id', userId).maybeSingle()
  if (error) throw new Error(`Unable to read two-factor status: ${error.message}`)
  return !!data?.totp_enabled_at
}
export async function remainingBackupCodes(userId:string) {
  const { count, error } = await createSupabaseAdminClient().from('backup_codes').select('id', {count:'exact',head:true}).eq('user_id', userId).is('used_at', null)
  if (error) throw new Error(`Unable to count backup codes: ${error.message}`)
  return count ?? 0
}
export type ChallengeResult = 'ok'|'wrong'|'too_many'
export async function checkSecondFactor(userId:string, code:string):Promise<ChallengeResult> {
  if (!(await hit(`2fa:${userId}`, 6, 300))) return 'too_many'
  const sb = createSupabaseAdminClient()
  const { data:u, error } = await sb.from('users').select('totp_secret,totp_enabled_at').eq('id', userId).maybeSingle()
  if (error) throw new Error(`Unable to verify second factor: ${error.message}`)
  if (!u?.totp_secret || !u.totp_enabled_at) return 'wrong'
  if (verifyTotp(open(u.totp_secret, env.authSecret), code)) return 'ok'
  const { data:used, error:useError } = await sb.from('backup_codes').update({ used_at:new Date().toISOString() }).eq('user_id', userId).eq('code_hash', codeHash(userId, code)).is('used_at', null).select('id').maybeSingle()
  if (useError) throw new Error(`Unable to consume backup code: ${useError.message}`)
  if (used) { await audit('security.backup_code_used', {actorId:userId}); return 'ok' }
  return 'wrong'
}
