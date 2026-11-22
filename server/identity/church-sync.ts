import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { cacheMember, churchDirectory, type ChurchMember } from '@/integrations/church-db'
import { audit } from '@/server/identity/audit'
const EVERY_MINUTES = 15, KEY = 'churchSync'
type State = { since:string; lastRunAt:string|null; lastCount:number; lastError:string|null }
const fallback = (): State => ({ since:new Date(0).toISOString(), lastRunAt:null, lastCount:0, lastError:null })
async function readState(): Promise<State> {
  const { data, error } = await createSupabaseAdminClient().from('platform_settings').select('value').eq('key', KEY).maybeSingle()
  if (error) throw new Error(`Unable to read church sync state: ${error.message}`)
  return data?.value as State ?? fallback()
}
async function writeState(s: State) {
  const { error } = await createSupabaseAdminClient().from('platform_settings').upsert({ key:KEY, value:s, updated_at:new Date().toISOString() }, { onConflict:'key' })
  if (error) throw new Error(`Unable to save church sync state: ${error.message}`)
}
export async function applyMember(m: ChurchMember) {
  const assemblyId = await cacheMember(m), sb = createSupabaseAdminClient()
  const { data: u, error } = await sb.from('users').select('id').eq('church_id', m.churchId).maybeSingle()
  if (error) throw new Error(`Unable to find linked account: ${error.message}`)
  if (!u) return
  const { error: updateError } = await sb.from('users').update({ full_name:m.fullName, phone:m.phone, assembly_id:assemblyId }).eq('id', u.id)
  if (updateError) throw new Error(`Unable to refresh linked account: ${updateError.message}`)
  if (!m.active) {
    const { error: sessionError } = await sb.from('sessions').delete().eq('user_id', u.id)
    if (sessionError) throw new Error(`Unable to revoke sessions: ${sessionError.message}`)
  }
}
export async function syncChurchChanges(force = false) {
  if (env.churchDbMode !== 'api') return 0
  const dir = churchDirectory(); if (!dir.changes) return 0
  const state = await readState()
  if (!force && state.lastRunAt && Date.now() - Date.parse(state.lastRunAt) < EVERY_MINUTES * 60_000) return 0
  const sb = createSupabaseAdminClient(), lockKey = `${KEY}Lock`, now = new Date().toISOString()
  const { data: lock, error: lockError } = await sb.from('platform_settings').select('updated_at').eq('key', lockKey).maybeSingle()
  if (lockError) throw new Error(`Unable to check church sync lock: ${lockError.message}`)
  if (lock && Date.now() - Date.parse(lock.updated_at) < 5 * 60_000 && !force) return 0
  const { error: claimError } = await sb.from('platform_settings').upsert({ key:lockKey, value:{ startedAt:now }, updated_at:now }, { onConflict:'key' })
  if (claimError) throw new Error(`Unable to claim church sync: ${claimError.message}`)
  let n = 0, cursor: string | null = null, until = state.since
  try {
    for (let page = 0; page < 200; page++) {
      const r = await dir.changes(state.since, cursor)
      for (const m of r.members) { await applyMember(m); n++ }
      until = r.until; cursor = r.nextCursor; if (!cursor) break
    }
    await writeState({ since:until, lastRunAt:new Date().toISOString(), lastCount:n, lastError:null })
    if (n) await audit('church.sync', { meta:{ members:n } })
  } catch (e) {
    await writeState({ ...state, lastRunAt:new Date().toISOString(), lastCount:n, lastError:(e as Error).message.slice(0,200) })
  } finally {
    const { error } = await sb.from('platform_settings').delete().eq('key', lockKey)
    if (error) console.error('Unable to release church sync lock', error.message)
  }
  return n
}
export async function churchSyncStatus() { return env.churchDbMode === 'api' ? readState() : null }
