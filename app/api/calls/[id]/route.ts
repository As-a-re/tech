import { getCurrentUser } from '@/server/identity/session'
import { callView } from '@/server/calls/calls'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json(null, { status: 401 })
  const v = await callView((await params).id, me.id)
  return Response.json(v, { status: v ? 200 : 404, headers: { 'Cache-Control': 'no-store' } })
}
