import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as chat from '@/server/messages/chat'
import * as g from '@/server/messages/groups'
import * as rel from '@/server/social/relationships'
import { fileReport } from '@/server/moderation/reports'
import { systemText } from '@/lib/messages/system'
import { makeT } from '@/lib/i18n/config'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string }
let a: U, b: U, c: U, d: U
let gid: string
const t = makeT('en')
const lastSystem = async (id: string, u: U) => {
  const page = await chat.listMessages(id, u.id)
  const m = page!.items.filter((x) => x.kind === 'system').at(-1)!
  return systemText(m.body, t)
}
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }

beforeAll(async () => {
  await cleanup()
  a = await makeUser(911, 'zz_gama'); b = await makeUser(912, 'zz_gkofi'); c = await makeUser(913, 'zz_gesi'); d = await makeUser(914, 'zz_gyaw')
})
afterAll(async () => { await cleanup(); await pool.end() })

describe('creating and running a group', () => {
  it('checks the name and makes the creator admin', async () => {
    expect(await g.createGroup(a.id, { title: ' ' })).toEqual({ ok: false, error: 'title' })
    expect(await g.createGroup(a.id, { title: 'x'.repeat(61) })).toEqual({ ok: false, error: 'title' })
    expect(await g.createGroup(a.id, { title: 'Choir', avatarUrl: '/media/chat/x.jpg' })).toEqual({ ok: false, error: 'photo' })
    const r = ok(await g.createGroup(a.id, { title: 'Bethel Choir', description: 'Practice on Thursdays', memberIds: [b.id, c.id] }))
    gid = r.id
    expect(r.skipped).toBe(0)
    const info = (await g.groupInfo(gid, a.id))!
    expect(info).toMatchObject({ title: 'Bethel Choir', memberCount: 3, visibility: 'private', me: { isAdmin: true, canEdit: true, canAdd: true } })
    expect(info.members[0]).toMatchObject({ id: a.id, role: 'admin', isCreator: true })
    expect(await lastSystem(gid, a)).toBe('Test Member 911 added Test Member 912, Test Member 913')
    // Each reader sees themselves as "you"
    const body = (await chat.listMessages(gid, b.id))!.items.filter((m) => m.kind === 'system').at(-1)!.body
    expect(systemText(body, t, a.id)).toBe('You added Test Member 912, Test Member 913')
    expect(systemText(body, t, b.id)).toBe('Test Member 911 added you, Test Member 913')
  })

  it('shows in everyone’s chats; system notes are not unread', async () => {
    const list = await chat.listChats(b.id)
    const item = list.find((x) => x.id === gid)!
    expect(item).toMatchObject({ kind: 'group', title: 'Bethel Choir', unread: 0 })
    expect(item.last?.kind).toBe('system')
  })

  it('respects privacy when adding people', async () => {
    await db.insert(schema.userPreferences).values({ userId: d.id, messagesFrom: 'following' }).onConflictDoUpdate({ target: schema.userPreferences.userId, set: { messagesFrom: 'following' } })
    expect(ok(await g.addMembers(a.id, gid, [d.id]))).toMatchObject({ added: 0, skipped: 1 })
    await db.update(schema.userPreferences).set({ messagesFrom: 'everyone' }).where(eq(schema.userPreferences.userId, d.id))
    await rel.block(d.id, a.id)
    expect(ok(await g.addMembers(a.id, gid, [d.id]))).toMatchObject({ added: 0, skipped: 1 })
    await rel.unblock(d.id, a.id)
  })

  it('members can’t change settings or add people unless allowed', async () => {
    expect(await g.updateSettings(b.id, gid, { onlyAdminsSend: true })).toEqual({ ok: false, error: 'not_admin' })
    expect(await g.addMembers(b.id, gid, [d.id])).toEqual({ ok: false, error: 'not_admin' })
    expect(await g.updateGroup(b.id, gid, { title: 'Mine now' })).toEqual({ ok: false, error: 'not_admin' })
    ok(await g.updateSettings(a.id, gid, { membersCanAdd: true, onlyAdminsEdit: false }))
    expect(ok(await g.addMembers(b.id, gid, [d.id])).added).toBe(1)
    ok(await g.updateGroup(b.id, gid, { title: 'Bethel Choir (Accra)' }))
    expect(await lastSystem(gid, a)).toBe('Test Member 912 renamed the group to “Bethel Choir (Accra)”')
  })

  it('a new member does not see older messages', async () => {
    const r = await chat.sendMessage(a.id, gid, { body: 'Before Esi?' })
    expect(r.ok).toBe(true)
    ok(await g.removeMember(a.id, gid, c.id))
    expect(await chat.listMessages(gid, c.id)).toBeNull()
    ok(await g.addMembers(a.id, gid, [c.id]))
    const page = await chat.listMessages(gid, c.id)
    expect(page!.items.some((m) => m.body === 'Before Esi?')).toBe(false)
  })

  it('announcement mode: only admins send', async () => {
    ok(await g.updateSettings(a.id, gid, { onlyAdminsSend: true }))
    expect(await chat.sendMessage(b.id, gid, { body: 'Hi' })).toEqual({ ok: false, error: 'admins_only' })
    expect((await chat.chatHeader(gid, b.id))!.blockedReason).toBe('admins_only')
    expect((await chat.sendMessage(a.id, gid, { body: 'Rehearsal at 6' })).ok).toBe(true)
    ok(await g.setAdmin(a.id, gid, b.id, true))
    expect((await chat.sendMessage(b.id, gid, { body: 'Noted' })).ok).toBe(true)
    expect((await chat.chatHeader(gid, a.id))!.names[b.id]).toBe('Test')
    ok(await g.updateSettings(a.id, gid, { onlyAdminsSend: false }))
  })

  it('the creator can’t be removed by another admin; the last admin can’t step down', async () => {
    expect(await g.removeMember(b.id, gid, a.id)).toEqual({ ok: false, error: 'creator' })
    ok(await g.setAdmin(a.id, gid, b.id, false))
    expect(await g.setAdmin(a.id, gid, a.id, false)).toEqual({ ok: false, error: 'last_admin' })
  })
})

