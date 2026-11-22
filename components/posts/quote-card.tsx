'use client'

import Link from 'next/link'
import type { PostView } from '@/lib/posts/types'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { TimeAgo } from './time-ago'

/** Compact embedded post (quotes). */
export function QuoteCard({ post }: { post: PostView }) {
  const first = post.media[0]
  return (
    <Link href={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} className="block overflow-hidden rounded-2xl border transition-colors hover:bg-muted/40">
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-sm">
          <UserAvatar name={post.author.fullName} src={post.author.avatarUrl} className="size-5 text-[9px]" />
          <span className="truncate font-semibold">{post.author.fullName}</span>{post.author.verified && <VerifiedBadge />}
          <span className="truncate text-muted-foreground">@{post.author.username} · <TimeAgo iso={post.publishedAt} /></span>
        </div>
        {/* plain text: the whole card is already a link, and links can't contain links */}
        {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-snug">{post.body.length > 280 ? post.body.slice(0, 280) + '…' : post.body}</p>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {first?.kind === 'image' && <img src={first.url} alt={first.alt ?? ''} loading="lazy" className="max-h-60 w-full border-t object-cover" />}
    </Link>
  )
}
