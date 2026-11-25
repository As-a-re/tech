'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let singleton: SupabaseClient | undefined

/** Browser client shares Supabase Auth cookies with server components and actions. */
export function supabaseBrowser(): SupabaseClient {
  if (singleton) return singleton
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase public URL and key are required')
  singleton = createBrowserClient(url, key, {
    cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
  })
  return singleton
}
