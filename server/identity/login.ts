import 'server-only'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { churchDirectory, cacheMember } from '@/integrations/church-db'
import { normaliseChurchId, normalisePhone } from '@/lib/identity/normalise'
import { hit, clear } from './rate-limit'
import { audit } from './audit'

export type LoginResult = { ok: true; userId: string; session: Session } | { ok: false; error: 'missing' | 'invalid' | 'too_many' | 'suspended' | 'inactive' }

function publicAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase public URL and key are required')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })
}

/** Validate credentials through Supabase Auth without persisting a temporary server session. */
export async function signInSupabaseCredentials(phone: string, password: string): Promise<{ user: User; session: Session } | null> {
  const { data, error } = await publicAuthClient().auth.signInWithPassword({ phone, password })
  if (error || !data.user || !data.session) return null
  return { user: data.user, session: data.session }
}

export async function verifySupabaseCredentials(phone: string, password: string) {
  return (await signInSupabaseCredentials(phone, password))?.user ?? null
}

export async function refreshSupabaseSession(refreshToken: string) {
  const { data, error } = await publicAuthClient().auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) return null
  return data.session
}

/** Sign in with Church ID, username or phone number, plus a Supabase Auth password. */
export async function login(identifier: string, password: string, ip: string | null): Promise<LoginResult> {
  const ident = identifier.trim()
  if (!ident || !password) return { ok: false, error: 'missing' }
  const key = ident.toLowerCase()
  if (!(await hit(`login:id:${key}`, 10, 900)) || !(await hit(`login:ip:${ip ?? 'unknown'}`, 50, 900))) return { ok: false, error: 'too_many' }

  const phone = normalisePhone(ident)
  const safeIdentifier = ident.replace(/^@/, '').replace(/[%,()]/g, '')
  const sb = createSupabaseAdminClient()
  let query = sb.from('users').select('id,auth_user_id,phone,status,church_id').limit(1)
  query = phone.length === 12
    ? query.or(`church_id.eq.${normaliseChurchId(ident)},username.ilike.${safeIdentifier},phone.eq.${phone}`)
    : query.or(`church_id.eq.${normaliseChurchId(ident)},username.ilike.${safeIdentifier}`)
  const { data: account, error } = await query.maybeSingle()
  if (error) throw new Error(`Unable to look up account: ${error.message}`)
  if (!account?.auth_user_id) return { ok: false, error: 'invalid' }

  const authResult = await signInSupabaseCredentials(account.phone, password)
  if (!authResult || authResult.user.id !== account.auth_user_id) {
    await audit('account.login_failed', { target: ident.slice(0, 40), ip })
    return { ok: false, error: 'invalid' }
  }
  if (account.status === 'suspended') return { ok: false, error: 'suspended' }

  if (env.churchDbMode === 'api') {
    try {
      const member = await churchDirectory().findMember(account.church_id)
      if (member) {
        const assemblyId = await cacheMember(member)
        const { error: updateError } = await sb.from('users').update({ full_name: member.fullName, phone: member.phone, assembly_id: assemblyId }).eq('id', account.id)
        if (updateError) throw updateError
      }
    } catch { /* sign in using cached identity if the directory is unavailable */ }
  }

  const { data: member, error: memberError } = await sb.from('church_members').select('active').eq('church_id', account.church_id).maybeSingle()
  if (memberError) throw new Error(`Unable to check church membership: ${memberError.message}`)
  if (!member?.active) return { ok: false, error: 'inactive' }
  await clear(`login:id:${key}`)
  await audit('account.login', { actorId: account.id, ip })
  return { ok: true, userId: account.id, session: authResult.session }
}
