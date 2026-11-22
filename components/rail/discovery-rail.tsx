import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { trendingTags, whoToFollow } from '@/server/discovery/explore'
import { listEvents } from '@/server/community/events'
import { celebrations } from '@/server/devotion/birthdays'
import { UserAvatar } from '@/components/common/user-avatar'
import { DateBlock } from '@/components/community/event-row'
import { timeLabel } from '@/lib/community/dates'
import { PersonRow } from '@/components/people/person-row'
import { FollowButton } from '@/components/profile/follow-button'

/** Right column: trending hashtags, upcoming events, who to follow (search is in the top bar). */
export async function DiscoveryRail() {
  const [t, me] = await Promise.all([getT(), getCurrentUser()])
  const [tags, people, events] = await Promise.all([trendingTags(me?.id ?? null, 6), whoToFollow(me?.id ?? null, 4), listEvents({ viewerId: me?.id ?? null, limit: 3 })])
  const today = me ? (await celebrations({ id: me.id, assemblyId: me.assemblyId }, 'today', 'assembly')).filter((p) => p.id !== me.id).slice(0, 5) : []
  return (
    <>
      <section className="overflow-hidden rounded-2xl border">
        <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">{t('explore.trending')}</h2>
        {tags.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">{t('explore.noTrends')}</p> : tags.map((x, i) => (
          <Link key={x.tag} href={`/hashtag/${encodeURIComponent(x.tag)}`} className="block px-4 py-2.5 hover:bg-muted/50">
            <span className="block text-xs text-muted-foreground">{i + 1} · {t('explore.trending')}</span>
            <span className="block font-bold">#{x.tag}</span>
            <span className="block text-xs text-muted-foreground">{t('explore.posts', { n: x.posts })}</span>
          </Link>
        ))}
        <Link href="/explore" className="block px-4 py-3 text-sm text-primary hover:bg-muted/50">{t('explore.showMore')}</Link>
      </section>
      {today.length > 0 && (
        <section className="overflow-hidden rounded-2xl border">
          <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">🎉 {t('birthdays.rail')}</h2>
          {today.map((p) => (
            <Link key={`${p.kind}-${p.id}`} href={`/u/${p.username}`} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50">
              <UserAvatar name={p.fullName} src={p.avatarUrl} className="size-9" />
              <span className="min-w-0"><span className="block truncate font-semibold">{p.fullName}</span><span className="block text-xs text-muted-foreground">{t(p.kind === 'birthday' ? 'birthdays.birthday' : 'birthdays.anniversary')}</span></span>
            </Link>
          ))}
          <Link href="/birthdays" className="block px-4 py-3 text-sm text-primary hover:bg-muted/50">{t('birthdays.short')} →</Link>
        </section>
      )}
      {events.items.length > 0 && (
        <section className="overflow-hidden rounded-2xl border">
          <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">{t('events.upcoming')}</h2>
          {events.items.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
              <DateBlock iso={e.startsAt} className="size-11" />
              <span className="min-w-0"><span className="block truncate font-semibold">{e.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{timeLabel(e.startsAt)}{e.venue && ` · ${e.venue}`}</span></span>
            </Link>
          ))}
          <Link href="/events" className="block px-4 py-3 text-sm text-primary hover:bg-muted/50">{t('events.seeAll')}</Link>
        </section>
      )}
      {people.length > 0 && (
        <section className="overflow-hidden rounded-2xl border">
          <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">{t('explore.whoToFollow')}</h2>
          {people.map((p) => (
            <PersonRow key={p.id} username={p.username} fullName={p.fullName} avatarUrl={p.avatarUrl} verified={p.verified} sub={t(`explore.reason.${p.reason}` as MessageKey)}
              action={me ? <FollowButton size="sm" targetId={p.id} initial="none" /> : undefined} />
          ))}
          <Link href="/explore#people" className="block px-4 py-3 text-sm text-primary hover:bg-muted/50">{t('explore.showMore')}</Link>
        </section>
      )}
    </>
  )
}
