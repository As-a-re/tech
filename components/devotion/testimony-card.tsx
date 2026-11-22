'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HandHeart, MessageCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import type { TestimonyView } from '@/server/devotion/testimonies'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { MediaGrid } from '@/components/posts/media-grid'
import { RichText } from '@/components/posts/rich-text'
import { TimeAgo } from '@/components/posts/time-ago'
import { deleteTestimonyAction, praiseAction } from '@/server/actions/devotion'
import { ItemMenu } from './item-menu'

function PraiseButton({ id, initial, count, signedIn }: { id: string; initial: boolean; count: number; signedIn: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [s, setS] = useState({ on: initial, n: count })
  const [pending, start] = useTransition()
  const toggle = () => {
    if (!signedIn) return router.push(`/login?next=/testimonies/${id}`)
    const on = !s.on
    setS({ on, n: s.n + (on ? 1 : -1) })
    start(async () => { const n = await praiseAction(id, on); if (n !== null) setS({ on, n }) })
  }
  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={s.on}
      className={cn('relative z-10 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold', s.on ? 'border-amber-500 bg-amber-500 text-white' : 'hover:bg-amber-500/10 hover:text-amber-600')}>
      <Sparkles className="size-4" />{s.on ? t('testimonies.praised') : t('testimonies.praise')}{s.n > 0 && <span className="tabular-nums">· {s.n}</span>}
    </button>
  )
}

export function TestimonyCard({ x, full, signedIn, isAdmin }: { x: TestimonyView; full?: boolean; signedIn: boolean; isAdmin: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [, start] = useTransition()
  const href = `/testimonies/${x.id}`
  return (
    <article className={cn('relative border-b px-4 py-4', !full && 'hover:bg-muted/30')}>
      {!full && <Link href={href} className="absolute inset-0" aria-label={x.title} />}
      <div className="flex items-start gap-3">
        <Link href={`/u/${x.author.username}`} className="relative z-10 shrink-0"><UserAvatar name={x.author.fullName} src={x.author.avatarUrl} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-[15px]">
              <Link href={`/u/${x.author.username}`} className="relative z-10 font-bold hover:underline">{x.author.fullName}</Link>{x.author.verified && <VerifiedBadge />}
              <span className="text-sm text-muted-foreground"> · <TimeAgo iso={x.createdAt} />{x.editedAt && ` · ${t('testimonies.edited')}`}</span>
            </p>
            <div className="relative z-10">
              <ItemMenu href={href} editHref={x.viewer.isAuthor ? `${href}/edit` : undefined} canDelete={x.viewer.isAuthor || isAdmin} canReport={signedIn && !x.viewer.isAuthor}
                report={{ target: { testimonyId: x.id }, title: t('report.testimony') }}
                labels={{ delete: t('testimonies.delete'), deleteConfirm: t('testimonies.deleteConfirm'), edit: t('testimonies.edit'), report: t('testimonies.report') }}
                onDelete={() => start(async () => { if (await deleteTestimonyAction(x.id)) { toast.success(t('testimonies.deleted')); full ? router.push('/testimonies') : router.refresh() } })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{x.author.assemblyName}</p>
          <h2 className={cn('mt-2 font-bold leading-snug', full ? 'text-2xl' : 'text-[17px]')}>{x.title}</h2>
          {x.prayer && (
            <Link href={`/prayer/${x.prayer.id}`} className="relative z-10 mt-2 flex gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60">
              <HandHeart className="mt-0.5 size-4 shrink-0 text-primary" /><span className="min-w-0"><b className="block text-xs text-muted-foreground">{t('testimonies.fromPrayer')}</b><span className="line-clamp-2">{x.prayer.body}</span></span>
            </Link>
          )}
          <RichText body={x.body} className={cn('relative z-10 mt-2 whitespace-pre-wrap text-[15px] leading-relaxed', !full && 'line-clamp-5')} />
          {x.media.length > 0 && <div className="relative z-10"><MediaGrid media={x.media.map((m) => ({ ...m, id: m.url, kind: 'image' as const }))} /></div>}
          <div className="mt-3 flex items-center gap-3">
            <PraiseButton id={x.id} initial={x.viewer.praised} count={x.praiseCount} signedIn={signedIn} />
            <Link href={`${href}#encourage`} className="relative z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><MessageCircle className="size-4" />{x.commentCount}</Link>
          </div>
        </div>
      </div>
    </article>
  )
}
