import { getCurrentUser } from '@/server/identity/session'
import { listChats, type ChatFilter } from '@/server/messages/chat'

export const dynamic = 'force-dynamic'

/** Chat list for live refresh (plain GET, so it never waits behind other requests). */
export async function GET(req: Request) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  const f = new URL(req.url).searchParams.get('filter')
  const filter: ChatFilter = f === 'unread' || f === 'archived' ? f : 'all'
  return Response.json(await listChats(me.id, filter), { headers: { 'Cache-Control': 'no-store' } })
}
