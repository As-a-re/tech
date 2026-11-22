import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { slugify } from '@/lib/identity/normalise'
import { apiDirectory } from './api'
import { localDirectory } from './local'
import type { ChurchDirectory, ChurchMember } from './types'
export type { ChurchMember } from './types'
export { ChurchApiError } from './api'
export function churchDirectory():ChurchDirectory{return env.churchDbMode==='api'?apiDirectory(env.churchDbApiUrl,env.churchDbApiKey):localDirectory}
/** Synchronizes an externally managed church member and its church structure into Supabase. */
export async function cacheMember(m:ChurchMember):Promise<string>{
 const client=createSupabaseAdminClient()
 if(env.churchDbMode==='local'){
  const {data,error}=await client.from('church_members').select('assembly_id').eq('church_id',m.churchId).maybeSingle()
  if(error)throw new Error(`Unable to find cached member: ${error.message}`);if(!data)throw new Error('Church member was not found in local register');return data.assembly_id
 }
 const {data,error}=await client.rpc('papa_sync_church_member',{p_church_id:m.churchId,p_full_name:m.fullName,p_phone:m.phone,p_active:m.active,p_date_of_birth:m.dateOfBirth,p_district_external_id:m.district.externalId,p_district_name:m.district.name,p_district_slug:`${slugify(m.district.name)}-${m.district.externalId}`,p_assembly_external_id:m.assembly.externalId,p_assembly_name:m.assembly.name,p_assembly_town:m.assembly.town,p_assembly_slug:`${slugify(m.assembly.name)}-${m.assembly.externalId}`})
 if(error)throw new Error(`Unable to sync church member: ${error.message}`)
 return data as string
}
