import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function favoritesOf(userId: string) {
  const client = createSupabaseAdminClient()
  const { data: favorites, error } = await client.from('favorites').select('favorite_id,created_at').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(`Unable to load favorites: ${error.message}`)
  const ids = [...new Set((favorites ?? []).map(x => x.favorite_id))]
  if (!ids.length) return []
  const { data: users, error: usersError } = await client.from('users').select('id,username,full_name,avatar_url,bio,assembly_id,verified_at,status').in('id', ids).eq('status', 'active')
  if (usersError) throw new Error(`Unable to load favorite profiles: ${usersError.message}`)
  const assemblyIds = [...new Set((users ?? []).map(x => x.assembly_id).filter(Boolean))]
  const { data: assemblies, error: assembliesError } = assemblyIds.length
    ? await client.from('assemblies').select('id,name').in('id', assemblyIds)
    : { data: [], error: null }
  if (assembliesError) throw new Error(`Unable to load favorite assemblies: ${assembliesError.message}`)
  const assemblyNames = new Map((assemblies ?? []).map(x => [x.id, x.name]))
  const people = new Map((users ?? []).map(x => [x.id, x]))
  return (favorites ?? []).map(f => {
    const u = people.get(f.favorite_id)
    if (!u) return null
    return { id: u.id, username: u.username, fullName: u.full_name, avatarUrl: u.avatar_url, bio: u.bio,
      assemblyName: assemblyNames.get(u.assembly_id) ?? null, verified: !!u.verified_at }
  }).filter(Boolean)
}
