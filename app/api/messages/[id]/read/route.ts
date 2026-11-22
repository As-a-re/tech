import { getCurrentUser } from '@/server/identity/session'
import { markRead } from '@/server/messages/chat'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  return Response.json({ ok: await markRead((await params).id, me.id) })
}
