import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { ChurchDirectory, ChurchMember } from './types'
/** Local church register stored in Supabase. */
export const localDirectory:ChurchDirectory={
 async findMember(churchId){
  const {data:m,error}=await createSupabaseAdminClient().from('church_members').select('church_id,full_name,phone,active,date_of_birth,assembly_id').eq('church_id',churchId).maybeSingle()
  if(error)throw new Error(`Unable to read church register: ${error.message}`);if(!m)return null
  const {data:a,error:ae}=await createSupabaseAdminClient().from('assemblies').select('id,name,town,district_id').eq('id',m.assembly_id).maybeSingle()
  if(ae)throw new Error(`Unable to read assembly: ${ae.message}`);if(!a)return null
  const {data:d,error:de}=await createSupabaseAdminClient().from('districts').select('id,name').eq('id',a.district_id).maybeSingle()
  if(de)throw new Error(`Unable to read district: ${de.message}`);if(!d)return null
  return {churchId:m.church_id,fullName:m.full_name,phone:m.phone,active:m.active,dateOfBirth:m.date_of_birth,assembly:{externalId:a.id,name:a.name,town:a.town},district:{externalId:d.id,name:d.name}} satisfies ChurchMember
 }
}
