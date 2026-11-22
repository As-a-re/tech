import 'server-only'
import { hash } from '@node-rs/argon2'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { churchDirectory, cacheMember, ChurchApiError } from '@/integrations/church-db'
import { normaliseChurchId, normalisePhone, isGhanaMobile, maskPhone } from '@/lib/identity/normalise'
import { passwordProblem, usernameProblem } from '@/lib/identity/rules'
import { sendCode, checkCode } from './codes'
import { hit } from './rate-limit'
import { audit } from './audit'

export const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }
export const hashPassword = (pw: string) => hash(pw, ARGON)
export type StartResult = { ok: true; churchId: string; phone: string; masked: string } | { ok: false; error: 'invalid' | 'no_match' | 'inactive' | 'registered' | 'too_many' | 'sms_failed' | 'directory_down' }

export async function startRegistration(rawId: string, rawPhone: string, ip: string | null): Promise<StartResult> {
  const churchId = normaliseChurchId(rawId), phone = normalisePhone(rawPhone)
  if (!churchId || !isGhanaMobile(phone)) return { ok: false, error: 'invalid' }
  if (!(await hit(`reg-start:${ip ?? 'unknown'}`, 10, 3600))) return { ok: false, error: 'too_many' }
  let member
  try { member = await churchDirectory().findMember(churchId) } catch (e) { if (e instanceof ChurchApiError) return { ok: false, error: 'directory_down' }; throw e }
  if (!member || member.phone !== phone) return { ok: false, error: 'no_match' }
  if (!member.active) return { ok: false, error: 'inactive' }
  const sb = createSupabaseAdminClient()
  const { data: existing, error } = await sb.from('users').select('id').eq('church_id', churchId).maybeSingle()
  if (error) throw new Error(`Unable to check registration: ${error.message}`)
  if (existing) return { ok: false, error: 'registered' }
  const sent = await sendCode(phone, 'register')
  if (!sent.ok) return { ok: false, error: 'reason' in sent ? sent.reason : 'directory_down' }
  return { ok: true, churchId, phone, masked: maskPhone(phone) }
}
export const verifyRegistrationCode = (phone: string, code: string) => checkCode(phone, 'register', code)
export type CompleteResult = { ok: true; userId: string } | { ok: false; error: 'username_length' | 'username_chars' | 'username_reserved' | 'username_taken' | 'password_short' | 'password_long' | 'password_weak' | 'password_mismatch' | 'no_match' | 'registered' | 'directory_down' }

export async function completeRegistration(input: { churchId: string; phone: string; username: string; password: string; confirm: string; locale: string; ip: string | null }): Promise<CompleteResult> {
  const username = input.username.trim().replace(/^@/, '')
  const up = usernameProblem(username); if (up) return { ok: false, error: `username_${up}` }
  const pp = passwordProblem(input.password); if (pp) return { ok: false, error: `password_${pp}` }
  if (input.password !== input.confirm) return { ok: false, error: 'password_mismatch' }
  let member
  try { member = await churchDirectory().findMember(input.churchId) } catch (e) { if (e instanceof ChurchApiError) return { ok: false, error: 'directory_down' }; throw e }
  if (!member || !member.active || member.phone !== input.phone) return { ok: false, error: 'no_match' }
  const sb = createSupabaseAdminClient()
  const assemblyId = await cacheMember(member)
  const { data: reg, error: regError } = await sb.from('church_members').select('grant_tech_admin').eq('church_id', member.churchId).maybeSingle()
  if (regError) throw new Error(`Unable to check registration privileges: ${regError.message}`)
  const password_hash = await hashPassword(input.password)
  const { data: user, error } = await sb.from('users').insert({ church_id: member.churchId, username, full_name: member.fullName, phone: member.phone, assembly_id: assemblyId, password_hash, role: reg?.grant_tech_admin ? 'tech_admin' : 'member', locale: input.locale }).select('id').single()
  if (error) {
    if (error.code === '23505' && error.message.toLowerCase().includes('username')) return { ok: false, error: 'username_taken' }
    if (error.code === '23505') return { ok: false, error: 'registered' }
    throw new Error(`Unable to create account: ${error.message}`)
  }
  if (reg?.grant_tech_admin) {
    const { error: grantError } = await sb.from('church_members').update({ grant_tech_admin: false }).eq('church_id', member.churchId)
    if (grantError) throw new Error(`Account created but grant reset failed: ${grantError.message}`)
  }
  await audit('account.registered', { actorId: user.id, target: member.churchId, ip: input.ip, meta: reg?.grant_tech_admin ? { role: 'tech_admin' } : undefined })
  return { ok: true, userId: user.id }
}
export async function isUsernameFree(username: string) {
  const { data, error } = await createSupabaseAdminClient().from('users').select('id').ilike('username', username.toLowerCase()).limit(1)
  if (error) throw new Error(`Unable to check username: ${error.message}`)
  return !data?.length
}
