import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/** Fixed-window limiter stored in Postgres through server-only Supabase RPCs. */
export async function hit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc('papa_hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) throw new Error(`Unable to update rate limit: ${error.message}`)
  return data === true
}
export async function clear(key: string) {
  const { error } = await createSupabaseAdminClient().rpc('papa_clear_rate_limit', { p_key: key })
  if (error) throw new Error(`Unable to clear rate limit: ${error.message}`)
}
