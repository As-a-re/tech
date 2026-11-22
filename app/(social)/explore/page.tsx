import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { popularPosts, trendingTags, whoToFollow } from '@/server/discovery/explore'
import { Feed } from '@/components/posts/feed'
import { LiveSearch } from '@/components/discovery/live-search'
import { PersonRow } from '@/components/people/person-row'
import { FollowButton } from '@/components/profile/follow-button'

export const metadata = { title: 'Explore' }

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const [tags, popular, people] = await Promise.all([trendingTags(me?.id ?? null, 10), popularPosts(me?.id ?? null), whoToFollow(me?.id ?? null, 8)])
  return (
    <>
      <div className="sticky top-16 z-30 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <LiveSearch autoFocus={sp.focus === '1'} />
      </div>
      <section>
        <h2 className="px-4 pb-1 pt-4 text-xl font-extrabold">{t('explore.trending')}</h2>
        {tags.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">{t('explore.noTrends')}</p> : (
          <ol className="divide-y">
            {tags.map((x, i) => (
              <li key={x.tag}><Link href={`/hashtag/${encodeURIComponent(x.tag)}`} className="block px-4 py-3 hover:bg-muted/40">
                <span className="text-xs text-muted-foreground">{i + 1}</span> <span className="font-bold">#{x.tag}</span>
                <span className="block text-xs text-muted-foreground">{t('explore.posts', { n: x.posts })}</span>
              </Link></li>
            ))}
          </ol>
        )}
      </section>
      {people.length > 0 && (
        <section id="people" className="border-t">
          <h2 className="px-4 pb-1 pt-4 text-xl font-extrabold">{t('explore.whoToFollow')}</h2>
          {people.map((p) => (
            <PersonRow key={p.id} username={p.username} fullName={p.fullName} avatarUrl={p.avatarUrl} verified={p.verified} bio={p.bio} sub={t(`explore.reason.${p.reason}` as MessageKey)}
              action={me ? <FollowButton size="sm" targetId={p.id} initial="none" /> : undefined} />
          ))}
        </section>
      )}
      <section className="border-t">
        <h2 className="px-4 pb-2 pt-4 text-xl font-extrabold">{t('explore.popular')}</h2>
        <Feed initial={popular} request={{ kind: 'for_you' }} empty={t('feed.emptyForYou')} />
      </section>
    </>
  )
}
