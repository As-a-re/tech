import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { loadProfile } from '@/server/social/profile'
import { followingSet, listPeople, PEOPLE_PAGE } from '@/server/social/relationships'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from './person-row'
import { FollowButton } from '@/components/profile/follow-button'
import { cn } from '@/lib/utils'

/** Followers / Following of a member, with tabs and "Show more". */
export async function PeoplePage({ username, kind, before }: { username: string; kind: 'followers' | 'following'; before?: string }) {
  const [me, t] = await Promise.all([getCurrentUser(), getT()])
  const p = await loadProfile(username, me?.id ?? null)
  if (!p) notFound()
  const allowed = p.access === 'full'
  const rows = allowed ? await listPeople(kind, p.id, before ? new Date(before) : undefined) : []
  const mine = await followingSet(me?.id ?? null, rows.map((r) => r.id))
  return (
    <>
      <PageHeader title={p.fullName} subtitle={`@${p.username}`} back={`/u/${p.username}`} />
      <nav className="flex border-b">
        {(['followers', 'following'] as const).map((k) => (
          <Link key={k} href={`/u/${p.username}/${k}`} className={cn('relative flex-1 py-3.5 text-center text-sm font-medium hover:bg-muted', k === kind ? 'text-foreground' : 'text-muted-foreground')}>
            {k === 'followers' ? t('profile.followers') : t('profile.followingCount')}
            {k === kind && <span className="absolute inset-x-1/2 bottom-0 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />}
          </Link>
        ))}
      </nav>
      {!allowed ? (
        <p className="px-8 py-14 text-center text-muted-foreground">{t('profile.privateTitle')}</p>
      ) : rows.length === 0 ? (
        <p className="px-8 py-14 text-center text-muted-foreground">{kind === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}</p>
      ) : (
        <div className="divide-y">
          {rows.map((r) => (
            <PersonRow key={r.id} username={r.username} fullName={r.fullName} avatarUrl={r.avatarUrl} verified={r.verified} sub={r.assemblyName} bio={r.bio}
              action={me && me.id !== r.id ? <FollowButton size="sm" targetId={r.id} initial={mine.has(r.id) ? 'following' : 'none'} /> : undefined} />
          ))}
        </div>
      )}
      {rows.length === PEOPLE_PAGE && (
        <Link href={`/u/${p.username}/${kind}?before=${rows.at(-1)!.at.toISOString()}`} className="block border-t py-4 text-center text-sm font-medium text-primary hover:bg-muted">{t('profile.loadMore')}</Link>
      )}
    </>
  )
}
