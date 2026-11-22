'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, requireUser } from '@/server/identity/session'
import { hit } from '@/server/identity/rate-limit'
import { audit } from '@/server/identity/audit'
import * as compose from '@/server/posts/compose'
import * as act from '@/server/posts/interactions'
import * as feeds from '@/server/posts/feeds'
import { hydrate } from '@/server/posts/hydrate'
import type { FeedPage, PostView } from '@/lib/posts/types'
import { getList, listFeed } from '@/server/discovery/lists'
import { savedFeed } from '@/server/discovery/saved'

export type ComposePayload = {
  body: string; replyToId?: string | null; quoteOfId?: string | null
  media?: compose.MediaInput[]; poll?: compose.PollInput | null
  replySetting?: 'everyone' | 'following' | 'mentioned'; publishAt?: string | null; draft?: boolean
}

export async function createPostAction(p: ComposePayload): Promise<{ ok: true; post: PostView | null; scheduled: boolean; draft: boolean; error?: never } | { ok: false; error: string }> {
  const me = await requireUser()
  if (!(await hit(`post:${me.id}`, 60, 3600))) return { ok: false, error: 'rate_limited' }
  const publishAt = p.publishAt ? new Date(p.publishAt) : null
  if (publishAt && Number.isNaN(publishAt.getTime())) return { ok: false, error: 'schedule_past' }
  const r = await compose.createPost(me.id, { ...p, publishAt })
  if (!r.ok) return { ok: false, error: String(r.error) }
  revalidatePath('/', 'layout')
  const live = !p.draft && (!publishAt || publishAt.getTime() <= Date.now())
  return { ok: true, post: live ? (await hydrate([r.id], me.id)).get(r.id) ?? null : null, scheduled: !!publishAt && !live, draft: !!p.draft }
}

export async function editPostAction(id: string, body: string) {
  const me = await requireUser()
  const r = await compose.editPost(me.id, id, body)
  if (!r.ok) return r
  revalidatePath('/', 'layout')
  return { ok: true as const, post: (await hydrate([id], me.id)).get(id) ?? null }
}

export async function deletePostAction(id: string) {
  const me = await requireUser()
  const ok = await compose.deletePost(me.id, id, me.role === 'tech_admin')
  if (ok && me.role === 'tech_admin') {
    const [p] = await hydrate([id], null, { includeDeleted: true }).then((m) => [...m.values()])
    if (p && p.author.id !== me.id) await audit('admin.post_removed', { actorId: me.id, target: id })
  }
  revalidatePath('/', 'layout')
  return ok
}

export async function publishDraftAction(id: string, publishAt?: string | null) {
  const me = await requireUser()
  const r = await compose.publishDraft(me.id, id, publishAt ? new Date(publishAt) : null)
  revalidatePath('/', 'layout')
  return r
}

export async function reactAction(id: string, kind: 'like' | 'repost' | 'bookmark', on: boolean) {
  const me = await requireUser()
  if (!(await hit(`react:${me.id}`, 600, 3600))) return { ok: false as const }
  return act.react(me.id, id, kind, on)
}

export async function voteAction(id: string, optionId: string) {
  const me = await requireUser()
  const r = await act.vote(me.id, id, optionId)
  return { result: r, post: (await hydrate([id], me.id)).get(id) ?? null }
}

export async function pinAction(id: string, on: boolean) {
  const me = await requireUser()
  const ok = await act.pin(me.id, id, on)
  revalidatePath('/', 'layout')
  return ok
}

export async function favoriteAction(userId: string, on: boolean) {
  const me = await requireUser()
  await act.setFavorite(me.id, userId, on)
  revalidatePath('/', 'layout')
}

export async function insightsAction(id: string) {
  const me = await requireUser()
  return act.insights(me.id, id)
}

export type FeedRequest =
  | { kind: 'for_you'; cursor?: string | null }
  | { kind: 'following' | 'favorites' | 'bookmarks'; cursor?: string | null }
  | { kind: 'profile'; authorId: string; tab: feeds.ProfileTab; cursor?: string | null }
  | { kind: 'hashtag'; tag: string; cursor?: string | null }
  | { kind: 'list'; listId: string; cursor?: string | null }
  | { kind: 'saved'; folder: string | null; cursor?: string | null }

/** "Show more" for every feed. */
export async function loadFeedAction(req: FeedRequest): Promise<FeedPage> {
  const me = await getCurrentUser()
  const id = me?.id ?? null
  switch (req.kind) {
    case 'for_you': return feeds.forYou(id, Number(req.cursor) || 0)
    case 'following': return id ? feeds.following(id, req.cursor) : { items: [], next: null }
    case 'favorites': return id ? feeds.favoritesFeed(id, req.cursor) : { items: [], next: null }
    case 'bookmarks': return id ? feeds.bookmarksFeed(id, req.cursor) : { items: [], next: null }
    case 'profile': return feeds.profileFeed(req.authorId, req.tab, id, req.cursor)
    case 'hashtag': return feeds.hashtagFeed(req.tag, id, req.cursor)
    case 'saved': return id ? savedFeed(id, req.folder, req.cursor) : { items: [], next: null }
    case 'list': return (await getList(req.listId, id)) ? listFeed(req.listId, id, req.cursor) : { items: [], next: null }
  }
}
