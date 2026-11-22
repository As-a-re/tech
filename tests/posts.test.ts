import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import { extractHashtags, extractMentions, firstUrl, segments } from '@/lib/posts/rich-text'
import { fetchLinkPreview, isPrivateAddress } from '@/integrations/link-preview'
import * as compose from '@/server/posts/compose'
import * as act from '@/server/posts/interactions'
import * as feeds from '@/server/posts/feeds'
import { hydrate } from '@/server/posts/hydrate'
import * as rel from '@/server/social/relationships'
import { updatePrivacy } from '@/server/account/account'
import { setSetting } from '@/server/admin/platform-settings'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string }
let a: U, b: U, c: U
const post = async (u: U, body: string, extra: Partial<compose.ComposeInput> = {}) => {
  const r = await compose.createPost(u.id, { body, ...extra })
  if (!r.ok) throw new Error(r.error)
  return r.id
}
const ids = (p: { items: { post: { id: string } }[] }) => p.items.map((i) => i.post.id)

beforeAll(async () => { await cleanup(); a = await makeUser(401, 'zz_ama'); b = await makeUser(402, 'zz_kofi'); c = await makeUser(403, 'zz_esi') })
afterAll(async () => { await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, 'bannedWords')); await cleanup(); await pool.end() })

describe('text', () => {
  it('finds mentions, hashtags and links', () => {
    const body = 'Thank you @Zz_Kofi for #Sunday service! See https://example.org/live. email me@x.com #Praise #praise'
    expect(extractMentions(body)).toEqual(['zz_kofi'])
    expect(extractHashtags(body)).toEqual(['sunday', 'praise'])
    expect(firstUrl(body)).toBe('https://example.org/live')
    expect(segments('a #tag b').map((s) => s.type)).toEqual(['text', 'hashtag', 'text'])
    expect(extractHashtags('Akwaaba #Ɔdɔ')).toEqual(['ɔdɔ'])
  })
})

