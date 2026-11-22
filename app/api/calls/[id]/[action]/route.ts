import { getCurrentUser } from '@/server/identity/session'
import { declineCall, joinCall, leaveCall, pingCall } from '@/server/calls/calls'

/** Answer / join, decline, hang up, or check in while on the call screen. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ ok: false, error: 'auth' }, { status: 401 })
  const { id, action } = await params
  const headers = { 'Cache-Control': 'no-store' }
  if (action === 'join') return Response.json(await joinCall(me.id, id), { headers })
  if (action === 'decline') return Response.json({ ok: await declineCall(me.id, id) }, { headers })
  if (action === 'leave') return Response.json({ ok: await leaveCall(me.id, id) }, { headers })
  if (action === 'ping') return Response.json({ ok: await pingCall(me.id, id) }, { headers })
  return Response.json({ ok: false, error: 'not_found' }, { status: 404 })
}
