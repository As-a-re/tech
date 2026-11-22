import { getCurrentUser } from '@/server/identity/session'
import * as live from '@/server/live/live'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Live screen calls (plain fetch, so they never queue behind other actions):
 * poll (viewers, reactions, new comments), react, comment, watch (LiveKit pass), studio (host pass) and ping (host).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params
  const me = await getCurrentUser()
  const b = await req.json().catch(() => ({})) as { key?: string; after?: string; emoji?: string; body?: string }
  const key = me ? `u:${me.id}` : `g:${String(b.key ?? '').slice(0, 60)}`
  if (action === 'poll') return Response.json(await live.poll(id, key, b.after ?? null), { headers })
  if (action === 'react') return Response.json({ ok: await live.react(key, id, String(b.emoji ?? '')) }, { headers })
  if (action === 'watch') return Response.json(await live.watchPass(key, me?.fullName ?? 'Guest', id), { headers })
  if (!me) return Response.json({ ok: false, error: 'auth' }, { status: 401 })
  if (action === 'comment') return Response.json(await live.postComment(me, id, String(b.body ?? '')), { headers })
  if (action === 'studio') return Response.json(await live.studioPass(me, id), { headers })
  if (action === 'ping') { await live.hostPing(me, id); return Response.json({ ok: true, viewers: await live.viewerCount(id) }, { headers }) }
  return Response.json({ ok: false }, { status: 404 })
}