describe('link previews', () => {
  let server: Server, base = ''
  beforeAll(async () => {
    server = createServer((_, res) => res.writeHead(200, { 'content-type': 'text/html' })
      .end('<html><head><title>Fallback</title><meta property="og:title" content="Harvest &amp; Thanksgiving"><meta property="og:description" content="Join us"><meta property="og:site_name" content="CAC"></head></html>'))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))
  it('reads Open Graph tags', async () => {
    expect(await fetchLinkPreview(`${base}/x`, { allowPrivate: true })).toMatchObject({ title: 'Harvest & Thanksgiving', description: 'Join us', site: 'CAC' })
  })
  it('refuses internal addresses', async () => {
    expect(await fetchLinkPreview(`${base}/x`)).toBeNull()
    expect(isPrivateAddress('10.0.0.5')).toBe(true)
    expect(isPrivateAddress('192.168.1.1')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
  })
})

describe('composing', () => {
  it('validates content', async () => {
    expect(await compose.createPost(a.id, { body: '  ' })).toEqual({ ok: false, error: 'empty' })
    expect(await compose.createPost(a.id, { body: 'x'.repeat(1001) })).toEqual({ ok: false, error: 'too_long' })
    expect(await compose.createPost(a.id, { body: 'hi', media: [{ url: 'https://evil.example/x.jpg', kind: 'image' }] })).toEqual({ ok: false, error: 'media_invalid' })
    const mine = (n: number, ext = 'jpg') => ({ url: `/media/posts/${a.id}/${'0'.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}.${ext}`, kind: (ext === 'mp4' ? 'video' : 'image') as 'image' | 'video' })
    expect(await compose.createPost(a.id, { body: 'x', media: [mine(1), mine(2, 'mp4')] })).toEqual({ ok: false, error: 'media_mixed' })
    expect(await compose.createPost(a.id, { body: 'x', media: [1, 2, 3, 4, 5].map((n) => mine(n)) })).toEqual({ ok: false, error: 'media_count' })
    expect(await compose.createPost(a.id, { body: 'x', poll: { options: ['Yes'], minutes: 60 } })).toEqual({ ok: false, error: 'poll_options' })
    expect(await compose.createPost(a.id, { body: 'x', poll: { options: ['Yes', 'yes'], minutes: 60 } })).toEqual({ ok: false, error: 'poll_options' })
    expect(await compose.createPost(a.id, { body: 'x', publishAt: new Date(Date.now() - 3600_000) })).toEqual({ ok: false, error: 'schedule_past' })
    const ok = await compose.createPost(a.id, { body: 'With photos', media: [mine(1), mine(2)] })
    expect(ok.ok).toBe(true)
  })

  it('blocks posts with banned words', async () => {
    await setSetting('bannedWords', ['scamword'])
    expect(await compose.createPost(a.id, { body: 'Buy now ScamWord!' })).toEqual({ ok: false, error: 'banned_words' })
    expect((await compose.createPost(a.id, { body: 'scamwords are not the word' })).ok).toBe(true)
    await setSetting('bannedWords', [])
  })

  it('indexes hashtags and mentions of real members', async () => {
    const id = await post(a, 'Blessed #Harvest with @zz_kofi and @nobody_here')
    const tags = await db.select().from(schema.postHashtags).where(eq(schema.postHashtags.postId, id))
    const ments = await db.select().from(schema.postMentions).where(eq(schema.postMentions.postId, id))
    expect(tags.map((t) => t.tag)).toEqual(['harvest'])
    expect(ments.map((m) => m.userId)).toEqual([b.id])
    expect(ids(await feeds.hashtagFeed('HARVEST', null))).toContain(id)
  })
})

describe('threads, replies and quotes', () => {
  it('counts replies and quotes and builds the thread', async () => {
    const root = await post(a, 'Root post')
    const r1 = await post(b, 'Reply one', { replyToId: root })
    const r2 = await post(c, 'Reply to reply', { replyToId: r1 })
    const q = await post(c, 'Quoting', { quoteOfId: root })
    const p = (await hydrate([root, q], a.id))
    expect(p.get(root)?.counts).toMatchObject({ replies: 1, quotes: 1 })
    expect(p.get(q)?.quote?.id).toBe(root)
    const th = await feeds.thread(r2, a.id)
    expect(th?.ancestors.map((x) => x.id)).toEqual([root, r1])
    expect((await feeds.thread(root, a.id))?.replies.map((x) => x.id)).toEqual([r1])
    expect(await compose.createPost(a.id, { body: 'x', replyToId: root, publishAt: new Date(Date.now() + 3600_000) })).toEqual({ ok: false, error: 'schedule_reply' })
  })

  it('respects "who can reply"', async () => {
    const id = await post(a, 'Only mentioned can reply @zz_esi', { replySetting: 'mentioned' })
    expect(await compose.createPost(b.id, { body: 'hi', replyToId: id })).toEqual({ ok: false, error: 'reply_not_allowed' })
    expect((await compose.createPost(c.id, { body: 'hi', replyToId: id })).ok).toBe(true)
    const f = await post(a, 'Only people I follow', { replySetting: 'following' })
    expect(await compose.createPost(b.id, { body: 'hi', replyToId: f })).toEqual({ ok: false, error: 'reply_not_allowed' })
    await rel.follow(a.id, b.id)
    expect((await compose.createPost(b.id, { body: 'hi', replyToId: f })).ok).toBe(true)
    await rel.unfollow(a.id, b.id)
  })

  it('deleting keeps replies and decrements counts', async () => {
    const root = await post(a, 'Will delete my reply')
    const r = await post(b, 'my reply', { replyToId: root })
    expect(await compose.deletePost(a.id, r)).toBe(false) // not the author
    expect(await compose.deletePost(b.id, r)).toBe(true)
    expect((await hydrate([root], a.id)).get(root)?.counts.replies).toBe(0)
    expect((await hydrate([r], a.id)).has(r)).toBe(false)
    expect((await hydrate([r], a.id, { includeDeleted: true })).get(r)?.deleted).toBe(true)
  })
})

describe('reactions, polls, pins', () => {
  it('likes, reposts and bookmarks change counts once', async () => {
    const id = await post(a, 'React to me')
    await act.react(b.id, id, 'like', true); await act.react(b.id, id, 'like', true)
    await act.react(c.id, id, 'like', true)
    await act.react(b.id, id, 'repost', true)
    expect((await act.react(a.id, id, 'repost', true)).ok).toBe(false) // can't repost yourself
    await act.react(b.id, id, 'bookmark', true)
    let p = (await hydrate([id], b.id)).get(id)!
    expect(p.counts).toMatchObject({ likes: 2, reposts: 1, bookmarks: 1 })
    expect(p.viewer).toMatchObject({ liked: true, reposted: true, bookmarked: true })
    await act.react(b.id, id, 'like', false); await act.react(b.id, id, 'like', false)
    p = (await hydrate([id], b.id)).get(id)!
    expect(p.counts.likes).toBe(1)
    expect(ids(await feeds.bookmarksFeed(b.id))).toContain(id)
  })

  it('polls: one vote each, closed after the end time', async () => {
    const id = await post(a, 'Which day?', { poll: { options: ['Saturday', 'Sunday'], minutes: 60 } })
    const p = (await hydrate([id], b.id)).get(id)!
    expect(await act.vote(b.id, id, p.poll!.options[1].id)).toBe('ok')
    expect(await act.vote(b.id, id, p.poll!.options[0].id)).toBe('already')
    expect(await act.vote(b.id, id, '00000000-0000-0000-0000-000000000000')).toBe('invalid')
    await db.update(schema.polls).set({ endsAt: sql`now() - interval '1 minute'` }).where(eq(schema.polls.postId, id))
    expect(await act.vote(c.id, id, p.poll!.options[0].id)).toBe('ended')
    const after = (await hydrate([id], b.id)).get(id)!
    expect(after.poll).toMatchObject({ total: 1, ended: true, myVote: p.poll!.options[1].id })
  })

  it('pins one post to the profile', async () => {
    const p1 = await post(a, 'Pin me'), p2 = await post(a, 'No, pin me')
    expect(await act.pin(b.id, p1, true)).toBe(false)
    await act.pin(a.id, p1, true); await act.pin(a.id, p2, true)
    expect((await feeds.pinnedPost(a.id, null))?.id).toBe(p2)
    expect(ids(await feeds.profileFeed(a.id, 'posts', null))).not.toContain(p2)
  })
})

describe('feeds and visibility', () => {
  it('Following shows followed posts and their reposts; Favorites only favorites', async () => {
    await rel.follow(c.id, b.id)
    const own = await post(b, 'Kofi posts')
    const elsewhere = await post(a, 'Ama posts')
    await act.react(b.id, elsewhere, 'repost', true)
    const f = await feeds.following(c.id)
    expect(ids(f)).toEqual(expect.arrayContaining([own, elsewhere]))
    expect(f.items.find((i) => i.post.id === elsewhere)?.repostedBy?.username).toBe('zz_kofi')
    expect(ids(await feeds.favoritesFeed(c.id))).toEqual([])
    await act.setFavorite(c.id, a.id, true)
    expect(ids(await feeds.favoritesFeed(c.id))).toContain(elsewhere)
    expect(ids(await feeds.favoritesFeed(c.id))).not.toContain(own)
  })

  it('For you hides muted and blocked people; guests never see private profiles', async () => {
    const id = await post(b, 'For you visibility check')
    expect(ids(await feeds.forYou(c.id))).toContain(id)
    await rel.mute(c.id, b.id)
    expect(ids(await feeds.forYou(c.id))).not.toContain(id)
    expect((await hydrate([id], c.id)).has(id)).toBe(true) // still opens directly
    await rel.unmute(c.id, b.id)
    await rel.block(b.id, c.id)
    expect((await hydrate([id], c.id)).has(id)).toBe(false)
    await rel.unblock(b.id, c.id)
    expect((await rel.relationship(c.id, b.id)).following).toBe(false) // blocking removed the follow
    await rel.follow(c.id, b.id)
    await updatePrivacy(b.id, { privateProfile: true })
    expect((await hydrate([id], null)).has(id)).toBe(false)
    expect((await hydrate([id], a.id)).has(id)).toBe(false)
    expect((await hydrate([id], c.id)).has(id)).toBe(true) // followers still see it
    await updatePrivacy(b.id, { privateProfile: false })
  })

  it('profile tabs: replies, media, and private likes', async () => {
    const root = await post(c, 'Esi root')
    const rep = await post(a, 'Ama reply', { replyToId: root })
    const liked = await post(c, 'Like target')
    await act.react(a.id, liked, 'like', true)
    expect(ids(await feeds.profileFeed(a.id, 'replies', null))).toContain(rep)
    expect(ids(await feeds.profileFeed(a.id, 'posts', null))).not.toContain(rep)
    expect(ids(await feeds.profileFeed(a.id, 'likes', a.id))).toContain(liked)
    expect(ids(await feeds.profileFeed(a.id, 'likes', b.id))).toEqual([])
    expect(ids(await feeds.profileFeed(a.id, 'media', a.id)).length).toBeGreaterThanOrEqual(1)
  })
})

describe('drafts, scheduling and editing', () => {
  it('drafts and scheduled posts stay hidden until published', async () => {
    const d = await post(a, 'My draft', { draft: true })
    const s = await post(a, 'Scheduled', { publishAt: new Date(Date.now() + 3600_000) })
    expect((await hydrate([d, s], b.id)).size).toBe(0)
    expect((await compose.listPending(a.id)).map((x) => x.id)).toEqual([d, s])
    await db.update(schema.posts).set({ publishedAt: sql`now() - interval '1 second'` }).where(eq(schema.posts.id, s))
    expect((await hydrate([s], b.id)).has(s)).toBe(true) // scheduled time passed: visible with no background job
    expect((await compose.publishDraft(a.id, d)).ok).toBe(true)
    expect((await hydrate([d], b.id)).has(d)).toBe(true)
  })

  it('edits within 30 minutes and keeps the earlier text', async () => {
    const id = await post(a, 'Original text')
    expect(await compose.editPost(b.id, id, 'hack')).toEqual({ ok: false, error: 'not_found' })
    expect(await compose.editPost(a.id, id, 'Corrected text #fixed')).toEqual({ ok: true, id })
    const p = (await hydrate([id], a.id)).get(id)!
    expect(p.body).toBe('Corrected text #fixed')
    expect(p.editedAt).not.toBeNull()
    expect((await db.select().from(schema.postEdits).where(eq(schema.postEdits.postId, id)))[0].body).toBe('Original text')
    await db.update(schema.posts).set({ publishedAt: sql`now() - interval '31 minutes'` }).where(eq(schema.posts.id, id))
    expect(await compose.editPost(a.id, id, 'Too late')).toEqual({ ok: false, error: 'edit_window' })
  })

  it('reports insights to the author only', async () => {
    const id = await post(a, 'Insightful')
    await feeds.thread(id, b.id)
    await act.react(b.id, id, 'like', true)
    expect(await act.insights(b.id, id)).toBeNull()
    expect(await act.insights(a.id, id)).toMatchObject({ views: 1, likes: 1, engagements: 1, rate: 100 })
  })
})
