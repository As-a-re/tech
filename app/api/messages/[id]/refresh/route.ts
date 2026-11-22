import { getCurrentUser } from '@/server/identity/session'
import { refreshMessages } from '@/server/messages/chat'

/** Fresh ticks, reactions, edits and deletions for messages already on screen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  const body = await req.json().catch(() => null) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)) : []
  return Response.json(await refreshMessages((await params).id, me.id, ids))
}
