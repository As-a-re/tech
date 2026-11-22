import 'server-only'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

export const SETTINGS = {
  support: { schema: z.object({ email: z.string().trim().max(120), phone: z.string().trim().max(40) }), fallback: () => ({ email: env.supportEmail, phone: env.supportPhone }) },
  bannedWords: { schema: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(500), fallback: () => [] as string[] },
  marketFeePercent: { schema: z.number().min(0).max(20), fallback: () => 2.5 },
} as const
export type SettingKey = keyof typeof SETTINGS
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]['schema']>
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const { data, error } = await createSupabaseAdminClient().from('platform_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw new Error(`Unable to read platform setting: ${error.message}`)
  const parsed = data ? SETTINGS[key].schema.safeParse(data.value) : null
  return (parsed?.success ? parsed.data : SETTINGS[key].fallback()) as SettingValue<K>
}
export async function setSetting<K extends SettingKey>(key: K, value: unknown): Promise<boolean> {
  const parsed = SETTINGS[key].schema.safeParse(value)
  if (!parsed.success) return false
  const { error } = await createSupabaseAdminClient().from('platform_settings').upsert({ key, value: parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`Unable to save platform setting: ${error.message}`)
  return true
}
