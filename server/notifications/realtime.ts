import 'server-only'
import { EventEmitter } from 'node:events'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { RealtimeChannel } from '@supabase/supabase-js'

/** Realtime events are broadcast through Supabase Realtime, not a direct PostgreSQL LISTEN connection. */
export type Event = { userId: string; kind: 'notification' | 'message' | 'refresh' | 'typing' | 'read' | 'call'; conversationId?: string; by?: string; callId?: string }
const g = globalThis as unknown as { __papaBus?: EventEmitter; __papaRealtimeChannel?: RealtimeChannel; __papaListening?: Promise<void> }
export const bus = g.__papaBus ?? (g.__papaBus = new EventEmitter().setMaxListeners(10_000))

export function ensureListening() {
  if (g.__papaListening) return g.__papaListening
  g.__papaListening = new Promise<void>((resolve, reject) => {
    const channel = createSupabaseAdminClient().channel('papa_events', { config: { broadcast: { self: true } } })
    g.__papaRealtimeChannel = channel
    channel.on('broadcast', { event: 'event' }, ({ payload }) => {
      const e = payload as Event
      if (e && typeof e.userId === 'string') bus.emit(e.userId, e)
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') reject(new Error(`Supabase Realtime subscription failed: ${status}`))
    })
  }).catch((error) => { g.__papaListening = undefined; throw error })
  return g.__papaListening
}

export async function publish(e: Event) {
  await ensureListening()
  const channel = g.__papaRealtimeChannel
  if (!channel) throw new Error('Supabase Realtime channel is not initialized')
  const result = await channel.send({ type: 'broadcast', event: 'event', payload: e })
  if (result !== 'ok') throw new Error(`Supabase Realtime broadcast failed: ${result}`)
}
