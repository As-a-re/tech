import { getCurrentUser } from '@/server/identity/session'
import { callHistory, markCallsSeen } from '@/server/calls/calls'

export const dynamic = 'force-dynamic'

/** Calls tab (opening it clears the missed-call count on the badge). */
export async function GET(req: Request) {
  const me = await getCurrentUser()
  if (!me) return Response.json([], { status: 401 })
  const url = new URL(req.url)
  const items = await callHistory(me.id, url.searchParams.get('before') ?? undefined)
  if (url.searchParams.get('seen') === '1') await markCallsSeen(me.id)
  return Response.json(items, { headers: { 'Cache-Control': 'no-store' } })
}
