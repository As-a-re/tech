import { Users } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { groupByInvite, groupInfo } from '@/server/messages/groups'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { JoinButton } from '@/components/groups/join-button'

export const metadata = { title: 'Group invite' }

export default async function JoinByLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [me, t] = await Promise.all([requireUser(`/groups/join/${code}`), getT()])
  const id = await groupByInvite(code)
  const g = id ? await groupInfo(id, me.id, { invite: true }) : null
  return (
    <>
      <PageHeader title={t('groups.inviteTitle')} back="/groups" />
      {!g ? <p className="px-8 py-16 text-center text-muted-foreground">{t('groups.inviteBad')}</p> : (
        <div className="mx-auto max-w-sm space-y-4 px-4 py-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {g.avatarUrl ? <img src={g.avatarUrl} alt="" className="mx-auto size-28 rounded-full object-cover" />
            : <span className="mx-auto flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-14" /></span>}
          <div><h2 className="text-2xl font-extrabold">{g.title}</h2><p className="text-sm text-muted-foreground">{t('groups.members', { n: g.memberCount })}</p></div>
          {g.description && <p className="whitespace-pre-line text-[15px]">{g.description}</p>}
          <div className="flex justify-center -space-x-2">{g.members.slice(0, 6).map((m) => <UserAvatar key={m.id} name={m.fullName} src={m.avatarUrl} className="size-9 border-2 border-background" />)}</div>
          {g.approveJoins && !g.me.isMember && <p className="text-sm text-muted-foreground">{t('groups.needsApproval')}</p>}
          <JoinButton id={g.id} via="link" member={g.me.isMember} requested={g.me.requested} approve={g.approveJoins} wide />
        </div>
      )}
    </>
  )
}