describe('invite links, joining and requests', () => {
  it('joins by link; a reset link stops the old one', async () => {
    const info = (await g.groupInfo(gid, a.id))!
    const code = info.inviteCode!
    expect(await g.groupByInvite(code)).toBe(gid)
    ok(await g.removeMember(a.id, gid, d.id))
    expect((await g.groupInfo(gid, d.id))).toBeNull()
    expect((await g.groupInfo(gid, d.id, { invite: true }))!.me.isMember).toBe(false)
    expect(ok(await g.joinGroup(d.id, gid, 'link')).status).toBe('joined')
    expect(await lastSystem(gid, a)).toBe('Test Member 914 joined using the invite link')
    const fresh = ok(await g.resetInvite(a.id, gid)).code
    expect(fresh).not.toBe(code)
    expect(await g.groupByInvite(code)).toBeNull()
  })

  it('private groups can’t be joined from Discover; public ones can', async () => {
    ok(await g.leaveGroup(d.id, gid))
    expect(await g.joinGroup(d.id, gid, 'discover')).toEqual({ ok: false, error: 'not_allowed' })
    ok(await g.updateSettings(a.id, gid, { visibility: 'public' }))
    expect((await g.discoverGroups(d.id, 'bethel')).items.map((x) => x.id)).toContain(gid)
    expect(ok(await g.joinGroup(d.id, gid, 'discover')).status).toBe('joined')
  })

  it('approval: requests wait for an admin', async () => {
    ok(await g.leaveGroup(d.id, gid))
    ok(await g.updateSettings(a.id, gid, { approveJoins: true }))
    expect(ok(await g.joinGroup(d.id, gid, 'discover')).status).toBe('requested')
    expect((await g.groupInfo(gid, a.id))!.requests.map((r) => r.id)).toEqual([d.id])
    expect((await g.groupInfo(gid, d.id))!.me.requested).toBe(true)
    expect(await g.answerRequest(b.id, gid, d.id, true)).toEqual({ ok: false, error: 'not_admin' })
    ok(await g.answerRequest(a.id, gid, d.id, true))
    expect((await g.groupInfo(gid, d.id))!.me.isMember).toBe(true)
    expect(await lastSystem(gid, a)).toBe('Test Member 911 let Test Member 914 in')
  })

  it('blocked people can’t join', async () => {
    ok(await g.leaveGroup(d.id, gid))
    ok(await g.updateSettings(a.id, gid, { approveJoins: false }))
    await rel.block(a.id, d.id)
    expect(await g.joinGroup(d.id, gid, 'discover')).toEqual({ ok: false, error: 'blocked' })
    await rel.unblock(a.id, d.id)
  })
})

describe('leaving, reports and closing', () => {
  it('when the last admin leaves, the longest-serving member becomes admin', async () => {
    ok(await g.leaveGroup(a.id, gid))
    const info = (await g.groupInfo(gid, b.id))!
    expect(info.members.find((m) => m.id === b.id)!.role).toBe('admin')
    expect((await chat.listChats(a.id)).some((x) => x.id === gid)).toBe(false)
  })

  it('members can report the group', async () => {
    expect(await fileReport(c.id, { conversationId: gid }, 'spam', '')).toEqual({ ok: true })
    expect(await fileReport(c.id, { conversationId: gid }, 'spam', '')).toEqual({ ok: false, error: 'duplicate' })
  })

  it('a closed group disappears for everyone', async () => {
    expect(await g.closeGroup(gid)).toBe(true)
    expect((await chat.listChats(b.id)).some((x) => x.id === gid)).toBe(false)
    expect(await chat.sendMessage(b.id, gid, { body: 'hello?' })).toMatchObject({ ok: false })
    expect(await g.groupInfo(gid, b.id)).toBeNull()
  })

  it('an empty group closes itself', async () => {
    const r = ok(await g.createGroup(c.id, { title: 'Just me' }))
    ok(await g.leaveGroup(c.id, r.id))
    const [row] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, r.id))
    expect(row.deletedAt).not.toBeNull()
  })
})
