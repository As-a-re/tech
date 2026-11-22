import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as calls from '@/server/calls/calls'
import * as chat from '@/server/messages/chat'
import * as g from '@/server/messages/groups'
import * as rel from '@/server/social/relationships'
import { callLine, parseCallLog } from '@/lib/calls/text'
import { makeT } from '@/lib/i18n/config'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string }
let a: U, b: U, c: U
let ab: string
const t = makeT('en')
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }
const lastLog = async (conv: string, u: U) => {
  const m = (await chat.listMessages(conv, u.id))!.items.filter((x) => x.kind === 'call').at(-1)!
  return { m, log: parseCallLog(m.body)! }
}
const age = (callId: string, secs: number) => db.execute(sql`update call_participants set invited_at = now() - make_interval(secs => ${secs}), last_ping_at = now() - make_interval(secs => ${secs}) where call_id = ${callId}`)

beforeAll(async () => {
  process.env.LIVEKIT_URL = 'ws://127.0.0.1:1'; process.env.LIVEKIT_API_KEY = 'testkey'; process.env.LIVEKIT_API_SECRET = 'testsecret-testsecret-testsecret'
  await cleanup()
  a = await makeUser(921, 'zz_cama'); b = await makeUser(922, 'zz_ckofi'); c = await makeUser(923, 'zz_cesi')
  ab = await chat.directChat(a.id, b.id)
})
afterAll(async () => { await cleanup(); await pool.end() })

describe('direct calls', () => {
  it('is off until LiveKit keys are set', async () => {
    const url = process.env.LIVEKIT_URL; delete process.env.LIVEKIT_URL
    expect(await calls.startCall(a.id, ab, 'voice')).toEqual({ ok: false, error: 'unavailable' })
    process.env.LIVEKIT_URL = url
  })

  it('rings, is answered, and logs the call with its length', async () => {
    const r = ok(await calls.startCall(a.id, ab, 'voice'))
    expect(r.token.split('.')).toHaveLength(3)
    let v = (await calls.callView(r.id, b.id))!
    expect(v).toMatchObject({ status: 'ringing', myState: 'ringing', title: 'Test Member 921', media: 'voice' })
    expect((await calls.currentCall(b.id))!.id).toBe(r.id)
    expect(await calls.startCall(c.id, ab, 'voice')).toEqual({ ok: false, error: 'not_found' }) // not in the chat
    ok(await calls.joinCall(b.id, r.id))
    v = (await calls.callView(r.id, a.id))!
    expect(v.status).toBe('active')
    // Kofi is now on a call, so Esi gets "busy"
    const ce = await chat.directChat(c.id, b.id)
    expect(await calls.startCall(c.id, ce, 'video')).toEqual({ ok: false, error: 'busy' })
    expect((await lastLog(ce, c)).log.result).toBe('busy')
    await db.execute(sql`update calls set answered_at = now() - interval '75 seconds' where id = ${r.id}`)
    expect(await calls.leaveCall(b.id, r.id)).toBe(true)
    v = (await calls.callView(r.id, a.id))!
    expect(v).toMatchObject({ status: 'ended', result: 'completed' })
    const { m, log } = await lastLog(ab, a)
    expect(log.duration).toBeGreaterThanOrEqual(74)
    expect(callLine(log, t, m.mine, false)).toEqual({ title: 'Outgoing voice call', sub: '1:15', missed: false })
    expect(callLine(log, t, false, false).title).toBe('Incoming voice call')
    expect(await calls.currentCall(a.id)).toBeNull()
  })

  it('declined and cancelled calls', async () => {
    let r = ok(await calls.startCall(a.id, ab, 'video'))
    expect(await calls.declineCall(b.id, r.id)).toBe(true)
    expect((await calls.callView(r.id, a.id))!.result).toBe('declined')
    let { log } = await lastLog(ab, a)
    expect(callLine(log, t, true, false)).toMatchObject({ title: 'Outgoing video call', sub: 'Declined' })
    r = ok(await calls.startCall(a.id, ab, 'voice'))
    await calls.leaveCall(a.id, r.id)
    expect((await calls.callView(r.id, a.id))!.result).toBe('cancelled');
    ({ log } = await lastLog(ab, b))
    expect(callLine(log, t, false, false)).toMatchObject({ title: 'Missed voice call', missed: true })
  })

  it('unanswered calls become missed and count on the badge until the Calls tab is opened', async () => {
    await calls.markCallsSeen(b.id)
    await new Promise((res) => setTimeout(res, 20))
    const r = ok(await calls.startCall(a.id, ab, 'voice'))
    await age(r.id, 5)
    expect(await calls.expireCalls()).toBe(0)
    await db.execute(sql`update call_participants set invited_at = now() - interval '50 seconds' where call_id = ${r.id} and user_id = ${b.id}`)
    await calls.expireCalls()
    expect((await calls.callView(r.id, b.id))).toMatchObject({ status: 'ended', result: 'missed', myState: 'missed' })
    expect(await calls.newMissedCalls(b.id)).toBe(1)
    const hist = await calls.callHistory(b.id)
    expect(hist[0]).toMatchObject({ id: r.id, missed: true, outgoing: false, title: 'Test Member 921' })
    expect((await calls.callHistory(a.id))[0]).toMatchObject({ outgoing: true, missed: false })
    await calls.markCallsSeen(b.id)
    expect(await calls.newMissedCalls(b.id)).toBe(0)
  })

  it('a caller whose screen disappears drops out', async () => {
    const r = ok(await calls.startCall(a.id, ab, 'voice'))
    ok(await calls.joinCall(b.id, r.id))
    expect(await calls.pingCall(a.id, r.id)).toBe(true)
    await db.execute(sql`update call_participants set last_ping_at = now() - interval '60 seconds' where call_id = ${r.id} and user_id = ${a.id}`)
    await calls.expireCalls()
    expect((await calls.callView(r.id, b.id))!.status).toBe('ended')
  })
})

