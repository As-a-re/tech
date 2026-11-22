'use client'

/**
 * Small JSON helpers for live screens. Reads use plain fetch (not server actions), because
 * server actions run one at a time and frequent background refreshes would hold up taps and page changes.
 */
export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    return r.ok ? ((await r.json()) as T) : null
  } catch { return null }
}

export async function postJson<T>(url: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    return r.ok ? ((await r.json()) as T) : null
  } catch { return null }
}

/** One shared request for the top-bar badge numbers, however many badges ask at once. */
type Counts = { notifications: number; announcements: number; chats: number; calls?: number; cart?: number }
let inflight: Promise<Counts | null> | null = null
export function fetchCounts() {
  inflight ??= getJson<Counts>('/api/counts').finally(() => { setTimeout(() => { inflight = null }, 300) })
  return inflight
}
