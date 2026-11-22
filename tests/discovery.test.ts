import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, like, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as compose from '@/server/posts/compose'
import * as act from '@/server/posts/interactions'
import * as rel from '@/server/social/relationships'
import { notify, setPref, unreadCount } from '@/server/notifications/notify'
import { listNotifications, markAllRead } from '@/server/notifications/list'
import * as lists from '@/server/discovery/lists'
import * as saved from '@/server/discovery/saved'
import { searchHashtags, searchPeople, searchPosts } from '@/server/discovery/search'
import { trendingTags } from '@/server/discovery/explore'
import { fileReport, listReports, resolveReports } from '@/server/moderation/reports'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string }
let a: U, b: U, c: U
const post = async (u: U, body: string) => {
  const r = await compose.createPost(u.id, { body })
  if (!r.ok) throw new Error(r.error)
  return r.id
}
const ids = (p: { items: { post: { id: string } }[] }) => p.items.map((i) => i.post.id)

beforeAll(async () => { await cleanup(); a = await makeUser(501, 'zz_dama'); b = await makeUser(502, 'zz_dkofi'); c = await makeUser(503, 'zz_desi') })
afterAll(async () => { await cleanup(); await pool.end() })

describe('notifications', () => {
  it('notifies on follow and like, groups likes, respects mutes and preferences', async () => {
    await rel.follow(b.id, a.id)
    const p = await post(a, 'Zztest notification post')
    await act.react(b.id, p, 'like', true); await act.react(c.id, p, 'like', true)
    expect(await unreadCount(a.id)).toBe(3)
    const groups = await listNotifications(a.id, 'all')
    const likeGroup = groups.find((g) => g.type === 'like')!
    expect(likeGroup.total).toBe(2)
    expect(likeGroup.actors.map((x) => x.username).sort()).toEqual(['zz_desi', 'zz_dkofi'])
    await act.react(c.id, p, 'like', false) // unlike removes it
    expect((await listNotifications(a.id, 'all')).find((g) => g.type === 'like')!.total).toBe(1)
    await markAllRead(a.id)
    expect(await unreadCount(a.id)).toBe(0)

    await setPref(a.id, 'like', 'inApp', false)
    await act.react(c.id, p, 'like', true)
    expect(await unreadCount(a.id)).toBe(0)
    await setPref(a.id, 'like', 'inApp', true)

    await rel.mute(a.id, c.id)
    await notify(a.id, 'mention', c.id, p)
    expect(await unreadCount(a.id)).toBe(0)
    await notify(a.id, 'like', a.id, p) // never about yourself
    expect(await unreadCount(a.id)).toBe(0)
  })

  it('mentions filter shows only replies, quotes and mentions', async () => {
    await post(b, 'Hello @zz_dama zztest')
    const m = await listNotifications(a.id, 'mentions')
    expect(m.length).toBeGreaterThan(0)
    expect(m.every((g) => ['reply', 'quote', 'mention'].includes(g.type))).toBe(true)
  })
})

describe('search & explore', () => {
  it('finds people, posts and hashtags', async () => {
    await post(c, 'Zzunique harvest praise #ZzHarvest')
    expect((await searchPeople('zz_dkofi', a.id)).some((u) => u.username === 'zz_dkofi')).toBe(true)
    const found = await searchPosts('zzunique', b.id)
    expect(found.items.length).toBe(1)
    expect((await searchHashtags('zzharv')).some((h) => h.tag === 'zzharvest')).toBe(true)
    expect(Array.isArray(await trendingTags(a.id))).toBe(true)
  })
})

describe('lists', () => {
  it('creates lists, manages members, shows their posts, keeps private lists private', async () => {
    expect(await lists.saveList(a.id, { name: ' ', description: '', isPrivate: false })).toEqual({ ok: false, error: 'name_required' })
    const r = await lists.saveList(a.id, { name: 'Zz choir', description: 'Leads', isPrivate: true })
    if (!r.ok) throw new Error(r.error)
    expect(await lists.setListMember(b.id, r.id, c.id, true)).toBe(false) // not the owner
    expect(await lists.setListMember(a.id, r.id, b.id, true)).toBe(true)
    const pb = await post(b, 'Zztest list post')
    expect(ids(await lists.listFeed(r.id, a.id))).toContain(pb)
    expect(await lists.getList(r.id, b.id)).toBeNull()
    expect((await lists.getList(r.id, a.id))?.members).toBe(1)
    expect((await lists.listsWithMembership(a.id, b.id)).find((x) => x.id === r.id)?.has).toBe(true)
    await lists.deleteList(a.id, r.id)
    expect(await lists.getList(r.id, a.id)).toBeNull()
  })
})

