'use client'

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { PollView, PostView } from '@/lib/posts/types'
import { voteAction } from '@/server/actions/posts'
import { TimeAgo } from './time-ago'
import { cn } from '@/lib/utils'

/** Vote once; results show after voting, when the poll ends, or to the author. */
export function PollBox({ postId, poll, isAuthor, signedIn, onChange }: { postId: string; poll: PollView; isAuthor: boolean; signedIn: boolean; onChange: (p: PostView) => void }) {
  const { t } = useI18n()
  const [pending, start] = useTransition()
  const showResults = poll.ended || !!poll.myVote || isAuthor || !signedIn
  const vote = (optionId: string) => start(async () => {
    const r = await voteAction(postId, optionId)
    if (r.post) onChange(r.post)
    if (r.result === 'ended') toast.error(t('post.pollEnded'))
  })
  const max = Math.max(...poll.options.map((o) => o.votes))
  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((o) => {
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0
        return showResults ? (
          <div key={o.id} className="relative overflow-hidden rounded-lg">
            <div className={cn('absolute inset-y-0 left-0 rounded-lg', o.votes === max && poll.total ? 'bg-primary/25' : 'bg-muted')} style={{ width: `${Math.max(pct, 2)}%` }} />
            <div className="relative flex justify-between px-3 py-2 text-[15px]">
              <span className={cn('flex items-center gap-1.5', o.votes === max && poll.total && 'font-semibold')}>{o.label}{poll.myVote === o.id && <Check className="size-4 text-primary" />}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
          </div>
        ) : (
          <button key={o.id} type="button" disabled={pending} onClick={() => vote(o.id)}
            className="w-full rounded-full border border-primary px-4 py-2 text-[15px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">{o.label}</button>
        )
      })}
      <p className="text-sm text-muted-foreground">
        {poll.total === 1 ? t('post.vote1') : t('post.votes', { n: poll.total.toLocaleString() })} · {poll.ended ? t('post.pollEnded') : <>{t('post.pollEnds')}<PollEnd iso={poll.endsAt} /></>}
      </p>
    </div>
  )
}

function PollEnd({ iso }: { iso: string }) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return <TimeAgo iso={iso} />
  const m = Math.round(ms / 60_000)
  return <span suppressHydrationWarning>{m < 60 ? `in ${m}m` : m < 1440 ? `in ${Math.round(m / 60)}h` : `in ${Math.round(m / 1440)}d`}</span>
}
