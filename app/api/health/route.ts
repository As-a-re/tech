import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Used by hosting/monitoring to confirm the app and database are up. */
export async function GET() {
  try {
    const { error } = await createSupabaseAdminClient().from('users').select('id').limit(1)
    if (error) throw error
    return Response.json({ status: 'ok', database: 'ok', time: new Date().toISOString() })
  } catch {
    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503 })
  }
}
