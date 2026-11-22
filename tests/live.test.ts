import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as live from '@/server/live/live'
import { grantLevelRole } from '@/server/admin/roles'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin'; fullName: string }
let host: U, viewer: U, admin: U
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }
const soon = () => new Date(Date.now() + 3600_000).toISOString()

beforeAll(async () => {
  process.env.LIVEKIT_URL = 'ws://127.0.0.1:1'; process.env.LIVEKIT_API_KEY = 'testkey'; process.env.LIVEKIT_API_SECRET = 'testsecret-testsecret-testsecret'
  await cleanup()
  const mk = async (n: number, u: string, role: U['role'] = 'member') => ({ ...(await makeUser(n, u)), role, fullName: `Test Member ${n}` })
  host = await mk(941, 'zz_vhost'); viewer = await mk(942, 'zz_vview'); admin = await mk(943, 'zz_vadmin', 'tech_admin')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
})
afterAll(async () => { await db.delete(schema.lives).where(sql`title like 'ZZ %'`); await cleanup(); await pool.end() })

describe('scheduling', () => {
  it('only the media team can schedule, and links are checked', async () => {
    expect(await live.saveLive(host, { title: 'ZZ Service', level: 'national', source: 'youtube', youtubeUrl: 'https://youtu.be/abcdefghijk', scheduledAt: soon() })).toEqual({ ok: false, error: 'not_allowed' })
    ok(await grantLevelRole(admin.id, host.id, 'media_team', { level: 'national' }))
    expect(await live.saveLive(host, { title: 'ZZ Service', level: 'national', source: 'youtube', youtubeUrl: 'https://vimeo.com/1', scheduledAt: soon() })).toEqual({ ok: false, error: 'youtube' })
    expect(await live.saveLive(host, { title: '', level: 'national', source: 'studio', scheduledAt: soon() })).toEqual({ ok: false, error: 'title' })
    const url = process.env.LIVEKIT_URL; delete process.env.LIVEKIT_URL
    expect(await live.saveLive(host, { title: 'ZZ Studio', level: 'national', source: 'studio', scheduledAt: soon() })).toEqual({ ok: false, error: 'studio_off' })
    process.env.LIVEKIT_URL = url
  })
})

describe('a YouTube live', () => {
  let id: string
  it('is upcoming, members can ask to be reminded, and going live tells them', async () => {
    id = ok(await live.saveLive(host, { title: 'ZZ Sunday Service', level: 'national', source: 'youtube', youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', scheduledAt: soon() })).id
    expect((await live.listLives('live')).items.find((x) => x.id === id)).toMatchObject({ status: 'scheduled' })
    await live.setReminder(viewer.id, id, true)
    expect((await live.getLive(id, viewer))!).toMatchObject({ reminded: true, canHost: false, youtube: 'abcdefghijk' })
    expect(await live.goLive(viewer, id)).toBe(false)
    expect(await live.goLive(host, id)).toBe(true)
    expect((await live.liveNow()).map((x) => x.id)).toContain(id)
    const n = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, viewer.id))
    expect(n.some((x) => x.type === 'live' && x.liveId === id)).toBe(true)
  })

  it('counts viewers (members and guests), comments and reactions', async () => {
    await live.poll(id, `u:${viewer.id}`)
    const p = (await live.poll(id, 'g:guest-key-123456'))!
    expect(p).toMatchObject({ status: 'live', viewers: 2 })
    const c = ok(await live.postComment(viewer, id, 'Amen! 🙏🏾'))
    expect(await live.postComment(viewer, id, '   ')).toEqual({ ok: false, error: 'empty' })
    expect((await live.poll(id, 'g:guest-key-123456', null))!.comments.map((x) => x.body)).toContain('Amen! 🙏🏾')
    expect((await live.poll(id, 'g:guest-key-123456', c.comment.id))!.comments).toEqual([])
    expect(await live.react('g:guest-key-123456', id, '🔥')).toBe(true)
    expect(await live.react('g:guest-key-123456', id, '💩')).toBe(false)
    expect((await live.getLive(id, null))!.reactions['🔥']).toBe(1)
    // The host can remove a comment; it disappears for everyone
    expect(await live.removeComment(admin, c.comment.id)).toBe(true)
    expect((await live.poll(id, 'g:guest-key-123456'))!.removed).toContain(c.comment.id)
  })

  it('ends, closes the chat, and becomes a replay', async () => {
    expect(await live.endLive(viewer, id)).toBe(false)
    expect(await live.endLive(host, id)).toBe(true)
    expect(await live.postComment(viewer, id, 'late')).toEqual({ ok: false, error: 'closed' })
    expect((await live.listLives('replays')).items.map((x) => x.id)).toContain(id)
    expect((await live.getLive(id, null))!.peakViewers).toBeGreaterThanOrEqual(2)
  })
})

describe('a studio live', () => {
  it('gives the host a publishing pass and viewers a watching pass only while live', async () => {
    const id = ok(await live.saveLive(host, { title: 'ZZ Studio', level: 'national', source: 'studio', scheduledAt: soon() })).id
    expect(await live.studioPass(viewer, id)).toBeNull()
    expect((await live.studioPass(host, id))!.token.split('.')).toHaveLength(3)
    expect(await live.watchPass('g:abc123456', 'Guest', id)).toBeNull()
    await live.goLive(host, id)
    expect(await live.watchPass('g:abc123456', 'Guest', id)).not.toBeNull()
    expect(await live.hostPing(viewer, id)).toBe(false)
    // The host's studio disappeared for over 3 minutes: the live ends by itself
    await db.update(schema.liveViewers).set({ lastSeenAt: sql`now() - interval '5 minutes'` }).where(eq(schema.liveViewers.liveId, id))
    await live.expireLives()
    expect((await live.getLive(id, null))!.status).toBe('ended')
    // Adding a replay afterwards
    ok(await live.saveLive(host, { title: 'ZZ Studio', level: 'national', source: 'studio', scheduledAt: soon(), replayUrl: 'https://youtu.be/abcdefghijk' }, id))
    expect((await live.getLive(id, null))!.replayYoutube).toBe('abcdefghijk')
  })
})
