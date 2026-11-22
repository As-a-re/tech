import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { roleScopes, type LevelRole } from '@/server/admin/roles'
type Who={id:string;role:'member'|'tech_admin'}
export type Level='national'|'district'|'local'
export type Scope={level:'national'}|{level:'district';districtId:string}|{level:'local';assemblyId:string}
export async function hasMinistryRole(user:Who|null,role:LevelRole){if(!user)return false;if(user.role==='tech_admin')return true;return(await roleScopes(user.id,role)).length>0}
export async function allowedLevels(user:Who,role:LevelRole):Promise<Level[]>{if(user.role==='tech_admin')return['national','district','local'];const rows=await roleScopes(user.id,role);if(rows.some(r=>r.level==='national'))return['national','district','local'];return(['district','local'] as const).filter(l=>rows.some(r=>r.level===l))}
async function scopeForMember(userId:string,level:Level):Promise<Scope|null>{if(level==='national')return{level};const {data:u,error}=await createSupabaseAdminClient().from('users').select('assembly_id').eq('id',userId).maybeSingle();if(error)throw new Error(`Unable to load member scope: ${error.message}`);if(!u?.assembly_id)return null;const {data:a,error:ae}=await createSupabaseAdminClient().from('assemblies').select('district_id').eq('id',u.assembly_id).maybeSingle();if(ae)throw new Error(`Unable to load assembly scope: ${ae.message}`);if(!a)return null;return level==='district'?{level,districtId:a.district_id}:{level,assemblyId:u.assembly_id}}
export async function publishScope(user:Who,role:LevelRole,level:Level):Promise<Scope|null>{if(user.role==='tech_admin')return scopeForMember(user.id,level);const rows=await roleScopes(user.id,role),exact=rows.find(r=>r.level===level);if(exact)return level==='national'?{level}:level==='district'?{level,districtId:exact.districtId!}:{level,assemblyId:exact.assemblyId!};if(rows.some(r=>r.level==='national'))return scopeForMember(user.id,level);return null}
