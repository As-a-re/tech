import Link from 'next/link'
import { shopOf } from '@/server/market/catalog'
import { notFound } from 'next/navigation'
import { Ban, CalendarDays, Church, Globe, Lock, MapPin, Star, Store } from 'lucide-react'
import { getLocale, getT } from '@/lib/i18n/server'
import { isDataSaver } from '@/lib/display-server'
import { getCurrentUser } from '@/server/identity/session'
import { loadProfile } from '@/server/social/profile'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { FollowButton } from '@/components/profile/follow-button'
import { ProfileMenu } from '@/components/profile/profile-menu'
import { MessageButton } from '@/components/messages/message-button'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { Feed } from '@/components/posts/feed'
import { PostCard } from '@/components/posts/post-card'
import { pinnedPost, profileFeed, type ProfileTab } from '@/server/posts/feeds'
import { isFavorite } from '@/server/posts/interactions'
import { cn } from '@/lib/utils'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const p = await loadProfile((await params).username, null)
  return p ? { title: `${p.fullName} (@${p.username})`, description: p.bio ?? undefined, openGraph: { images: p.avatarUrl ? [p.avatarUrl] : undefined } } : { title: 'Profile' }
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ username }, { tab: rawTab }] = await Promise.all([params, searchParams])
  const [me, t, locale, saver] = await Promise.all([getCurrentUser(), getT(), getLocale(), isDataSaver()])
  const p = await loadProfile(username, me?.id ?? null)
  if (!p) notFound()
  const hidden = p.access === 'blocked' || p.access === 'blocked_by' || p.access === 'members_only'
  const tabs: ProfileTab[] = p.rel.self ? ['posts', 'replies', 'media', 'likes'] : ['posts', 'replies', 'media']
  const tab: ProfileTab = tabs.includes(rawTab as ProfileTab) ? (rawTab as ProfileTab) : 'posts'
  const showActivity = p.access === 'full'
  const [page, pinned, favorite] = await Promise.all([
    showActivity ? profileFeed(p.id, tab, me?.id ?? null) : null,
    showActivity && tab === 'posts' ? pinnedPost(p.id, me?.id ?? null) : null,
    me && !p.rel.self ? isFavorite(me.id, p.id) : false,
  ])
  const tabLabel = { posts: t('profile.tabPosts'), replies: t('profile.tabReplies'), media: t('profile.tabMedia'), likes: t('profile.tabLikes') }
  const tabEmpty = { posts: t('profile.noPosts'), replies: t('profile.noReplies'), media: t('profile.noMedia'), likes: t('profile.noLikes') }
  const shop = await shopOf(p.id)
  const joined = p.createdAt.toLocaleDateString(locale === 'en' ? 'en-GB' : 'en-GB', { month: 'long', year: 'numeric' })
  const stat = (n: number, label: string, href: string) => (
    <Link href={href} className="hover:underline"><b className="text-foreground">{n.toLocaleString()}</b> <span className="text-muted-foreground">{label}</span></Link>
  )

  return (
    <>
      <PageHeader title={hidden && p.access !== 'blocked' ? `@${p.username}` : p.fullName} subtitle={hidden ? undefined : `@${p.username}`} back="/" />
      <div className="aspect-[3/1] w-full bg-gradient-to-br from-brand-blue via-brand-blue/85 to-brand-red/75">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.coverUrl && !hidden && !saver && <img src={p.coverUrl} alt="" loading="lazy" className="size-full object-cover" />}
      </div>
      <div className="flex items-start justify-between gap-2 px-4">
        <div className="-mt-[12%] aspect-square w-[26%] min-w-20 max-w-36 shrink-0 rounded-full border-4 border-background bg-background">
          <UserAvatar name={p.fullName} src={hidden ? null : p.avatarUrl} className="size-full text-3xl" />
        </div>
        <div className="flex items-center gap-2 pt-3">
          {p.access !== 'blocked_by' && <ProfileMenu targetId={p.id} username={p.username} muting={p.rel.muting} blocking={p.rel.blocking} followsYou={p.rel.followsYou} signedIn={!!me && !p.rel.self} favorite={favorite} />}
          {p.rel.self ? (<>
            <Link href="/favorites" className="flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold hover:bg-muted"><Star className="size-4 text-amber-500" />{t('profile.favorites')}</Link>
            <Link href="/settings/profile" className="flex h-9 items-center rounded-full border px-4 text-sm font-semibold hover:bg-muted">{t('profile.editProfile')}</Link>
          </>) : me && !hidden ? (<>
            {!p.rel.blocking && <MessageButton userId={p.id} />}
            <FollowButton targetId={p.id} followsYou={p.rel.followsYou} initial={p.rel.following ? 'following' : p.rel.requested ? 'requested' : 'none'} />
          </>
          ) : !me ? (
            <Link href={`/login?next=/u/${p.username}`} className="flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background">{t('profile.follow')}</Link>
          ) : null}
        </div>
      </div>

      {p.access === 'blocked_by' ? (
        <Notice icon={<Ban className="size-6" />} title={t('profile.blockedByNotice')} />
      ) : p.access === 'blocked' ? (
        <Notice icon={<Ban className="size-6" />} title={t('profile.blockedNotice', { username: p.username })} />
      ) : p.access === 'members_only' ? (
        <Notice icon={<Lock className="size-6" />} title={t('profile.guestTitle')} text={t('profile.guestText', { username: p.username })}
          action={<Link href={`/login?next=/u/${p.username}`} className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{t('auth.signIn')}</Link>} />
      ) : (
        <>
          <div className="px-4 pb-4 pt-3">
            <h2 className="flex items-center gap-1.5 text-xl font-bold leading-tight">
              {p.fullName}{p.verified && <VerifiedBadge label={p.verifiedLabel} />}{p.privateProfile && <Lock className="size-4 text-muted-foreground" aria-label={t('profile.private')} />}
            </h2>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              @{p.username}{p.rel.followsYou && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">{t('profile.followsYou')}</span>}
            </p>
            {p.verified && p.verifiedLabel && <p className="mt-1 text-sm font-medium text-primary">{p.verifiedLabel}</p>}
            {p.bio && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{p.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Church className="size-4" />{p.assemblyName}</span>
              <span className="flex items-center gap-1"><MapPin className="size-4" />{p.districtName}</span>
              {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-primary hover:underline"><Globe className="size-4" />{p.website.replace(/^https?:\/\//, '')}</a>}
              <span className="flex items-center gap-1"><CalendarDays className="size-4" />{t('profile.joined', { date: joined })}</span>
              {shop && <Link href={`/market/shop/${shop.slug}`} className="flex items-center gap-1 font-medium text-primary hover:underline" data-profile-shop><Store className="size-4" />{shop.name}</Link>}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {stat(p.counts.following, t('profile.followingCount'), `/u/${p.username}/following`)}
              {stat(p.counts.followers, p.counts.followers === 1 ? t('profile.followersOne') : t('profile.followers'), `/u/${p.username}/followers`)}
              {p.rel.self && p.counts.requests > 0 && <Link href="/settings/follow-requests" className="font-medium text-primary hover:underline">{t('profile.requestsLink', { n: p.counts.requests })}</Link>}
            </div>
          </div>
          {p.rel.muting && <p className="mx-4 mb-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t('profile.mutedNotice', { username: p.username })}</p>}
          {p.access === 'private' && <Notice icon={<Lock className="size-6" />} title={t('profile.privateTitle')} text={t('profile.privateText', { username: p.username })} />}
          {page && (
            <>
              <nav className="flex border-b">
                {tabs.map((k) => (
                  <Link key={k} href={k === 'posts' ? `/u/${p.username}` : `/u/${p.username}?tab=${k}`} scroll={false}
                    className={cn('relative flex-1 py-3.5 text-center text-[15px] font-medium hover:bg-muted/50', tab === k ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                    {tabLabel[k]}{tab === k && <span className="absolute inset-x-1/2 bottom-0 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />}
                  </Link>
                ))}
              </nav>
              {pinned && <PostCard post={pinned} showPinned />}
              <Feed initial={page} request={{ kind: 'profile', authorId: p.id, tab }} empty={pinned ? '' : tabEmpty[tab]} />
            </>
          )}
        </>
      )}
    </>
  )
}

function Notice({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="border-t px-8 py-14 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <p className="mt-4 text-lg font-bold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  )
}
