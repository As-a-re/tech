import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { getList, listMembersOf } from '@/server/discovery/lists'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'
import { AddMembers, MemberToggle } from '@/components/lists/list-controls'

export const metadata = { title: 'List members' }

export default async function Members({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const list = await getList(id, me?.id ?? null)
  if (!list) notFound()
  const members = await listMembersOf(id)
  const own = me?.id === list.ownerId
  return (
    <>
      <PageHeader title={list.name} subtitle={t('lists.members', { n: members.length })} back={`/lists/${id}`} />
      {own && <AddMembers listId={id} existing={members.map((m) => m.id)} />}
      <div className="divide-y">{members.map((m) => (
        <PersonRow key={m.id} username={m.username} fullName={m.fullName} avatarUrl={m.avatarUrl} verified={m.verified} sub={m.assemblyName} bio={m.bio}
          action={own ? <MemberToggle listId={id} userId={m.id} initial /> : undefined} />
      ))}</div>
    </>
  )
}
