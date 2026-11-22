import { getMobileUser, mobileResponseError } from '@/server/identity/mobile-session'
import { homeScopes } from '@/server/community/levels'
import { listAnnouncements, markAnnouncementsSeen } from '@/server/community/announcements'
import type { Scope } from '@/server/community/levels'

export const dynamic = 'force-dynamic'

/** Announcements for the Expo apps, scoped exactly like the website feed. */
export async function GET(request: Request) {
  try {
    const me = await getMobileUser(request)
    if (!me) return mobileResponseError('unauthorised')
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1') || 1
    const home = await homeScopes(me.id)
    const scope: Scope | null = home
      ? { level: 'local', assemblyId: home.assemblyId }
      : null
    const { items, hasMore } = await listAnnouncements({ scope: scope ?? undefined, page, viewerId: me.id })
    return Response.json({ items, page, hasMore })
  } catch {
    return mobileResponseError('server')
  }
}

/** Marks the announcements badge as seen, same as opening the page on the web. */
export async function POST(request: Request) {
  try {
    const me = await getMobileUser(request)
    if (!me) return mobileResponseError('unauthorised')
    await markAnnouncementsSeen(me.id)
    return Response.json({ ok: true })
  } catch {
    return mobileResponseError('server')
  }
}
