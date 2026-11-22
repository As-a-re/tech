import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type LevelInput = { level: 'national' | 'district' | 'local'; districtId?: string | null; assemblyId?: string | null }
export type GrantResult = { ok: true } | { ok: false; error: 'scope_required' | 'exists' | 'not_found' }
export type LevelRole = 'resource_manager' | 'publications_editor' | 'childrens_ministry' | 'media_team' | 'treasurer'
export const LEVEL_ROLES: LevelRole[] = ['resource_manager', 'publications_editor', 'childrens_ministry', 'media_team', 'treasurer']
const sb = () => createSupabaseAdminClient()
const throwDb = (action: string, error: { message: string }) => { throw new Error(`${action}: ${error.message}`) }

export async function listLevelRoles() {
  const { data: roles, error } = await sb().from('level_roles').select('id,role,level,created_at,user_id,district_id,assembly_id').order('level').limit(2000)
  if (error) throwDb('Unable to list scoped roles', error)
  const userIds = [...new Set((roles ?? []).map((r: any) => r.user_id))]
  const districtIds = [...new Set((roles ?? []).map((r: any) => r.district_id).filter(Boolean))]
  const assemblyIds = [...new Set((roles ?? []).map((r: any) => r.assembly_id).filter(Boolean))]
  const [users, districts, assemblies] = await Promise.all([
    userIds.length ? sb().from('users').select('id,username,full_name,avatar_url').in('id', userIds) : Promise.resolve({ data: [], error: null } as any),
    districtIds.length ? sb().from('districts').select('id,name').in('id', districtIds) : Promise.resolve({ data: [], error: null } as any),
    assemblyIds.length ? sb().from('assemblies').select('id,name').in('id', assemblyIds) : Promise.resolve({ data: [], error: null } as any),
  ])
  if (users.error) throwDb('Unable to load role users', users.error)
  if (districts.error) throwDb('Unable to load role districts', districts.error)
  if (assemblies.error) throwDb('Unable to load role assemblies', assemblies.error)
  const um = new Map((users.data ?? []).map((x: any) => [x.id, x]))
  const dm = new Map((districts.data ?? []).map((x: any) => [x.id, x.name]))
  const am = new Map((assemblies.data ?? []).map((x: any) => [x.id, x.name]))
  return (roles ?? []).map((r: any) => {
    const u: any = um.get(r.user_id)
    return { id: r.id, role: r.role, level: r.level, createdAt: r.created_at, userId: r.user_id,
      username: u?.username ?? null, fullName: u?.full_name ?? null, avatarUrl: u?.avatar_url ?? null,
      districtName: r.district_id ? dm.get(r.district_id) ?? null : null,
      assemblyName: r.assembly_id ? am.get(r.assembly_id) ?? null : null }
  }).sort((a: any, b: any) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')))
}

export async function grantLevelRole(actorId: string, userId: string, role: LevelRole, scope: LevelInput): Promise<GrantResult> {
  const districtId = scope.level === 'district' ? scope.districtId || null : null
  const assemblyId = scope.level === 'local' ? scope.assemblyId || null : null
  if ((scope.level === 'district' && !districtId) || (scope.level === 'local' && !assemblyId)) return { ok: false, error: 'scope_required' }
  const { data: account, error: userError } = await sb().from('users').select('id').eq('id', userId).maybeSingle()
  if (userError) throwDb('Unable to check account', userError)
  if (!account) return { ok: false, error: 'not_found' }
  let q = sb().from('level_roles').select('id').eq('user_id', userId).eq('role', role).eq('level', scope.level)
  q = districtId ? q.eq('district_id', districtId) : q.is('district_id', null)
  q = assemblyId ? q.eq('assembly_id', assemblyId) : q.is('assembly_id', null)
  const { data: existing, error: checkError } = await q.maybeSingle()
  if (checkError) throwDb('Unable to check scoped role', checkError)
  if (existing) return { ok: false, error: 'exists' }
  const { error } = await sb().from('level_roles').insert({ user_id: userId, role, level: scope.level, district_id: districtId, assembly_id: assemblyId, granted_by: actorId })
  if (error?.code === '23505') return { ok: false, error: 'exists' }
  if (error) throwDb('Unable to grant scoped role', error)
  return { ok: true }
}

export async function revokeLevelRole(id: string) {
  const { data, error } = await sb().from('level_roles').delete().eq('id', id).select('id,role,level,user_id,district_id,assembly_id,granted_by,created_at').maybeSingle()
  if (error) throwDb('Unable to revoke scoped role', error)
  if (!data) return null
  return { id: data.id, role: data.role, level: data.level, userId: data.user_id, districtId: data.district_id, assemblyId: data.assembly_id, grantedBy: data.granted_by, createdAt: data.created_at }
}

export async function isResourceManager(userId: string, scope: LevelInput) {
  const rows = await roleScopes(userId, 'resource_manager')
  return rows.some(x => x.level === 'national' || (scope.level === 'district' && x.level === 'district' && x.districtId === scope.districtId) || (scope.level === 'local' && x.level === 'local' && x.assemblyId === scope.assemblyId))
}

export async function roleScopes(userId: string, role: LevelRole) {
  const { data, error } = await sb().from('level_roles').select('level,district_id,assembly_id').eq('user_id', userId).eq('role', role)
  if (error) throwDb('Unable to read role scopes', error)
  return (data ?? []).map((x: any) => ({ level: x.level as LevelInput['level'], districtId: x.district_id, assemblyId: x.assembly_id }))
}
