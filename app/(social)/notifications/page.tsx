import Link from 'next/link'
import { AtSign, Heart, MessageCircle, Quote, Repeat2, UserCheck, UserPlus, BarChart3, Megaphone, CalendarDays, CalendarClock, CalendarX, HandHeart, Sparkles, Cake, Phone, BookOpen, Radio, HandCoins, Shirt, Package, Store, MessageCircleQuestion, Star, BellDot, Bike, Wallet } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { requireUser } from '@/server/identity/session'
import { listNotifications, markAllRead } from '@/server/notifications/list'
import { counts } from '@/server/social/relationships'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { FullDate, TimeAgo } from '@/components/posts/time-ago'
import { LiveRefresh } from './live-refresh'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Notifications' }

const ICON = { like: [Heart, 'text-brand-red fill-current'], repost: [Repeat2, 'text-green-600'], reply: [MessageCircle, 'text-primary'], quote: [Quote, 'text-primary'],
  mention: [AtSign, 'text-primary'], follow: [UserPlus, 'text-primary'], follow_request: [UserPlus, 'text-amber-600'], follow_accept: [UserCheck, 'text-green-600'], poll_ended: [BarChart3, 'text-primary'],
  announcement: [Megaphone, 'text-brand-red'], event: [CalendarDays, 'text-primary'], event_reminder: [CalendarClock, 'text-amber-600'], event_cancelled: [CalendarX, 'text-brand-red'],
  prayed: [HandHeart, 'text-primary'], prayer_comment: [MessageCircle, 'text-primary'], prayer_answered: [Sparkles, 'text-amber-500'],
  testimony_praise: [Sparkles, 'text-amber-500'], testimony_comment: [MessageCircle, 'text-primary'], birthday: [Cake, 'text-brand-red'], message: [MessageCircle, 'text-primary'], call: [Phone, 'text-primary'], publication: [BookOpen, 'text-primary'], live: [Radio, 'text-brand-red'], payment: [HandCoins, 'text-green-600'], resource_order: [Shirt, 'text-primary'], market_order: [Package, 'text-primary'], market_sale: [Store, 'text-green-600'], market_question: [MessageCircleQuestion, 'text-primary'], market_review: [Star, 'text-amber-500'], market_alert: [BellDot, 'text-brand-red'], market_new: [Store, 'text-primary'], market_delivery: [Bike, 'text-primary'], market_payout: [Wallet, 'text-green-600'], market_rider: [Bike, 'text-primary'] } as const

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [me, t, { tab }] = await Promise.all([requireUser('/notifications'), getT(), searchParams])
  const filter = tab === 'mentions' ? 'mentions' : 'all'
  const [groups, c] = await Promise.all([listNotifications(me.id, filter), counts(me.id)])
  await markAllRead(me.id)
  return (
    <>
      <LiveRefresh />
      <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3"><h1 className="text-lg font-bold">{t('notifications.title')}</h1>
          <Link href="/settings/notifications" className="text-sm text-primary hover:underline">{t('notifications.settings')}</Link></div>
        <nav className="flex">
          {(['all', 'mentions'] as const).map((k) => (
            <Link key={k} href={k === 'all' ? '/notifications' : '/notifications?tab=mentions'} className={cn('relative flex-1 py-3.5 text-center text-[15px] font-medium hover:bg-muted/50', filter === k ? 'font-bold' : 'text-muted-foreground')}>
              {t(`notifications.${k}`)}{filter === k && <span className="absolute inset-x-1/2 bottom-0 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />}
            </Link>
          ))}
        </nav>
      </div>
      {c.requests > 0 && <Link href="/settings/follow-requests" className="flex items-center gap-3 border-b px-4 py-3 font-medium text-primary hover:bg-muted/40"><UserPlus className="size-5" />{t('profile.requestsLink', { n: c.requests })} · {t('notifications.review')}</Link>}
      {groups.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{filter === 'all' ? t('notifications.none') : t('notifications.noneMentions')}</p> : (
        <ul className="divide-y">
          {groups.map((g) => {
            const [Icon, tone] = ICON[g.type]
            const first = g.actors[0]
            const href = g.postId ? `/post/${g.postId}` : g.target ? `/${({ event: 'events', announcement: 'announcements', prayer: 'prayer', testimony: 'testimonies', publication: 'publications', live: 'live', payment: 'give/receipt', resource_order: 'resources/orders', market_order: 'market/orders', product: 'market/p' } as const)[g.target.kind]}${g.target.kind === 'resource_order' ? '' : `/${g.target.id}`}` : first ? `/u/${first.username}` : '/notifications'
            const others = g.total - 1
            return (
              <li key={g.key}>
                <Link href={href} className={cn('flex gap-3 px-4 py-3 hover:bg-muted/40', g.unread && 'bg-primary/[0.04]')}>
                  <Icon className={cn('mt-1 size-6 shrink-0', tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex -space-x-1.5">{g.actors.slice(0, 5).map((a) => <UserAvatar key={a.username} name={a.fullName} src={a.avatarUrl} className="size-8 border-2 border-background text-[10px]" />)}</div>
                    <p className="mt-1.5 text-[15px]">
                      {first && <b className="inline-flex items-center gap-0.5">{first.fullName}{first.verified && <VerifiedBadge />}</b>}
                      {others > 0 && <> {others === 1 ? t('notifications.other') : t('notifications.others', { n: others })}</>} {t(`notifications.${g.type}` as MessageKey)}
                      <span className="text-muted-foreground"> · <TimeAgo iso={g.at} /></span>
                    </p>
                    {g.postBody && <p className="mt-1 line-clamp-2 text-[15px] text-muted-foreground">{g.postBody}</p>}
                    {g.target && <p className={cn('mt-1 line-clamp-2 text-[15px]', g.target.kind !== 'prayer' && 'font-semibold')}>{g.target.title}{g.target.status && <span className="font-normal text-muted-foreground"> · {t(`market.status.${g.target.status}` as MessageKey)}</span>}{g.target.startsAt && <span className="font-normal text-muted-foreground"> · <FullDate iso={g.target.startsAt} /></span>}</p>}
                  </div>
                  {g.unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
