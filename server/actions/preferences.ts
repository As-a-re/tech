'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'

/** Saves the chosen language on this device, and on the account when signed in. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return
  ;(await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  const me = await getCurrentUser()
  if (me) {
    const { error } = await createSupabaseAdminClient().from('users').update({ locale }).eq('id', me.id)
    if (error) throw new Error(`Unable to save account language: ${error.message}`)
  }
  revalidatePath('/', 'layout')
}
