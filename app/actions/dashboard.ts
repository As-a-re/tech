'use server'

import { getSupabaseUser, supabaseServer } from '@/lib/supabase/server'
import { headers } from 'next/headers'

async function getUserId() { return (await getSupabaseUser()).id }

export async function getDashboardData() {
  const userId = await getUserId()
  const supabase = supabaseServer()
  const [groups, announcements, sessions] = await Promise.all([
    supabase.from('groups').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('announcements').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('live_sessions').select('*').eq('user_id', userId).order('starts_at', { ascending: false }),
  ])
  const failure = [groups, announcements, sessions].find((result) => result.error)
  if (failure?.error) throw new Error(failure.error.message)
  return { groups: groups.data ?? [], announcements: announcements.data ?? [], sessions: sessions.data ?? [] }
}
