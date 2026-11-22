import 'server-only'
import { verify } from '@node-rs/argon2'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { churchDirectory, cacheMember } from '@/integrations/church-db'
import { normaliseChurchId, normalisePhone } from '@/lib/identity/normalise'
import { hit, clear } from './rate-limit'
import { audit } from './audit'
import { ARGON } from './register'

export type LoginResult = { ok: true; userId: string } | { ok: false; error: 'missing' | 'invalid' | 'too_many' | 'suspended' | 'inactive' }
let dummy: Promise<string> | null = null
const dummyHash = async () => {
  if (!dummy) { const { hash } = await import('@node-rs/argon2'); dummy = hash('papa-timing-equaliser', ARGON) }
  return dummy
}

/** Sign in with Church ID, username or phone number, plus password. */
export async function login(identifier: string, password: string, ip: string | null): Promise<LoginResult> {
  const ident = identifier.trim()
  if (!ident || !password) return { ok: false, error: 'missing' }
  const key = ident.toLowerCase()
  if (!(await hit(`login:id:${key}`, 10, 900)) || !(await hit(`login:ip:${ip ?? 'unknown'}`, 50, 900))) return { ok: false, error: 'too_many' }
  const phone = normalisePhone(ident)
  const sb = createSupabaseAdminClient()
  let q = sb.from('users').select('id,password_hash,status,church_id').limit(1)
  if (phone.length === 12) q = q.or(`church_id.eq.${normaliseChurchId(ident)},username.ilike.${ident.replace(/^@/, '').replace(/[%,()]/g, '')},phone.eq.${phone}`)
  else q = q.or(`church_id.eq.${normaliseChurchId(ident)},username.ilike.${ident.replace(/^@/, '').replace(/[%,()]/g, '')}`)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`Unable to look up account: ${error.message}`)
  const good = await verify(data?.password_hash ?? await dummyHash(), password).catch(() => false)
  if (!data || !good) { await audit('account.login_failed', { target: ident.slice(0, 40), ip }); return { ok: false, error: 'invalid' } }
  if (data.status === 'suspended') return { ok: false, error: 'suspended' }
  if (env.churchDbMode === 'api') {
    try {
      const m = await churchDirectory().findMember(data.church_id)
      if (m) {
        const assemblyId = await cacheMember(m)
        const { error: updateError } = await sb.from('users').update({ full_name: m.fullName, phone: m.phone, assembly_id: assemblyId }).eq('id', data.id)
        if (updateError) throw updateError
      }
    } catch { /* sign in using cached identity if directory is unavailable */ }
  }
  const { data: member, error: memberError } = await sb.from('church_members').select('active').eq('church_id', data.church_id).maybeSingle()
  if (memberError) throw new Error(`Unable to check church membership: ${memberError.message}`)
  if (!member?.active) return { ok: false, error: 'inactive' }
  await clear(`login:id:${key}`)
  await audit('account.login', { actorId: data.id, ip })
  return { ok: true, userId: data.id }
}
