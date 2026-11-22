import { getEvent, toIcs } from '@/server/community/events'
import { env } from '@/lib/env'

/** "Add to calendar": an .ics file any phone or computer calendar can open. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const e = await getEvent(id, null)
  if (!e) return new Response('Not found', { status: 404 })
  const name = e.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'event'
  return new Response(toIcs(e, `${env.appUrl}/events/${id}`), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.ics"` },
  })
}
