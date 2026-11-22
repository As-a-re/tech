import { getCurrentUser } from '@/server/identity/session'
import { startCall } from '@/server/calls/calls'

/** Start a call in a chat: { conversationId, media: 'voice' | 'video' }. Returns the LiveKit pass. */
export async function POST(req: Request) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ ok: false, error: 'auth' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { conversationId?: string; media?: string }
  if (typeof b.conversationId !== 'string') return Response.json({ ok: false, error: 'not_found' }, { status: 400 })
  return Response.json(await startCall(me.id, b.conversationId, b.media === 'video' ? 'video' : 'voice'), { headers: { 'Cache-Control': 'no-store' } })
}
