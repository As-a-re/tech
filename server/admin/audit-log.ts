import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { PAGE_SIZE } from './register'
export type AuditFilter = { action?: string; actor?: string; from?: string; to?: string; page?: number }
export async function listAudit(f: AuditFilter) {
  const page = Math.max(1, f.page ?? 1)
  const { data, error } = await createSupabaseAdminClient().rpc('papa_list_audit_log', {
    p_action: f.action ? f.action.replace(/[%_\\]/g, '\\$&') : null,
    p_actor: f.actor ? f.actor.replace(/^@/, '').toLowerCase() : null,
    p_from: f.from ? new Date(f.from).toISOString() : null,
    p_to: f.to ? new Date(`${f.to}T23:59:59.999Z`).toISOString() : null,
    p_page: page, p_page_size: PAGE_SIZE,
  })
  if (error) throw new Error(`Unable to list audit log: ${error.message}`)
  const result = (data ?? {}) as { rows?: any[]; total?: number; page?: number; pages?: number }
  return { rows: result.rows ?? [], total: Number(result.total ?? 0), page: Number(result.page ?? page), pages: Number(result.pages ?? 0) }
}
export async function actionNames() {
  const { data, error } = await createSupabaseAdminClient().rpc('papa_audit_action_names')
  if (error) throw new Error(`Unable to list audit action names: ${error.message}`)
  return (data ?? []) as string[]
}
