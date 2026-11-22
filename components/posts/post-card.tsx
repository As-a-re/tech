'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  BarChart2, Bookmark, Heart, Link2, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Repeat2, Share, Trash2, Quote, Flag, FolderInput, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import type { PostView } from '@/lib/posts/types'
import { MAX_POST_LENGTH } from '@/lib/posts/rich-text'
import { deletePostAction, editPostAction, pinAction, reactAction } from '@/server/actions/posts'
import { ReportDialog } from '@/components/moderation/report-dialog'
import { MoveDialog } from '@/components/saved/move-dialog'
import { PickChatsDialog } from '@/components/messages/pick-chats'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { useCompose } from './compose-provider'
import { RichText } from './rich-text'
import { MediaGrid } from './media-grid'
import { PollBox } from './poll-view'
import { QuoteCard } from './quote-card'
import { FullDate, TimeAgo } from './time-ago'
import { cn } from '@/lib/utils'

const compact = (n: number) => (n < 1000 ? String(n) : n < 1e6 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}K` : `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`)

export function PostCard({ post: initial, repostedBy, variant = 'feed', onRemoved, showPinned = false }: {
  post: PostView; repostedBy?: { username: string; fullName: string } | null; variant?: 'feed' | 'detail' | 'ancestor'; onRemoved?: () => void; showPinned?: boolean
}) {
  const { t } = useI18n()
  const router = useRouter()
  const { me, openCompose } = useCompose()
  const [post, setPost] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial.body)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, start] = useTransition()
  const signedIn = !!me

  if (post.deleted) return (
    <div className={cn('px-4 py-3', variant !== 'ancestor' && 'border-b')}>
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t('post.deleted')}</p>
    </div>
  )

  const needAuth = () => { if (!signedIn) { router.push(`/login?next=/post/${post.id}`); return true } return false }
  const toggle = (kind: 'like' | 'repost' | 'bookmark') => {
    if (needAuth()) return
    const key = kind === 'like' ? 'liked' : kind === 'repost' ? 'reposted' : 'bookmarked'
    const count = kind === 'like' ? 'likes' : kind === 'repost' ? 'reposts' : 'bookmarks'
    const on = !post.viewer[key]
    const prev = post
    setPost({ ...post, viewer: { ...post.viewer, [key]: on }, counts: { ...post.counts, [count]: Math.max(0, post.counts[count] + (on ? 1 : -1)) } })
    start(async () => { const r = await reactAction(post.id, kind, on); if (!r.ok) setPost(prev) })
  }
  const share = async () => {
    const url = `${location.origin}/post/${post.id}`
    if (navigator.share) { try { await navigator.share({ url, title: t('post.shareText') }) } catch { /* cancelled */ } }
    else { await navigator.clipboard.writeText(url); toast.success(t('post.linkCopied')) }
  }
  const saveEdit = () => start(async () => {
    const r = await editPostAction(post.id, draft)
    if (!r.ok) return void toast.error(t(`compose.err.${String('error' in r ? r.error : 'unknown')}`))
    if ('post' in r && r.post) setPost(r.post)
    setEditing(false)
  })
  const remove = () => start(async () => { if (await deletePostAction(post.id)) { setPost({ ...post, deleted: true }); onRemoved?.() } })
  const togglePin = () => start(async () => { if (await pinAction(post.id, !post.pinned)) { setPost({ ...post, pinned: !post.pinned }); router.refresh() } })

  const open = (e: React.MouseEvent) => {
    if (variant === 'detail' || editing) return
    const el = e.target as HTMLElement
    if (el.closest('a,button,input,textarea,video,[role=menu],[role=dialog]') || window.getSelection()?.toString()) return
    router.push(`/post/${post.id}`)
  }
  const big = variant === 'detail'

  return (
    <article onClick={open} className={cn('relative px-4 pt-3', variant === 'feed' && 'cursor-pointer border-b pb-1 transition-colors hover:bg-muted/30', big && 'border-b pb-1', variant === 'ancestor' && 'pb-1')}>
      {(repostedBy || (post.pinned && showPinned)) && variant === 'feed' && (
        <p className="mb-1 ml-8 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          {repostedBy ? <><Repeat2 className="size-4" /><Link href={`/u/${repostedBy.username}`} className="hover:underline">{t('post.reposted', { name: repostedBy.fullName })}</Link></>
            : <><Pin className="size-3.5" />{t('post.pinned')}</>}
        </p>
      )}
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <Link href={`/u/${post.author.username}`} className="shrink-0"><UserAvatar name={post.author.fullName} src={post.author.avatarUrl} /></Link>
          {variant === 'ancestor' && <span className="mt-1 w-0.5 flex-1 bg-border" />}
        </div>
        <div className="min-w-0 flex-1 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className={cn('min-w-0', big ? 'leading-tight' : 'flex items-baseline gap-1 text-[15px]')}>
              <Link href={`/u/${post.author.username}`} className="inline-flex min-w-0 items-center gap-1 font-bold hover:underline"><span className="truncate">{post.author.fullName}</span>{post.author.verified && <VerifiedBadge />}</Link>
              <span className={cn('truncate text-muted-foreground', big ? 'block text-sm' : 'text-[15px]')}>@{post.author.username}{!big && <> · <TimeAgo iso={post.publishedAt} /></>}</span>
            </div>
            <PostMenu post={post} signedIn={signedIn} isAdmin={me?.role === 'tech_admin'} onEdit={() => { setDraft(post.body); setEditing(true) }} onDelete={() => setConfirmDelete(true)} onPin={togglePin} onCopy={async () => { await navigator.clipboard.writeText(`${location.origin}/post/${post.id}`); toast.success(t('post.linkCopied')) }} />
          </div>
          {post.replyToUsername && variant !== 'ancestor' && !big && (
            <p className="text-[15px] text-muted-foreground">{t('post.replyingTo')} <Link href={`/u/${post.replyToUsername}`} className="text-primary hover:underline">@{post.replyToUsername}</Link></p>
          )}

          {editing ? (
            <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={MAX_POST_LENGTH + 50} className="w-full rounded-xl border bg-transparent p-3 text-[15px] outline-none focus:border-primary" aria-label={t('post.edit')} />
              <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(false)}>{t('post.cancel')}</Button><Button size="sm" disabled={pending} onClick={saveEdit}>{t('post.save')}</Button></div>
            </div>
          ) : post.body && <RichText body={post.body} className={cn('mt-0.5 whitespace-pre-wrap break-words leading-relaxed', big ? 'mt-3 text-[19px]' : 'text-[15px]')} />}

          <MediaGrid media={post.media} />
          {post.poll && <PollBox postId={post.id} poll={post.poll} isAuthor={post.viewer.isAuthor} signedIn={signedIn} onChange={setPost} />}
          {post.linkPreview && !post.media.length && (
            <a href={post.linkPreview.url} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={(e) => e.stopPropagation()} className="mt-3 block overflow-hidden rounded-2xl border hover:bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {post.linkPreview.image && <img src={post.linkPreview.image} alt="" loading="lazy" className="max-h-64 w-full border-b object-cover" />}
              <span className="block px-3 py-2"><span className="block text-xs text-muted-foreground">{post.linkPreview.site}</span><span className="block truncate text-[15px] font-medium">{post.linkPreview.title}</span>
                {post.linkPreview.description && <span className="line-clamp-2 text-sm text-muted-foreground">{post.linkPreview.description}</span>}</span>
            </a>
          )}
          {post.quote && <div className="mt-3"><QuoteCard post={post.quote} /></div>}
          {post.quoteUnavailable && <p className="mt-3 rounded-xl border bg-muted/50 px-3 py-3 text-sm text-muted-foreground">{t('post.unavailable')}</p>}

          {big && (
            <p className="mt-3 border-b pb-3 text-[15px] text-muted-foreground">
              <FullDate iso={post.publishedAt} />{post.editedAt && <> · {t('post.edited')}</>} · <b className="text-foreground">{compact(post.counts.views)}</b> {t('post.views')}
            </p>
          )}
          {big && (post.counts.likes > 0 || post.counts.reposts > 0 || post.counts.quotes > 0) && (
            <p className="flex gap-4 border-b py-3 text-[15px]">
              {post.counts.reposts > 0 && <Link href={`/post/${post.id}/reposts`} className="hover:underline"><b>{post.counts.reposts}</b> <span className="text-muted-foreground">{t('post.reposts')}</span></Link>}
              {post.counts.quotes > 0 && <span><b>{post.counts.quotes}</b> <span className="text-muted-foreground">{t('post.quotes')}</span></span>}
              {post.counts.likes > 0 && <Link href={`/post/${post.id}/likes`} className="hover:underline"><b>{post.counts.likes}</b> <span className="text-muted-foreground">{t('post.likes')}</span></Link>}
            </p>
          )}
          {!big && post.editedAt && <p className="mt-1 text-xs text-muted-foreground">{t('post.edited')}</p>}

          {variant !== 'ancestor' && (
            <div className={cn('mt-1 flex items-center justify-between text-muted-foreground', big ? 'py-1' : '-ml-2 max-w-md')}>
              <Action label={t('post.reply')} count={post.counts.replies} onClick={() => { if (!needAuth() && post.viewer.canReply) openCompose({ mode: 'reply', target: post }); else if (signedIn) toast(t('post.replyLimited')) }} tone="blue"><MessageCircle className="size-[18px]" /></Action>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={post.viewer.isAuthor && !signedIn}>
                  <button type="button" aria-label={t('post.repost')} onClick={(e) => { e.stopPropagation(); if (needAuth()) e.preventDefault() }}
                    className={cn('group flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] hover:text-green-600', post.viewer.reposted && 'text-green-600')}>
                    <span className="rounded-full p-1 group-hover:bg-green-600/10"><Repeat2 className="size-[18px]" /></span>{post.counts.reposts > 0 && compact(post.counts.reposts)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                  {!post.viewer.isAuthor && <DropdownMenuItem onSelect={() => toggle('repost')}><Repeat2 />{post.viewer.reposted ? t('post.undoRepost') : t('post.repost')}</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => openCompose({ mode: 'quote', target: post })}><Quote />{t('post.quote')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Action label={post.viewer.liked ? t('post.unlike') : t('post.like')} count={post.counts.likes} active={post.viewer.liked} onClick={() => toggle('like')} tone="red">
                <Heart className={cn('size-[18px]', post.viewer.liked && 'fill-current')} />
              </Action>
              {!big && <span className="flex items-center gap-1 px-2 py-1.5 text-[13px]" title={t('post.views')}><BarChart2 className="size-[18px]" />{post.counts.views > 0 && compact(post.counts.views)}</span>}
              <span className="flex">
                <Action label={post.viewer.bookmarked ? t('post.removeBookmark') : t('post.bookmark')} active={post.viewer.bookmarked} onClick={() => toggle('bookmark')} tone="blue">
                  <Bookmark className={cn('size-[18px]', post.viewer.bookmarked && 'fill-current')} />
                </Action>
                <Action label={t('post.share')} onClick={share} tone="blue"><Share className="size-[18px]" /></Action>
              </span>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader><AlertDialogTitle>{t('post.deleteTitle')}</AlertDialogTitle><AlertDialogDescription>{t('post.deleteText')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('post.cancel')}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>{t('post.confirm')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

function Action({ label, count, active, onClick, tone, children }: { label: string; count?: number; active?: boolean; onClick: () => void; tone: 'blue' | 'red'; children: React.ReactNode }) {
  const c = tone === 'red' ? 'hover:text-brand-red' : 'hover:text-primary'
  const a = tone === 'red' ? 'text-brand-red' : 'text-primary'
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={(e) => { e.stopPropagation(); onClick() }} className={cn('group flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px]', c, active && a)}>
      <span className={cn('rounded-full p-1', tone === 'red' ? 'group-hover:bg-brand-red/10' : 'group-hover:bg-primary/10')}>{children}</span>
      {!!count && count > 0 && <span className="tabular-nums">{compact(count)}</span>}
    </button>
  )
}

function PostMenu({ post, signedIn, isAdmin, onEdit, onDelete, onPin, onCopy }: {
  post: PostView; signedIn: boolean; isAdmin: boolean; onEdit: () => void; onDelete: () => void; onPin: () => void; onCopy: () => void
}) {
  const { t } = useI18n()
  const [reporting, setReporting] = useState(false)
  const [moving, setMoving] = useState(false)
  const [sharing, setSharing] = useState(false)
  return (
    <>
    <ReportDialog target={{ postId: post.id }} title={t('report.post')} open={reporting} onOpenChange={setReporting} />
    {post.viewer.bookmarked && <MoveDialog postId={post.id} open={moving} onOpenChange={setMoving} />}
    {signedIn && sharing && <PickChatsDialog open={sharing} onOpenChange={setSharing} shareText={`${location.origin}/post/${post.id}`} />}
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t('post.more')} onClick={(e) => e.stopPropagation()} className="-mr-2 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary">
        <MoreHorizontal className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        {post.viewer.isAuthor && <>
          {!post.replyToId && <DropdownMenuItem onSelect={onPin}>{post.pinned ? <PinOff /> : <Pin />}{post.pinned ? t('post.unpin') : t('post.pin')}</DropdownMenuItem>}
          {post.viewer.canEdit && <DropdownMenuItem onSelect={onEdit}><Pencil />{t('post.edit')}</DropdownMenuItem>}
          <DropdownMenuItem asChild><Link href={`/post/${post.id}/insights`}><BarChart2 />{t('post.insights')}</Link></DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}><Trash2 />{t('post.delete')}</DropdownMenuItem>
          <DropdownMenuSeparator />
        </>}
        <DropdownMenuItem onSelect={onCopy}><Link2 />{t('post.copyLink')}</DropdownMenuItem>
        {signedIn && <DropdownMenuItem onSelect={() => setSharing(true)}><Send />{t('messages.sendTo')}</DropdownMenuItem>}
        {post.viewer.bookmarked && <DropdownMenuItem onSelect={() => setMoving(true)}><FolderInput />{t('saved.moveTo')}</DropdownMenuItem>}
        {signedIn && !post.viewer.isAuthor && <DropdownMenuItem onSelect={() => setReporting(true)}><Flag />{t('report.post')}</DropdownMenuItem>}
        {signedIn && isAdmin && !post.viewer.isAuthor && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}><Trash2 />{t('post.removeAdmin')}</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}
