import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as chat from '@/server/messages/chat'
import { canMessage, canOpenChatFile } from '@/server/messages/access'
import * as rel from '@/server/social/relationships'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string }
let a: U, b: U, c: U
let ab: string
const send = async (u: U, conv: string, body: string, extra: Partial<chat.SendInput> = {}) => {
  const r = await chat.sendMessage(u.id, conv, { body, ...extra })
  if (!r.ok) throw new Error(r.error)
  return r.message
}

beforeAll(async () => { await cleanup(); a = await makeUser(901, 'zz_mama'); b = await makeUser(902, 'zz_mkofi'); c = await makeUser(903, 'zz_mesi') })
afterAll(async () => { await cleanup(); await pool.end() })

describe('direct chats', () => {
  it('one chat per pair, hidden from lists until the first message', async () => {
    ab = await chat.directChat(a.id, b.id)
    expect(await chat.directChat(b.id, a.id)).toBe(ab)
    expect((await chat.listChats(b.id)).some((x) => x.id === ab)).toBe(false)
    const m = await send(a, ab, 'Hello Kofi')
    expect(m).toMatchObject({ mine: true, status: 'sent', body: 'Hello Kofi' })
    const list = await chat.listChats(b.id)
    expect(list.find((x) => x.id === ab)).toMatchObject({ unread: 1, title: 'Test Member 901', last: { body: 'Hello Kofi', mine: false } })
    expect(await chat.unreadChats(b.id)).toBe(1)
  })

  it('shows delivered and read ticks', async () => {
    await chat.markDelivered(b.id)
    let page = await chat.listMessages(ab, a.id)
    expect(page!.items.at(-1)!.status).toBe('delivered')
    await chat.markRead(ab, b.id)
    page = await chat.listMessages(ab, a.id)
    expect(page!.items.at(-1)!.status).toBe('read')
    expect(await chat.unreadChats(b.id)).toBe(0)
    // read receipts off on either side → never blue
    await db.insert(schema.userPreferences).values({ userId: b.id, readReceipts: false }).onConflictDoUpdate({ target: schema.userPreferences.userId, set: { readReceipts: false } })
    page = await chat.listMessages(ab, a.id)
    expect(page!.items.at(-1)!.status).toBe('delivered')
    await db.update(schema.userPreferences).set({ readReceipts: true }).where(eq(schema.userPreferences.userId, b.id))
  })

  it('replies, reactions, edits, unsend and delete-for-me', async () => {
    const q = await send(b, ab, 'Are you coming on Sunday?')
    const r = await send(a, ab, 'Yes!', { replyToId: q.id })
    expect(r.replyTo).toMatchObject({ id: q.id, body: 'Are you coming on Sunday?' })
    expect(await chat.react(a.id, q.id, '🙏🏾')).toBe(true)
    expect(await chat.react(a.id, q.id, '🤖')).toBe(false)
    expect(await chat.react(c.id, q.id, '❤️')).toBe(false) // not in the chat
    let items = (await chat.listMessages(ab, b.id))!.items
    expect(items.find((x) => x.id === q.id)!.reactions).toEqual([{ emoji: '🙏🏾', count: 1, mine: false }])
    expect((await chat.editMessage(b.id, r.id, 'hack')).ok).toBe(false)
    expect((await chat.editMessage(a.id, r.id, 'Yes, by God’s grace!')).ok).toBe(true)
    expect(await chat.unsend(b.id, r.id)).toBe(false)
    expect(await chat.unsend(a.id, r.id)).toBe(true)
    items = (await chat.listMessages(ab, b.id))!.items
    expect(items.find((x) => x.id === r.id)).toMatchObject({ deleted: true, body: '' })
    expect(await chat.hideForMe(b.id, q.id)).toBe(true)
    expect((await chat.listMessages(ab, b.id))!.items.some((x) => x.id === q.id)).toBe(false)
    expect((await chat.listMessages(ab, a.id))!.items.some((x) => x.id === q.id)).toBe(true)
  })

  it('does not send twice for the same client id, and checks input', async () => {
    const one = await chat.sendMessage(a.id, ab, { body: 'once', clientId: 'zz-1' })
    const two = await chat.sendMessage(a.id, ab, { body: 'once', clientId: 'zz-1' })
    expect(one.ok && two.ok && one.message.id === two.message.id).toBe(true)
    expect(await chat.sendMessage(a.id, ab, { body: '  ' })).toEqual({ ok: false, error: 'empty' })
    expect(await chat.sendMessage(c.id, ab, { body: 'hi' })).toEqual({ ok: false, error: 'not_member' })
    expect(await chat.sendMessage(a.id, ab, { attachments: [{ kind: 'image', url: '/media/chat/someone/x.jpg' }] })).toEqual({ ok: false, error: 'attachments' })
  })

  it('pages older messages', async () => {
    for (let i = 0; i < 45; i++) await send(a, ab, `zz page ${i}`)
    const first = (await chat.listMessages(ab, a.id))!
    expect(first.items).toHaveLength(40)
    expect(first.hasMore).toBe(true)
    const older = (await chat.listMessages(ab, a.id, { before: first.items[0].id }))!
    expect(older.items.length).toBeGreaterThan(0)
    expect(new Date(older.items.at(-1)!.createdAt) <= new Date(first.items[0].createdAt)).toBe(true)
    const newer = (await chat.listMessages(ab, a.id, { after: first.items[38].id }))!
    expect(newer.items.map((x) => x.id)).toEqual([first.items[39].id])
  })

  it('mutes, pins, archives and clears for one member only', async () => {
    await send(b, ab, 'zz before clear')
    expect(await chat.setChatOption(b.id, ab, { muted: true, pinned: true })).toBe(true)
    expect(await chat.unreadChats(b.id)).toBe(0) // muted chats don't count
    expect((await chat.listChats(b.id))[0]).toMatchObject({ id: ab, pinned: true, muted: true })
    await chat.setChatOption(b.id, ab, { archived: true })
    expect((await chat.listChats(b.id)).some((x) => x.id === ab)).toBe(false)
    expect((await chat.listChats(b.id, 'archived')).some((x) => x.id === ab)).toBe(true)
    await send(a, ab, 'zz new message brings it back')
    expect((await chat.listChats(b.id)).some((x) => x.id === ab)).toBe(true)
    await chat.setChatOption(b.id, ab, { cleared: true })
    expect((await chat.listMessages(ab, b.id))!.items).toHaveLength(0)
    expect((await chat.listMessages(ab, a.id))!.items.length).toBeGreaterThan(0)
  })

  it('searches your chats', async () => {
    const hits = await chat.searchMessages(a.id, 'page 4')
    expect(hits.length).toBeGreaterThan(0)
    expect(await chat.searchMessages(c.id, 'page 4')).toEqual([])
  })
})

