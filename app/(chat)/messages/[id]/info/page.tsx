import { notFound } from 'next/navigation'
import { requireUser } from '@/server/identity/session'
import { groupInfo } from '@/server/messages/groups'
import { env } from '@/lib/env'
import { GroupInfoView } from '@/components/groups/group-info'

export const metadata = { title: 'Group info' }

export default async function GroupInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requireUser(`/messages/${id}/info`)
  const g = await groupInfo(id, me.id)
  if (!g || !g.me.isMember) notFound()
  return <GroupInfoView g={g} meId={me.id} isTechAdmin={me.role === 'tech_admin'} appUrl={env.appUrl} />
}
