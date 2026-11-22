import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/server/identity/session'
import { getLive, initialComments } from '@/server/live/live'
import { LiveWatch } from '@/components/live/live-watch'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const l = await getLive((await params).id, null)
  return { title: l ? `${l.status === 'live' ? '🔴 ' : ''}${l.title}` : 'Live', description: l?.description.slice(0, 160), openGraph: l?.coverUrl ? { images: [l.coverUrl] } : undefined }
}

export default async function WatchLive({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, me] = await Promise.all([params, getCurrentUser()])
  const l = await getLive(id, me)
  if (!l) notFound()
  return <LiveWatch key={`${l.id}:${l.status}`} l={l} me={me ? { id: me.id } : null} initialComments={await initialComments(id)} />
}
