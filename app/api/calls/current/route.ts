import { getCurrentUser } from '@/server/identity/session'
import { currentCall } from '@/server/calls/calls'

export const dynamic = 'force-dynamic'

/** The call ringing for me or that I'm in (null if none). */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return Response.json(null)
  return Response.json(await currentCall(me.id), { headers: { 'Cache-Control': 'no-store' } })
}
