import 'server-only'
import { supabaseServer } from './server'

/** Trusted server-side Supabase client. Never import this module from client components. */
export function createSupabaseAdminClient() {
  return supabaseServer()
}
