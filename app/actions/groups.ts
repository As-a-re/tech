'use server'

import { getSupabaseUser, supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getUserId() { return (await getSupabaseUser()).id }
export async function getGroups() { const userId = await getUserId(); const { data, error } = await supabaseServer().from('groups').select('*').eq('user_id', userId).order('created_at', { ascending: false }); if (error) throw new Error(error.message); return data ?? [] }
export async function createGroup(input: { name: string; description: string; visibility: 'public' | 'private' }) { const userId = await getUserId(); const name = input.name.trim(); const description = input.description.trim(); if (!name || !description) throw new Error('Name and description are required'); const group = { id: crypto.randomUUID(), user_id: userId, name, description, member_count: 1, visibility: input.visibility }; const { error } = await supabaseServer().from('groups').insert(group); if (error) throw new Error(error.message); revalidatePath('/dashboard/groups'); return { ...group, members: group.member_count, image: name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3), posts: 0 } }
