import { getCurrentUser } from '@/server/identity/session'
import { listMessages } from '@/server/messages/chat'

export const dynamic = 'force-dynamic'

/** Messages of one chat: newest page, `?before=` older ones, `?after=` newer ones. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const r = await listMessages((await params).id, me.id, { before: sp.get('before') ?? undefined, after: sp.get('after') ?? undefined })
  return r ? Response.json(r, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'not_found' }, { status: 404 })
}
