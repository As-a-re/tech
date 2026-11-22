'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/server/identity/session'
import { saveFile, UploadError } from '@/integrations/storage'

export type OnboardingState = { error?: string; ok?: boolean }

/** Step 1 of onboarding: optional photo and bio. */
export async function saveBasics(_: OnboardingState, form: FormData): Promise<OnboardingState> {
  const me = await requireUser('/welcome')
  const bio = String(form.get('bio') ?? '').trim().slice(0, 280) || null
  const patch: Record<string, unknown> = { bio, updated_at: new Date().toISOString() }
  const photo = form.get('avatar')
  if (photo instanceof File && photo.size > 0) {
    try { patch.avatar_url = (await saveFile(photo, `avatars/${me.id}`, ['image'])).url } catch (e) {
      if (e instanceof UploadError) return { error: `upload_${e.message}` }
      throw e
    }
  }
  const { error } = await createSupabaseAdminClient().from('users').update(patch).eq('id', me.id)
  if (error) throw new Error(`Unable to save onboarding profile: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function finishOnboarding() {
  const me = await requireUser('/welcome')
  const { data, error } = await createSupabaseAdminClient().from('users').select('onboarded_at').eq('id', me.id).maybeSingle()
  if (error) throw new Error(`Unable to read onboarding status: ${error.message}`)
  if (!data?.onboarded_at) { const { error: updateError } = await createSupabaseAdminClient().from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', me.id); if (updateError) throw new Error(`Unable to finish onboarding: ${updateError.message}`) }
  revalidatePath('/', 'layout')
  redirect('/')
}
