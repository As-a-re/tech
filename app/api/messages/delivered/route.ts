import { getCurrentUser } from '@/server/identity/session'
import { markDelivered } from '@/server/messages/chat'

export async function POST() {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  await markDelivered(me.id)
  return Response.json({ ok: true })
}
