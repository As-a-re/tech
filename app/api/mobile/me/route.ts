import { getCurrentUser } from '@/server/identity/session'
import { mobileResponseError } from '@/server/identity/mobile-session'

export const dynamic = 'force-dynamic'

/** The signed-in member's own details for the Expo apps. */
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return mobileResponseError('unauthorised')
    return Response.json({ user: me })
  } catch {
    return mobileResponseError('server')
  }
}
