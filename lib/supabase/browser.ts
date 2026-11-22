'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let singleton: SupabaseClient | undefined

/** Public client for browser-safe Supabase operations protected by RLS. */
export function supabaseBrowser(): SupabaseClient {
  if (singleton) return singleton
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  singleton = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  return singleton
}
