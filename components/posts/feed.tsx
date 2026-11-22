'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import type { FeedItem, FeedPage, PostView } from '@/lib/posts/types'
import { loadFeedAction, type FeedRequest } from '@/server/actions/posts'
import { PostCard } from './post-card'
import { POSTED_EVENT } from './composer'

/** A list of posts with "Show more". `acceptNew` puts the member's new top-level posts at the top. */
export function Feed({ initial, request, empty, acceptNew }: { initial: FeedPage; request: FeedRequest; empty: string; acceptNew?: boolean }) {
  const { t } = useI18n()
  const [items, setItems] = useState<FeedItem[]>(initial.items)
  const [next, setNext] = useState(initial.next)
  const [pending, start] = useTransition()
  useEffect(() => { setItems(initial.items); setNext(initial.next) }, [initial])
  useEffect(() => {
    if (!acceptNew) return
    const on = (e: Event) => {
      const post = (e as CustomEvent<PostView>).detail
      if (!post.replyToId) setItems((xs) => [{ key: `new:${post.id}`, post, repostedBy: null }, ...xs])
    }
    window.addEventListener(POSTED_EVENT, on)
    return () => window.removeEventListener(POSTED_EVENT, on)
  }, [acceptNew])
  const more = () => start(async () => {
    const page = await loadFeedAction({ ...request, cursor: next } as FeedRequest)
    setItems((xs) => { const have = new Set(xs.map((x) => x.key)); return [...xs, ...page.items.filter((i) => !have.has(i.key))] })
    setNext(page.next)
  })
  if (!items.length) return empty ? <p className="px-8 py-16 text-center text-[15px] text-muted-foreground">{empty}</p> : null
  return (
    <div>
      {items.map((i) => <PostCard key={i.key} post={i.post} repostedBy={i.repostedBy} showPinned={request.kind === 'profile'} />)}
      {next ? (
        <button type="button" onClick={more} disabled={pending} className="flex w-full items-center justify-center gap-2 py-5 text-[15px] font-medium text-primary hover:bg-muted/40">
          {pending && <Loader2 className="size-4 animate-spin" />}{pending ? t('feed.loading') : t('feed.showMore')}
        </button>
      ) : <p className="py-8 text-center text-sm text-muted-foreground">{t('feed.end')}</p>}
    </div>
  )
}
