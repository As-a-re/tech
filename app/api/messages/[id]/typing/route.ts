import { getCurrentUser } from '@/server/identity/session'
import { typing } from '@/server/messages/chat'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  await typing((await params).id, me.id)
  return Response.json({ ok: true })
}
