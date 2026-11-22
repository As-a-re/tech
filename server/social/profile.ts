import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { counts, getPreferences, relationship, type Relationship } from './relationships'

export type ProfileView = {
  id: string; username: string; fullName: string; bio: string | null; website: string | null
  avatarUrl: string | null; coverUrl: string | null; createdAt: Date; role: 'member' | 'tech_admin'
  verified: boolean; verifiedLabel: string | null
  assemblyName: string; districtName: string
  privateProfile: boolean
  counts: { followers: number; following: number; requests: number }
  rel: Relationship
  access: 'full' | 'private' | 'members_only' | 'blocked' | 'blocked_by'
}

export async function loadProfile(username: string, viewerId: string | null): Promise<ProfileView | null> {
  const client = createSupabaseAdminClient()
  const normalized = username.toLowerCase().replace(/^@/, '')
  const { data: u, error } = await client.from('users')
    .select('id,username,full_name,bio,website,avatar_url,cover_url,created_at,role,status,verified_at,verified_label,assembly_id')
    .ilike('username', normalized).maybeSingle()
  if (error) throw new Error(`Unable to load profile: ${error.message}`)
  if (!u || u.status !== 'active') return null
  const { data: assembly, error: assemblyError } = await client.from('assemblies').select('name,district_id').eq('id', u.assembly_id).maybeSingle()
  if (assemblyError) throw new Error(`Unable to load profile assembly: ${assemblyError.message}`)
  if (!assembly) return null
  const { data: district, error: districtError } = await client.from('districts').select('name').eq('id', assembly.district_id).maybeSingle()
  if (districtError) throw new Error(`Unable to load profile district: ${districtError.message}`)
  const [prefs, rel, c] = await Promise.all([getPreferences(u.id), relationship(viewerId, u.id), counts(u.id)])
  const access: ProfileView['access'] = rel.blockedBy ? 'blocked_by' : rel.blocking ? 'blocked'
    : !viewerId && !prefs.visibleToGuests ? 'members_only'
      : prefs.privateProfile && !rel.self && !rel.following ? 'private' : 'full'
  return {
    id: u.id, username: u.username, fullName: u.full_name, bio: u.bio, website: u.website,
    avatarUrl: u.avatar_url, coverUrl: u.cover_url, createdAt: new Date(u.created_at), role: u.role,
    verified: !!u.verified_at, verifiedLabel: u.verified_label, assemblyName: assembly.name,
    districtName: district?.name ?? '', privateProfile: prefs.privateProfile, counts: c, rel, access,
  }
}