describe('who can message whom', () => {
  it('respects blocks and "people I follow only"', async () => {
    expect((await canMessage(c.id, a.id)).ok).toBe(true)
    await db.insert(schema.userPreferences).values({ userId: a.id, messagesFrom: 'following' }).onConflictDoUpdate({ target: schema.userPreferences.userId, set: { messagesFrom: 'following' } })
    expect(await canMessage(c.id, a.id)).toEqual({ ok: false, reason: 'not_allowed' })
    await rel.follow(a.id, c.id)
    expect((await canMessage(c.id, a.id)).ok).toBe(true)
    await rel.block(a.id, c.id)
    expect(await canMessage(c.id, a.id)).toEqual({ ok: false, reason: 'blocked' })
    const ca = await chat.directChat(c.id, a.id)
    expect(await chat.sendMessage(c.id, ca, { body: 'hi' })).toEqual({ ok: false, error: 'blocked' })
    expect((await chat.chatHeader(ca, c.id))?.canSend).toBe(false)
    await db.update(schema.userPreferences).set({ messagesFrom: 'everyone' }).where(eq(schema.userPreferences.userId, a.id))
  })

  it('keeps chat files private to the chat', async () => {
    const url = `/media/chat/${a.id}/00000000-0000-0000-0000-000000000001.jpg`
    await send(a, ab, '', { attachments: [{ kind: 'image', url, width: 10, height: 10 }] })
    expect(await canOpenChatFile(a.id, url)).toBe(true)
    expect(await canOpenChatFile(b.id, url)).toBe(true)
    expect(await canOpenChatFile(c.id, url)).toBe(false)
  })

  it('forwards to chats you are in', async () => {
    const [m] = await db.select().from(schema.messages).where(sql`${schema.messages.body} = 'zz page 1' and ${schema.messages.conversationId} = ${ab}`)
    const bc = await chat.directChat(b.id, c.id)
    expect(await chat.forward(a.id, m.id, [bc])).toBe(0) // a isn't in b–c
    const ac2 = await chat.directChat(a.id, b.id)
    expect(await chat.forward(a.id, m.id, [ac2])).toBe(1)
    const last = (await chat.listMessages(ab, b.id))!.items.at(-1)!
    expect(last).toMatchObject({ forwarded: true, body: 'zz page 1' })
  })
})
