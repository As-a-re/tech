import { getCurrentUser } from '@/server/identity/session'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { bus, ensureListening } from '@/server/notifications/realtime'

export const dynamic = 'force-dynamic'

/** Server-Sent Events: pushes "something new" signals to the signed-in member's open screens. */
export async function GET(req: Request) {
  const me = await getCurrentUser()
  if (!me) return new Response('Unauthorized', { status: 401 })
  await ensureListening()
  const enc = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => { try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { cleanup() } }
      const onEvent = (e: unknown) => send(e)
      bus.on(me.id, onEvent)
      bus.on('*', onEvent)
      // Presence: "online" while a screen is open (last_seen refreshed about every 2 minutes)
      const seen = async () => { const { error } = await createSupabaseAdminClient().from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', me.id); if (error) console.error('presence update failed', error.message) }
      void seen()
      let beats = 0
      const ping = setInterval(() => { try { controller.enqueue(enc.encode(': ping\n\n')); if (++beats % 5 === 0) void seen() } catch { cleanup() } }, 25_000)
      cleanup = () => { clearInterval(ping); bus.off(me.id, onEvent); bus.off('*', onEvent) }
      req.signal.addEventListener('abort', () => { cleanup(); try { controller.close() } catch { /* closed */ } })
      send({ kind: 'hello' })
    },
    cancel() { cleanup() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
