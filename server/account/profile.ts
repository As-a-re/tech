import 'server-only'
import { supabaseServer } from '@/lib/supabase/server'
import { saveFile, UploadError } from '@/integrations/storage'

export type ProfileResult = { ok: true } | { ok: false; field: string; error: string }

export function normaliseWebsite(raw: string): string | null | false {
  const v = raw.trim()
  if (!v) return null
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return false
    return u.toString().replace(/\/$/, '')
  } catch { return false }
}

export async function updateProfile(userId: string, input: { bio: string; website: string; anniversary?: string; avatar?: File | null; cover?: File | null; removeAvatar?: boolean; removeCover?: boolean }): Promise<ProfileResult> {
  const bio = input.bio.trim()
  if (bio.length > 280) return { ok: false, field: 'bio', error: 'bio_long' }
  const website = normaliseWebsite(input.website)
  if (website === false) return { ok: false, field: 'website', error: 'website_invalid' }
  const ann = input.anniversary?.trim() || null
  if (ann && (!/^\d{4}-\d{2}-\d{2}$/.test(ann) || isNaN(Date.parse(ann)) || Date.parse(ann) > Date.now())) return { ok: false, field: 'anniversary', error: 'anniversary_invalid' }
  const patch: Record<string, string | null> = { bio: bio || null, website, ...(input.anniversary !== undefined ? { anniversary: ann } : {}) }
  try {
    if (input.avatar && input.avatar.size > 0) patch.avatar_url = (await saveFile(input.avatar, `avatars/${userId}`, ['image'])).url
    else if (input.removeAvatar) patch.avatar_url = null
    if (input.cover && input.cover.size > 0) patch.cover_url = (await saveFile(input.cover, `covers/${userId}`, ['image'])).url
    else if (input.removeCover) patch.cover_url = null
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, field: 'photo', error: `upload_${e.message}` }
    throw e
  }
  const { error } = await supabaseServer().from('users').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) throw new Error(`Could not update profile: ${error.message}`)
  return { ok: true }
}
