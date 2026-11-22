import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { engagers } from '@/server/posts/feeds'
import { hydrate } from '@/server/posts/hydrate'
import { followingSet } from '@/server/social/relationships'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'
import { FollowButton } from '@/components/profile/follow-button'

export async function EngagersPage({ id, kind }: { id: string; kind: 'likes' | 'reposts' }) {
  const [t, me] = await Promise.all([getT(), getCurrentUser()])
  if (!/^[0-9a-f-]{36}$/.test(id) || !(await hydrate([id], me?.id ?? null)).has(id)) notFound()
  const people = await engagers(id, kind, me?.id ?? null)
  const mine = await followingSet(me?.id ?? null, people.map((p) => p.id))
  return (
    <>
      <PageHeader title={kind === 'likes' ? t('post.likedBy') : t('post.repostedBy')} back={`/post/${id}`} />
      <div className="divide-y">
        {people.map((p) => (
          <PersonRow key={p.id} username={p.username} fullName={p.full_name} avatarUrl={p.avatar_url} verified={p.verified} sub={p.assembly_name} bio={p.bio}
            action={me && me.id !== p.id ? <FollowButton size="sm" targetId={p.id} initial={mine.has(p.id) ? 'following' : 'none'} /> : undefined} />
        ))}
      </div>
    </>
  )
}
