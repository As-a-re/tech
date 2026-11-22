import { notFound } from 'next/navigation'
import { requireUser } from '@/server/identity/session'
import { getLive } from '@/server/live/live'
import { StudioHost } from '@/components/live/studio-host'

export const metadata = { title: 'Studio' }

export default async function Studio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requireUser(`/live/${id}/studio`)
  const l = await getLive(id, me)
  if (!l || !l.canHost || l.source !== 'studio' || l.status === 'ended') notFound()
  return <StudioHost id={l.id} title={l.title} status={l.status} />
}
