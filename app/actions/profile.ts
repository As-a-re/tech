'use server'

import { getSupabaseUser, supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getUserId() { return (await getSupabaseUser()).id }

export async function getProfile() {
  const userId = await getUserId()
  const { data, error } = await supabaseServer().from('profiles').select('id,name,email,image,role,phone,location,bio').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function updateProfile(input: { name: string; phone?: string; location?: string; bio?: string; role?: string }) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const { error } = await supabaseServer().from('profiles').update({ name, phone: input.phone?.trim() || null, location: input.location?.trim() || null, bio: input.bio?.trim() || null, ...(input.role ? { role: input.role } : {}), updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/profile')
  return getProfile()
}
