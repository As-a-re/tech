import { getCurrentUser } from '@/server/identity/session'
import { saveProgress } from '@/server/library/publications'

/** The reader saves where you are (page or chapter) every few seconds. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ ok: false }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { position?: number; percent?: number }
  await saveProgress(me.id, (await params).id, Number(b.position) || 1, Number(b.percent) || 0)
  return Response.json({ ok: true })
}
