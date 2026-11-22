import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { randomToken, sha256 } from '@/lib/crypto'
import type { CurrentUser } from './session'

export type MobileRequest = { headers: { get(name: string): string | null } }

async function tokenFrom(request: MobileRequest): Promise<string | null> {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return /^[A-Za-z0-9_-]{32,128}$/.test(token) ? token : null
}

/** Auth for the Expo apps: the phone stores a session token (same sessions table as the web) and sends it as a Bearer header. */
export async function getMobileUser(request: MobileRequest): Promise<CurrentUser | null> {
  const token = await tokenFrom(request)
  if (!token) return null
  const id = sha256(token)
  const sb = createSupabaseAdminClient()
  const { data: session, error: sessionError } = await sb.from('sessions').select('user_id,expires_at,last_used_at').eq('id', id).maybeSingle()
  if (sessionError) throw new Error(`Unable to read session: ${sessionError.message}`)
  if (!session || Date.parse(session.expires_at) < Date.now()) return null
  const { data: u, error } = await sb.from('users').select('id,church_id,username,full_name,role,status,avatar_url,onboarded_at,assembly_id').eq('id', session.user_id).maybeSingle()
  if (error) throw new Error(`Unable to read account: ${error.message}`)
  if (!u || u.status !== 'active') return null
  const { data: member, error: memberError } = await sb.from('church_members').select('active').eq('church_id', u.church_id).maybeSingle()
  if (memberError) throw new Error(`Unable to verify membership: ${memberError.message}`)
  if (!member?.active) return null
  const { data: assembly, error: assemblyError } = await sb.from('assemblies').select('id,name,slug,district_id').eq('id', u.assembly_id).maybeSingle()
  if (assemblyError) throw new Error(`Unable to read assembly: ${assemblyError.message}`)
  if (!assembly) return null
  const { data: district, error: districtError } = await sb.from('districts').select('id,name,slug').eq('id', assembly.district_id).maybeSingle()
  if (districtError) throw new Error(`Unable to read district: ${districtError.message}`)
  if (!district) return null
  if (Date.now() - Date.parse(session.last_used_at) > 5 * 60_000) {
    const now = new Date().toISOString()
    await sb.from('sessions').update({ last_used_at: now, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }).eq('id', id)
    await sb.from('users').update({ last_seen_at: now }).eq('id', u.id)
  }
  return { id: u.id, churchId: u.church_id, username: u.username, fullName: u.full_name, role: u.role, avatarUrl: u.avatar_url, onboarded: !!u.onboarded_at, assemblyId: assembly.id, assemblyName: assembly.name, assemblySlug: assembly.slug, districtId: district.id, districtName: district.name, districtSlug: district.slug }
}

export async function createMobileSession(userId: string, meta: { ip: string | null; userAgent: string | null }) {
  const token = randomToken()
  const { error } = await createSupabaseAdminClient().from('sessions').insert({ id: sha256(token), user_id: userId, expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), ip: meta.ip, user_agent: meta.userAgent?.slice(0, 300) ?? null })
  if (error) throw new Error(`Unable to create session: ${error.message}`)
  return token
}

export async function destroyMobileSession(request: MobileRequest) {
  const token = await tokenFrom(request)
  if (!token) return
  const { error } = await createSupabaseAdminClient().from('sessions').delete().eq('id', sha256(token))
  if (error) throw new Error(`Unable to destroy session: ${error.message}`)
}

export function mobileIp(request: MobileRequest) {
  const xff = request.headers.get('x-forwarded-for')
  return xff ? xff.split(',').map(p => p.trim()).filter(Boolean).pop() ?? null : request.headers.get('x-real-ip')
}

export function mobileResponseError(error: 'unauthorised' | 'bad_request' | 'server') {
  if (error === 'unauthorised') return Response.json({ error: 'unauthorised' }, { status: 401 })
  if (error === 'bad_request') return Response.json({ error: 'bad_request' }, { status: 400 })
  return Response.json({ error: 'server' }, { status: 500 })
}
