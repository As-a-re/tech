import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { PAGE_SIZE } from './register'

export type AccountFilter = { q?: string; role?: 'tech_admin'; status?: 'active' | 'suspended'; verified?: boolean; page?: number }
const sb = () => createSupabaseAdminClient()
const fail = (action: string, error: { message: string }) => { throw new Error(`${action}: ${error.message}`) }
const pattern = (s: string) => s.trim().replace(/[\\%_]/g, '\\$&')

export async function listAccounts(f: AccountFilter) {
  const page = Math.max(1, Math.floor(f.page ?? 1))
  let q = sb().from('users').select('id,username,full_name,church_id,role,status,avatar_url,verified_at,last_seen_at,created_at,assembly_id', { count: 'exact' })
  if (f.q?.trim()) {
    const term = pattern(f.q.replace(/^@/, ''))
    q = q.or(`full_name.ilike.%${term}%,username.ilike.%${term}%,church_id.ilike.%${term}%`)
  }
  if (f.role) q = q.eq('role', f.role)
  if (f.status) q = q.eq('status', f.status)
  if (f.verified) q = q.not('verified_at', 'is', null)
  const { data, error, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (error) fail('Unable to list accounts', error)
  const rows = data ?? []
  const assemblyIds = [...new Set(rows.map((r: any) => r.assembly_id).filter(Boolean))]
  const { data: assemblies, error: assemblyError } = assemblyIds.length
    ? await sb().from('assemblies').select('id,name').in('id', assemblyIds)
    : { data: [], error: null }
  if (assemblyError) fail('Unable to load account assemblies', assemblyError)
  const names = new Map((assemblies ?? []).map((a: any) => [a.id, a.name]))
  return { rows: rows.map((r: any) => ({ id:r.id, username:r.username, fullName:r.full_name, churchId:r.church_id, role:r.role,
    status:r.status, avatarUrl:r.avatar_url, verified:!!r.verified_at, lastSeenAt:r.last_seen_at, createdAt:r.created_at,
    assemblyName:names.get(r.assembly_id) ?? null })), total: count ?? 0, page, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) }
}

export async function getAccount(id: string) {
  const { data: u, error } = await sb().from('users').select('id,username,full_name,church_id,phone,email,role,status,avatar_url,verified_at,verified_label,totp_enabled_at,last_seen_at,created_at,assembly_id').eq('id', id).maybeSingle()
  if (error) fail('Unable to load account', error)
  if (!u) return null
  const [{ data: a, error: ae }, { count: sessionCount, error: se }] = await Promise.all([
    sb().from('assemblies').select('name,district_id').eq('id', u.assembly_id).maybeSingle(),
    sb().from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', id).gt('expires_at', new Date().toISOString()),
  ])
  if (ae) fail('Unable to load account assembly', ae)
  if (se) fail('Unable to count account sessions', se)
  let districtName: string | null = null
  if (a?.district_id) {
    const { data: d, error: de } = await sb().from('districts').select('name').eq('id', a.district_id).maybeSingle()
    if (de) fail('Unable to load account district', de)
    districtName = d?.name ?? null
  }
  return { id:u.id, username:u.username, fullName:u.full_name, churchId:u.church_id, phone:u.phone, email:u.email, role:u.role,
    status:u.status, avatarUrl:u.avatar_url, verifiedAt:u.verified_at, verifiedLabel:u.verified_label, totpEnabledAt:u.totp_enabled_at,
    lastSeenAt:u.last_seen_at, createdAt:u.created_at, assemblyName:a?.name ?? null, districtName, sessions:sessionCount ?? 0 }
}

export async function countTechAdmins() {
  const { count, error } = await sb().from('users').select('id', { count:'exact', head:true }).eq('role','tech_admin').eq('status','active')
  if (error) fail('Unable to count active Tech Admins', error)
  return count ?? 0
}
export type AdminActionResult = { ok: true } | { ok: false; error: 'self' | 'last_admin' | 'not_found' }
export async function setStatus(actorId: string, id: string, status: 'active' | 'suspended'): Promise<AdminActionResult> {
  if (actorId === id) return { ok:false, error:'self' }
  const acc = await getAccount(id)
  if (!acc) return { ok:false, error:'not_found' }
  if (status === 'suspended' && acc.role === 'tech_admin' && acc.status === 'active' && await countTechAdmins() <= 1) return { ok:false, error:'last_admin' }
  const { data, error } = await sb().from('users').update({ status }).eq('id',id).select('id').maybeSingle()
  if (error) fail('Unable to update account status', error)
  if (!data) return { ok:false, error:'not_found' }
  if (status === 'suspended') { const { error: se } = await sb().from('sessions').delete().eq('user_id',id); if (se) fail('Unable to revoke account sessions', se) }
  return { ok:true }
}
export async function setRole(actorId: string, id: string, role: 'member' | 'tech_admin'): Promise<AdminActionResult> {
  if (actorId === id && role === 'member') return { ok:false, error:'self' }
  const acc = await getAccount(id)
  if (!acc) return { ok:false, error:'not_found' }
  if (role === 'member' && acc.role === 'tech_admin' && acc.status === 'active' && await countTechAdmins() <= 1) return { ok:false, error:'last_admin' }
  const { data, error } = await sb().from('users').update({ role }).eq('id',id).select('id').maybeSingle()
  if (error) fail('Unable to update account role', error)
  return data ? { ok:true } : { ok:false, error:'not_found' }
}
export async function setVerified(id: string, label: string | null) {
  const update = label === null ? { verified_at:null, verified_label:null } : { verified_at:new Date().toISOString(), verified_label:label.trim().slice(0,60) || null }
  const { error } = await sb().from('users').update(update).eq('id',id)
  if (error) fail('Unable to update verified status', error)
}
export async function resetTwoFactor(id: string) {
  const { error } = await sb().from('users').update({ totp_secret:null, totp_enabled_at:null }).eq('id',id)
  if (error) fail('Unable to reset two-factor authentication', error)
  const { error: ce } = await sb().from('backup_codes').delete().eq('user_id',id)
  if (ce) fail('Unable to delete backup codes', ce)
}
export async function signOutEverywhere(id: string) {
  const { error } = await sb().from('sessions').delete().eq('user_id',id)
  if (error) fail('Unable to revoke sessions', error)
}
export async function searchAccounts(q: string) {
  if (q.trim().length < 2) return []
  const term = pattern(q.replace(/^@/, ''))
  const { data, error } = await sb().from('users').select('id,username,full_name,avatar_url,church_id,assembly_id')
    .eq('status','active').or(`full_name.ilike.%${term}%,username.ilike.%${term}%,church_id.ilike.%${term}%`).order('full_name').limit(10)
  if (error) fail('Unable to search accounts', error)
  const ids = [...new Set((data ?? []).map((r:any) => r.assembly_id).filter(Boolean))]
  const { data: assemblies, error: ae } = ids.length ? await sb().from('assemblies').select('id,name').in('id',ids) : { data:[], error:null }
  if (ae) fail('Unable to load account assemblies', ae)
  const names = new Map((assemblies ?? []).map((a:any) => [a.id,a.name]))
  return (data ?? []).map((r:any) => ({ id:r.id, username:r.username, fullName:r.full_name, avatarUrl:r.avatar_url, assemblyName:names.get(r.assembly_id) ?? null }))
}
