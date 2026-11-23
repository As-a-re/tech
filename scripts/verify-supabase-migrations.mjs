import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(resolve(root, 'supabase/all-migrations.sql'), 'utf8')
const marker = /^-- ===== (\d{4}_[^=]+\.sql) =====\s*$/gm
const matches = [...bundle.matchAll(marker)]
const failures = []
const seen = new Set()
let checked = 0

for (let i = 0; i < matches.length; i++) {
  const name = matches[i][1].trim()
  if (seen.has(name)) failures.push(`Duplicate bundle section: ${name}`)
  seen.add(name)
  if (Number(name.slice(0, 4)) < 18) continue
  const start = matches[i].index + matches[i][0].length
  const end = i + 1 < matches.length ? matches[i + 1].index : bundle.length
  const expected = bundle.slice(start, end).trim() + '\n'
  const path = resolve(root, 'supabase/migrations', name)
  let actual
  try {
    actual = readFileSync(path, 'utf8').replace(/^-- Generated from supabase\/all-migrations\.sql; keep both copies synchronized\.\r?\n/, '').trim() + '\n'
  } catch {
    failures.push(`Missing migration file: supabase/migrations/${name}`)
    continue
  }
  if (actual !== expected) failures.push(`Bundle/file mismatch: ${name}`)
  else checked++
}

for (const required of [
  '0018_auth_identity_rls.sql', '0019_post_hydration_rpc.sql', '0020_post_compose_rpc.sql',
  '0021_messages_groups_rpc.sql', '0022_library_publication_rpc.sql', '0023_library_publication_mutations_rpc.sql',
  '0024_payments_transaction_rpc.sql', '0025_market_transaction_rpc.sql',
  '0026_chat_notifications_rpc.sql', '0027_notifications_list_rpc.sql', '0028_group_mutations_rpc.sql',
  '0029_moderation_reports_rpc.sql', '0030_market_payout_rpc.sql', '0031_rate_limit_audit_rpc.sql', '0032_market_payout_transfer_status.sql', '0033_post_interaction_rpc.sql', '0034_post_mutation_rpc.sql', '0035_discovery_search_rpc.sql', '0036_discovery_feed_rpc.sql', '0037_discovery_explore_rpc.sql', '0038_post_feed_rpc.sql', '0039_church_member_sync_rpc.sql', '0040_scope_notifications_rpc.sql', '0041_announcements_rpc.sql', '0042_prayer_mutations_rpc.sql', '0043_testimony_mutations_rpc.sql', '0044_events_rpc.sql', '0045_cli_admin_rpc.sql', '0046_market_admin_rpc.sql', '0047_resource_order_rpc.sql', '0048_audit_log_created_at_order.sql', '0049_market_product_save_rpc.sql', '0050_market_catalog_read_rpc.sql', '0051_market_order_lifecycle_rpc.sql', '0052_market_refund_rpc_ambiguity.sql',
]) {
  if (!seen.has(required)) failures.push(`Missing bundle section: ${required}`)
}
if (/-- Supabase migration 0025: Market order state mutations\./.test(bundle.slice(matches.find(m => m[1].startsWith('0018_'))?.index ?? 0, matches.find(m => m[1].startsWith('0019_'))?.index ?? bundle.length))) {
  failures.push('0025 market RPCs are still embedded in the 0018 RLS section')
}

if (failures.length) {
  console.error('Supabase migration verification FAILED')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Supabase migration verification passed: ${checked} individual migration files match the bundle.`)
}
