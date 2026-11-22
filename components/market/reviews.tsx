'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/common/user-avatar'
import { TimeAgo } from '@/components/posts/time-ago'
import { hideReviewAction, replyReviewAction } from '@/server/actions/market'
import type { ReviewView } from '@/server/market/catalog'

const StarsRow = ({ n }: { n: number }) => <span className="inline-flex text-amber-500" aria-label={`${n} / 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('size-3.5', i <= n ? 'fill-current' : 'opacity-30')} />)}</span>

/** Rating summary with bars, then the reviews (seller can reply, Tech Admins can hide). */
export function Reviews({ productId, rating, count, stars, items, isOwner, isAdmin }: {
  productId: string; rating: number | null; count: number; stars: { n: number; count: number }[]; items: ReviewView[]; isOwner: boolean; isAdmin: boolean
}) {
  const { t } = useI18n()
  const [replying, setReplying] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const reply = (id: string) => start(async () => { if (await replyReviewAction(id, text, productId)) { setReplying(null); setText(''); toast.success(t('market.admin.done')) } })
  const hide = (id: string) => start(async () => { if (await hideReviewAction(id, productId)) toast.success(t('market.admin.done')) })
  return (
    <section id="reviews" className="space-y-3 px-4 py-4" data-reviews={items.length}>
      <h2 className="text-lg font-bold">{t('market.reviews.title')}</h2>
      {count === 0 ? <p className="text-sm text-muted-foreground">{t('market.reviews.none')}</p> : (
        <div className="flex items-center gap-5 rounded-2xl border p-4">
          <div className="text-center">
            <p className="text-4xl font-black">{rating?.toFixed(1)}</p>
            <StarsRow n={Math.round(rating ?? 0)} />
            <p className="text-xs text-muted-foreground">{t('market.reviews.count', { n: count })}</p>
          </div>
          <div className="flex-1 space-y-1">
            {stars.map((s) => (
              <div key={s.n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right">{s.n}</span><Star className="size-3 fill-amber-500 text-amber-500" />
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${count ? (s.count / count) * 100 : 0}%` }} /></span>
                <span className="w-6 text-muted-foreground">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <ul className="divide-y">
        {items.map((r) => (
          <li key={r.id} className="space-y-1.5 py-3" data-review={r.rating}>
            <div className="flex items-center gap-2">
              <UserAvatar name={r.name} src={r.avatarUrl} className="size-8 text-xs" />
              <span className="min-w-0"><b className="block truncate text-sm">{r.name}{r.mine && <span className="font-normal text-muted-foreground"> · {t('market.reviews.yours')}</span>}</b>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><StarsRow n={r.rating} /> <TimeAgo iso={r.createdAt} /></span></span>
            </div>
            {r.body && <p className="whitespace-pre-line text-[15px]">{r.body}</p>}
            {r.sellerReply && <p className="rounded-xl bg-muted px-3 py-2 text-sm"><b>{t('market.reviews.reply')}:</b> {r.sellerReply}</p>}
            {isOwner && (replying === r.id ? (
              <div className="space-y-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} placeholder={t('market.reviews.replyPh')} aria-label={t('market.reviews.replyPh')} />
                <button type="button" disabled={pending || !text.trim()} onClick={() => reply(r.id)} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">{t('market.reviews.replySave')}</button>
              </div>
            ) : <button type="button" onClick={() => { setReplying(r.id); setText(r.sellerReply ?? '') }} className="text-sm font-semibold text-primary hover:underline">{t('market.reviews.replySave')}</button>)}
            {isAdmin && <button type="button" disabled={pending} onClick={() => hide(r.id)} className="ml-3 text-xs text-muted-foreground hover:text-destructive">{t('market.reviews.hide')}</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}
