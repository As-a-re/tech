import 'server-only'
import { supabaseServer } from '@/lib/supabase/server'
import { builtInVerse, today, type Verse } from '@/lib/devotion/verses'

export type DayVerse = Verse & { day: string; chosen: boolean }
type DailyVerseRow = { day: string; reference: string; text: string; translation: string; set_by?: string | null; created_at?: string }

/** The verse for a day: the Tech Admins' choice if there is one, otherwise the built-in list. */
export async function verseFor(day = today()): Promise<DayVerse> {
  const { data, error } = await supabaseServer().from('daily_verses').select('day, reference, text, translation').eq('day', day).maybeSingle()
  if (error) throw new Error(`Could not load daily verse: ${error.message}`)
  const v = data as Pick<DailyVerseRow, 'day' | 'reference' | 'text' | 'translation'> | null
  return v ? { day, reference: v.reference, text: v.text, translation: v.translation, chosen: true } : { day, ...builtInVerse(day), chosen: false }
}

/** The last `days` days, newest first (for the archive). */
export async function recentVerses(days = 30, end = today()): Promise<DayVerse[]> {
  const endMs = Date.parse(`${end}T00:00:00Z`)
  const start = new Date(endMs - (days - 1) * 864e5).toISOString().slice(0, 10)
  const { data, error } = await supabaseServer().from('daily_verses').select('day, reference, text, translation').gte('day', start).lte('day', end)
  if (error) throw new Error(`Could not load verse archive: ${error.message}`)
  const chosen = (data ?? []) as Pick<DailyVerseRow, 'day' | 'reference' | 'text' | 'translation'>[]
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(endMs - i * 864e5).toISOString().slice(0, 10)
    const v = chosen.find((c) => c.day === day)
    return v ? { day, reference: v.reference, text: v.text, translation: v.translation, chosen: true } : { day, ...builtInVerse(day), chosen: false }
  })
}

export type VerseInput = { day: string; reference: string; text: string; translation?: string }
export async function setVerse(adminId: string, i: VerseInput): Promise<{ ok: true } | { ok: false; error: 'day' | 'reference' | 'text' }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.day) || isNaN(Date.parse(i.day))) return { ok: false, error: 'day' }
  const reference = i.reference.trim(), text = i.text.trim(), translation = (i.translation?.trim() || 'KJV').slice(0, 12)
  if (reference.length < 3 || reference.length > 60) return { ok: false, error: 'reference' }
  if (text.length < 5 || text.length > 1000) return { ok: false, error: 'text' }
  const { error } = await supabaseServer().from('daily_verses').upsert({ day: i.day, reference, text, translation, set_by: adminId }, { onConflict: 'day' })
  if (error) throw new Error(`Could not save daily verse: ${error.message}`)
  return { ok: true }
}

export async function removeVerse(day: string) {
  const { error } = await supabaseServer().from('daily_verses').delete().eq('day', day)
  if (error) throw new Error(`Could not remove daily verse: ${error.message}`)
}

/** Upcoming and recent choices (Admin → Daily verse). */
export async function chosenVerses() {
  const { data, error } = await supabaseServer().from('daily_verses').select('*').order('day', { ascending: false }).limit(60)
  if (error) throw new Error(`Could not load chosen verses: ${error.message}`)
  return data ?? []
}
