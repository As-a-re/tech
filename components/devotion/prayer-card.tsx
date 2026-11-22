'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, HandHeart, Lock, MessageCircle, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import type { PrayerView } from '@/server/devotion/prayer'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { TimeAgo } from '@/components/posts/time-ago'
import { deletePrayerAction, prayedAction } from '@/server/actions/devotion'
import { ItemMenu } from './item-menu'

export function PrayButton({ id, initial, count, signedIn }: { id: string; initial: boolean; count: number; signedIn: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [s, setS] = useState({ on: initial, n: count })
  const [pending, start] = useTransition()
  const toggle = () => {
    if (!signedIn) return router.push(`/login?next=/prayer/${id}`)
    const on = !s.on
    setS({ on, n: s.n + (on ? 1 : -1) })
    start(async () => { const n = await prayedAction(id, on); if (n !== null) setS({ on, n }) })
  }
  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={s.on}
      className={cn('relative z-10 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors', s.on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-primary/5 hover:text-primary')}>
      <HandHeart className="size-4" />{s.on ? t('prayer.prayed') : t('prayer.pray')}{s.n > 0 && <span className="tabular-nums opacity-90">· {s.n}</span>}
    </button>
  )
}

/** One prayer request (list item, or full on its own page). Anonymous requests show "A member of <assembly>". */
export function PrayerCard({ p, full, signedIn, isAdmin }: { p: PrayerView; full?: boolean; signedIn: boolean; isAdmin: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [, start] = useTransition()
  const href = `/prayer/${p.id}`
  return (
    <article className={cn('relative border-b px-4 py-4', !full && 'hover:bg-muted/30')}>
      {!full && <Link href={href} className="absolute inset-0" aria-label={p.body.slice(0, 80)} />}
      <div className="flex items-start gap-3">
        {p.author ? <Link href={`/u/${p.author.username}`} className="relative z-10 shrink-0"><UserAvatar name={p.author.fullName} src={p.author.avatarUrl} /></Link>
          : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-5" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-[15px]">
              {p.author && !p.anonymous ? <Link href={`/u/${p.author.username}`} className="relative z-10 font-bold hover:underline">{p.author.fullName}</Link>
                : <b>{t('prayer.someone', { assembly: p.assembly.name })}</b>}
              {p.author?.verified && !p.anonymous && <VerifiedBadge />}
              <span className="text-sm text-muted-foreground"> · <TimeAgo iso={p.createdAt} /></span>
            </p>
            <div className="relative z-10">
              <ItemMenu href={href} canDelete={p.viewer.isAuthor || isAdmin} canReport={signedIn && !p.viewer.isAuthor} report={{ target: { prayerId: p.id }, title: t('report.prayer') }}
                labels={{ delete: t('prayer.delete'), deleteConfirm: t('prayer.deleteConfirm'), report: t('prayer.report') }}
                onDelete={() => start(async () => { if (await deletePrayerAction(p.id)) { toast.success(t('prayer.deleted')); full ? router.push('/prayer') : router.refresh() } })} />
            </div>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
            {!p.anonymous && <span className="text-muted-foreground">{p.assembly.name}</span>}
            {p.anonymous && <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{t('prayer.anonymousTag')}{p.author && ` · ${p.author.fullName}`}</span>}
            {p.audience === 'assembly' && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"><Lock className="size-3" />{t('prayer.assemblyTag')}</span>}
          </div>
          <p className={cn('mt-2 whitespace-pre-wrap text-[15px] leading-relaxed', !full && 'line-clamp-5', full && 'text-[17px]')}>{p.body}</p>
          {p.answered && (
            <div className="mt-3 rounded-xl border border-green-600/30 bg-green-600/5 px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400"><CheckCircle2 className="size-4" />{t('prayer.answered')} · <TimeAgo iso={p.answered.at} /></p>
              {p.answered.note && <p className="mt-1 whitespace-pre-wrap text-[15px]">{p.answered.note}</p>}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <PrayButton id={p.id} initial={p.viewer.prayed} count={p.prayedCount} signedIn={signedIn} />
            <Link href={`${href}#encourage`} className="relative z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><MessageCircle className="size-4" />{p.commentCount > 0 ? p.commentCount : t('prayer.encourage')}</Link>
          </div>
        </div>
      </div>
    </article>
  )
}