describe('who can call', () => {
  it('respects "Who can call me" and blocks', async () => {
    await db.insert(schema.userPreferences).values({ userId: b.id, callsFrom: 'nobody' }).onConflictDoUpdate({ target: schema.userPreferences.userId, set: { callsFrom: 'nobody' } })
    expect(await calls.startCall(a.id, ab, 'voice')).toEqual({ ok: false, error: 'not_allowed' })
    expect((await chat.chatHeader(ab, a.id))!.calls).toMatchObject({ on: true, blocked: 'not_allowed' })
    await db.update(schema.userPreferences).set({ callsFrom: 'following' }).where(eq(schema.userPreferences.userId, b.id))
    expect(await calls.startCall(a.id, ab, 'voice')).toEqual({ ok: false, error: 'not_allowed' })
    await db.insert(schema.follows).values({ followerId: b.id, followeeId: a.id }).onConflictDoNothing()
    const r = ok(await calls.startCall(a.id, ab, 'voice'))
    await calls.leaveCall(a.id, r.id)
    await db.update(schema.userPreferences).set({ callsFrom: 'everyone' }).where(eq(schema.userPreferences.userId, b.id))
    await rel.block(b.id, a.id)
    expect(await calls.startCall(a.id, ab, 'voice')).toEqual({ ok: false, error: 'blocked' })
    await rel.unblock(b.id, a.id)
  })

  it('can’t start a second call while on one', async () => {
    const r = ok(await calls.startCall(a.id, ab, 'voice'))
    const ac = await chat.directChat(a.id, c.id)
    expect(await calls.startCall(a.id, ac, 'voice')).toEqual({ ok: false, error: 'in_call' })
    await calls.leaveCall(a.id, r.id)
  })
})

describe('group calls', () => {
  it('rings everyone; others join the call going on; ends when the last person leaves', async () => {
    const grp = ok(await g.createGroup(a.id, { title: 'Call group', memberIds: [b.id, c.id] })).id
    const r = ok(await calls.startCall(a.id, grp, 'video'))
    const v = (await calls.callView(r.id, a.id))!
    expect(v.people.filter((p) => p.state === 'ringing').map((p) => p.id).sort()).toEqual([b.id, c.id].sort())
    ok(await calls.joinCall(b.id, r.id))
    // Esi missed the ring, then joins from the chat ("Join" bar)
    await db.update(schema.callParticipants).set({ state: 'missed' }).where(and(eq(schema.callParticipants.callId, r.id), eq(schema.callParticipants.userId, c.id)))
    expect((await chat.chatHeader(grp, c.id))!.calls.open).toMatchObject({ id: r.id, joined: 2 })
    const again = ok(await calls.startCall(c.id, grp, 'video'))
    expect(again.id).toBe(r.id)
    await calls.leaveCall(a.id, r.id)
    expect((await calls.callView(r.id, b.id))!.status).toBe('active') // a group call goes on without the caller
    await calls.leaveCall(b.id, r.id)
    await calls.leaveCall(c.id, r.id)
    const { m, log } = await lastLog(grp, b)
    expect(log).toMatchObject({ result: 'completed', joined: 3 })
    expect(callLine(log, t, m.mine, true).title).toBe('Group video call')
    expect((await chat.chatHeader(grp, b.id))!.calls.open).toBeNull()
  })

  it('in announcement mode only admins start calls', async () => {
    const grp = ok(await g.createGroup(a.id, { title: 'Admins only', memberIds: [b.id] })).id
    ok(await g.updateSettings(a.id, grp, { onlyAdminsSend: true }))
    expect(await calls.startCall(b.id, grp, 'voice')).toEqual({ ok: false, error: 'admins_only' })
  })
})
