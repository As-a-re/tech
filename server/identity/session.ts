import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { supabaseUserServer } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { randomToken, sha256 } from '@/lib/crypto'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config'
import { DISPLAY_COOKIES } from '@/lib/display'
const COOKIE = 'papa_session', DAYS = 30
export function clientIp(xff: string | null, realIp: string | null, hops = Number(process.env.TRUSTED_PROXIES ?? 1)) {
  const parts = (xff ?? '').split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length && hops > 0) return parts[Math.max(0, parts.length - hops)]
  return realIp || null
}
export async function requestMeta() { const h = await headers(); return { ip: clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')), userAgent: h.get('user-agent')?.slice(0, 300) ?? null } }
export async function createSession(userId: string) {
  const auth = await supabaseUserServer()
  const { data: { user: authUser }, error: authError } = await auth.auth.getUser()
  if (authError || !authUser) throw new Error('A valid Supabase Auth session is required')
  const sb = createSupabaseAdminClient()
  const { data: linkedUser, error: linkError } = await sb.from('users').select('id').eq('id', userId).eq('auth_user_id', authUser.id).maybeSingle()
  if (linkError) throw new Error(`Unable to verify account identity: ${linkError.message}`)
  if (!linkedUser) throw new Error('Supabase Auth account is not linked to this member')
  const token = randomToken(), expiresAt = new Date(Date.now() + DAYS * 864e5), meta = await requestMeta()
  const { error } = await sb.from('sessions').insert({ id: sha256(token), user_id: userId, expires_at: expiresAt.toISOString(), ip: meta.ip, user_agent: meta.userAgent })
  if (error) throw new Error(`Unable to create session: ${error.message}`)
  const { error: seenError } = await sb.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
  if (seenError) throw new Error(`Unable to update last-seen timestamp: ${seenError.message}`)
  const jar = await cookies()
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/', expires: expiresAt })
  const { data: u, error: prefError } = await sb.from('users').select('locale,user_preferences(text_size,data_saver)').eq('id', userId).maybeSingle()
  if (prefError) throw new Error(`Unable to load session preferences: ${prefError.message}`)
  const pref = Array.isArray(u?.user_preferences) ? u.user_preferences[0] : u?.user_preferences
  const keep = { path: '/', maxAge: 31536000, sameSite: 'lax' as const }
  if (u && isLocale(u.locale)) jar.set(LOCALE_COOKIE, u.locale, keep)
  if (pref?.text_size) jar.set(DISPLAY_COOKIES.textSize, pref.text_size, keep)
  if (pref?.data_saver != null) jar.set(DISPLAY_COOKIES.dataSaver, pref.data_saver ? '1' : '0', keep)
}
export type CurrentUser = { id:string; churchId:string; username:string; fullName:string; role:'member'|'tech_admin'; avatarUrl:string|null; onboarded:boolean; assemblyId:string; assemblyName:string; assemblySlug:string; districtId:string; districtName:string; districtSlug:string }
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const auth = await supabaseUserServer()
  const { data: { user: authUser }, error: authError } = await auth.auth.getUser()
  if (authError || !authUser) return null
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const sessionId = sha256(token), sb = createSupabaseAdminClient()
  const { data: session, error: sessionError } = await sb.from('sessions').select('user_id,expires_at,last_used_at').eq('id', sessionId).maybeSingle()
  if (sessionError) throw new Error(`Unable to read session: ${sessionError.message}`)
  if (!session || Date.parse(session.expires_at) < Date.now()) return null
  const { data: u, error } = await sb.from('users').select('id,church_id,username,full_name,role,status,avatar_url,onboarded_at,assembly_id,last_seen_at').eq('id', session.user_id).eq('auth_user_id', authUser.id).maybeSingle()
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
    await sb.from('sessions').update({ last_used_at: now, expires_at: new Date(Date.now() + DAYS * 864e5).toISOString() }).eq('id', sessionId)
    await sb.from('users').update({ last_seen_at: now }).eq('id', u.id)
  }
  return { id:u.id, churchId:u.church_id, username:u.username, fullName:u.full_name, role:u.role, avatarUrl:u.avatar_url, onboarded:!!u.onboarded_at, assemblyId:assembly.id, assemblyName:assembly.name, assemblySlug:assembly.slug, districtId:district.id, districtName:district.name, districtSlug:district.slug }
})
export async function requireUser(next?: string) { const u = await getCurrentUser(); if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`); return u }
export async function requireTechAdmin(next = '/') { const u = await requireUser(next); if (u.role !== 'tech_admin') redirect('/'); return u }
export async function currentSessionId() { const t = (await cookies()).get(COOKIE)?.value; return t ? sha256(t) : null }
export async function destroyCurrentSession() {
  const jar = await cookies(), t = jar.get(COOKIE)?.value
  if (t) { const { error } = await createSupabaseAdminClient().from('sessions').delete().eq('id', sha256(t)); if (error) throw new Error(`Unable to destroy session: ${error.message}`) }
  jar.delete(COOKIE)
  const auth = await supabaseUserServer()
  const { error } = await auth.auth.signOut()
  if (error) throw new Error(`Unable to sign out: ${error.message}`)
}
export async function destroyAllSessions(userId: string, keepSessionId?: string | null) { let q = createSupabaseAdminClient().from('sessions').delete().eq('user_id', userId); if (keepSessionId) q = q.neq('id', keepSessionId); const { error } = await q; if (error) throw new Error(`Unable to destroy sessions: ${error.message}`) }
