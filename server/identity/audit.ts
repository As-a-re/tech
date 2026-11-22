import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function audit(action: string, opts: { actorId?: string | null; target?: string; meta?: Record<string, unknown>; ip?: string | null } = {}) {
  const { error } = await createSupabaseAdminClient().from('audit_log').insert({
    action,
    actor_id: opts.actorId ?? null,
    target: opts.target ?? null,
    meta: opts.meta ?? null,
    ip: opts.ip ?? null,
  })
  if (error) throw new Error(`Unable to write audit event: ${error.message}`)
}