describe('saved folders', () => {
  it('files bookmarks into folders and keeps them when a folder is deleted', async () => {
    const p1 = await post(b, 'Zztest save one'), p2 = await post(b, 'Zztest save two')
    await act.react(a.id, p1, 'bookmark', true); await act.react(a.id, p2, 'bookmark', true)
    const f = await saved.createFolder(a.id, 'Zz sermons')
    expect(f).toBeTruthy()
    expect(await saved.moveBookmark(c.id, p1, f)).toBe(false) // someone else's folder
    expect(await saved.moveBookmark(a.id, p1, f)).toBe(true)
    expect(ids(await saved.savedFeed(a.id, f))).toEqual([p1])
    expect(ids(await saved.savedFeed(a.id, 'none'))).toContain(p2)
    expect(ids(await saved.savedFeed(a.id, 'none'))).not.toContain(p1)
    expect((await saved.folders(a.id))[0].items).toBe(1)
    await saved.deleteFolder(a.id, f!)
    expect(ids(await saved.savedFeed(a.id, null))).toEqual(expect.arrayContaining([p1, p2]))
  })
})

describe('reports', () => {
  it('files reports, blocks duplicates and self-reports, and resolves all reports on the same post', async () => {
    const p = await post(c, 'Zztest reported post')
    expect(await fileReport(a.id, { postId: p }, 'nonsense', '')).toEqual({ ok: false, error: 'invalid' })
    expect(await fileReport(c.id, { postId: p }, 'spam', '')).toEqual({ ok: false, error: 'self' })
    expect(await fileReport(a.id, { postId: p }, 'spam', 'buy now')).toEqual({ ok: true })
    expect(await fileReport(a.id, { postId: p }, 'spam', '')).toEqual({ ok: false, error: 'duplicate' })
    expect(await fileReport(b.id, { postId: p }, 'abuse', '')).toEqual({ ok: true })
    const open = (await listReports('open')).filter((r) => r.postId === p)
    expect(open.length).toBe(2)
    expect(open[0].sameTarget).toBe(2)
    expect(open[0].targetUsername).toBe('zz_desi')
    await resolveReports(open[0].id, a.id, 'dismissed', 'dismiss')
    expect((await listReports('open')).filter((r) => r.postId === p).length).toBe(0)
    const closed = await db.select().from(schema.reports).where(and(eq(schema.reports.postId, p), eq(schema.reports.status, 'dismissed')))
    expect(closed.length).toBe(2)
  })
})

describe('demo pack', () => {
  it('loads and clears completely without touching real members', async () => {
    const demo = await import('../scripts/demo')
    const before = await db.$count(schema.churchMembers, like(schema.churchMembers.churchId, 'DEMO-%'))
    const realPost = await post(a, 'Zztest real post survives demo clear')
    await demo.clearDemo()
    await demo.loadDemo()
    const demoUsers = await db.$count(schema.users, like(schema.users.churchId, 'DEMO-%'))
    expect(demoUsers).toBeGreaterThan(10)
    expect(await db.$count(schema.events)).toBeGreaterThan(5)
    expect(await db.$count(schema.announcements)).toBeGreaterThan(5)
    // Market: demo shops with products, orders and reviews
    expect(await db.$count(schema.shops)).toBeGreaterThanOrEqual(6)
    expect(await db.$count(schema.products)).toBeGreaterThanOrEqual(20)
    expect(await db.$count(schema.marketOrders)).toBeGreaterThanOrEqual(10)
    // real members follow the demo accounts and get follow notifications
    expect(await db.$count(schema.follows, eq(schema.follows.followerId, a.id))).toBeGreaterThanOrEqual(demoUsers)
    await demo.clearDemo()
    expect(await db.$count(schema.users, like(schema.users.churchId, 'DEMO-%'))).toBe(0)
    expect((await db.execute<{ n: number }>(sql`select count(*)::int n from shops s where s.slug in ('giftys-cakes', 'kofi-tailoring', 'yaw-tech-hub')`)).rows[0].n).toBe(0)
    expect((await db.execute<{ n: number }>(sql`select count(*)::int n from market_orders o where o.number like 'PM-D%'`)).rows[0].n).toBe(0)
    // Demo assemblies go, unless a real member belongs to one
    const left = await db.execute(sql`select count(*)::int n from assemblies a where a.external_id like 'DEMO-%'
      and not exists (select 1 from church_members m where m.assembly_id = a.id) and not exists (select 1 from users u where u.assembly_id = a.id)`)
    expect(left.rows[0].n).toBe(0)
    expect(await db.$count(schema.posts, eq(schema.posts.id, realPost))).toBe(1)
    if (before > 0) await demo.loadDemo()
    await (await import('../scripts/lib/db')).pool.end()
  }, 60_000)
})
