import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/identity/normalise'
const sb = () => createSupabaseAdminClient()
const fail = (action: string, error: { message: string }) => { throw new Error(`${action}: ${error.message}`) }
const like = (s: string) => s.trim().replace(/[\\%_]/g, '\\$&')

export async function listDistricts() {
  const { data, error } = await sb().from('districts').select('id,name,slug').order('name')
  if (error) fail('Unable to list districts', error)
  const districts = data ?? []
  if (!districts.length) return []
  const { data: assemblies, error: ae } = await sb().from('assemblies').select('district_id').in('district_id', districts.map((d:any) => d.id))
  if (ae) fail('Unable to count district assemblies', ae)
  const counts = new Map<string,number>()
  for (const a of assemblies ?? []) counts.set(a.district_id, (counts.get(a.district_id) ?? 0) + 1)
  return districts.map((d:any) => ({ id:d.id, name:d.name, slug:d.slug, assemblies:counts.get(d.id) ?? 0 }))
}
export async function getDistrict(id: string) {
  const { data, error } = await sb().from('districts').select('*').eq('id',id).maybeSingle()
  if (error) fail('Unable to load district', error)
  return data ?? null
}
export async function listAssemblies(opts: { q?: string; districtId?: string }) {
  let query = sb().from('assemblies').select('id,name,town,slug,district_id').order('name').limit(200)
  if (opts.districtId) query = query.eq('district_id',opts.districtId)
  if (opts.q?.trim()) { const term=like(opts.q); query=query.or(`name.ilike.%${term}%,town.ilike.%${term}%`) }
  const { data, error } = await query
  if (error) fail('Unable to list assemblies', error)
  const rows=data ?? []
  const districtIds=[...new Set(rows.map((a:any)=>a.district_id))]
  const assemblyIds=rows.map((a:any)=>a.id)
  const [{data:districts,error:de},{data:members,error:me}] = await Promise.all([
    districtIds.length ? sb().from('districts').select('id,name').in('id',districtIds) : Promise.resolve({data:[],error:null} as any),
    assemblyIds.length ? sb().from('church_members').select('assembly_id,church_id').in('assembly_id',assemblyIds) : Promise.resolve({data:[],error:null} as any),
  ])
  if (de) fail('Unable to load assembly districts',de)
  if (me) fail('Unable to count assembly members',me)
  const dm=new Map((districts??[]).map((d:any)=>[d.id,d.name]))
  const counts=new Map<string,number>()
  for(const m of members??[]) counts.set(m.assembly_id,(counts.get(m.assembly_id)??0)+1)
  return rows.map((a:any)=>({id:a.id,name:a.name,town:a.town,slug:a.slug,districtId:a.district_id,districtName:dm.get(a.district_id)??null,members:counts.get(a.id)??0}))
}
export async function getAssembly(id: string) {
  const { data, error } = await sb().from('assemblies').select('*').eq('id',id).maybeSingle()
  if (error) fail('Unable to load assembly',error)
  return data ?? null
}
export type SaveResult = { ok:true; id:string } | { ok:false; field:string; error:string }
export async function saveDistrict(name: string, id?: string): Promise<SaveResult> {
  const clean=name.trim().replace(/\s+/g,' ')
  if(clean.length<2) return {ok:false,field:'name',error:'name_short'}
  const slug=slugify(clean)
  let check=sb().from('districts').select('id').eq('slug',slug)
  if(id) check=check.neq('id',id)
  const {data:clash,error:ce}=await check.maybeSingle()
  if(ce) fail('Unable to check district name',ce)
  if(clash) return {ok:false,field:'name',error:'name_taken'}
  if(id) {
    const {data,error}=await sb().from('districts').update({name:clean,slug}).eq('id',id).select('id').maybeSingle()
    if(error) fail('Unable to update district',error)
    return data ? {ok:true,id:data.id} : {ok:false,field:'id',error:'not_found'}
  }
  const {data,error}=await sb().from('districts').insert({name:clean,slug}).select('id').single()
  if(error?.code==='23505') return {ok:false,field:'name',error:'name_taken'}
  if(error) fail('Unable to create district',error)
  return {ok:true,id:data.id}
}
export async function saveAssembly(input: { name:string; town:string; districtId:string }, id?:string): Promise<SaveResult> {
  const name=input.name.trim().replace(/\s+/g,' ')
  if(name.length<2) return {ok:false,field:'name',error:'name_short'}
  const dist=await getDistrict(input.districtId)
  if(!dist) return {ok:false,field:'districtId',error:'district_required'}
  const slug=slugify(`${name}-${dist.slug}`)
  let check=sb().from('assemblies').select('id').eq('slug',slug)
  if(id) check=check.neq('id',id)
  const {data:clash,error:ce}=await check.maybeSingle()
  if(ce) fail('Unable to check assembly name',ce)
  if(clash) return {ok:false,field:'name',error:'name_taken'}
  const values={name,town:input.town.trim()||null,district_id:dist.id,slug}
  if(id) {
    const {data,error}=await sb().from('assemblies').update(values).eq('id',id).select('id').maybeSingle()
    if(error) fail('Unable to update assembly',error)
    return data ? {ok:true,id:data.id} : {ok:false,field:'id',error:'not_found'}
  }
  const {data,error}=await sb().from('assemblies').insert(values).select('id').single()
  if(error?.code==='23505') return {ok:false,field:'name',error:'name_taken'}
  if(error) fail('Unable to create assembly',error)
  return {ok:true,id:data.id}
}
