import 'server-only'
import { livekitEnabled } from '@/integrations/livekit'
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { env } from '@/lib/env'
import { hit } from '@/server/identity/rate-limit'
import { containsBannedWord } from '@/server/posts/compose'
import { publish } from '@/server/notifications/realtime'
import { getPrefs } from '@/server/notifications/notify'
import { sendPush } from '@/integrations/push'
import { canMessage, membership } from './access'

export const MESSAGE_MAX = 4000
export const EDIT_MINUTES = 15
export const UNSEND_HOURS = 24
export const REACTIONS = ['❤️', '🙏🏾', '🙌', '😂', '😮', '👍'] as const
const PAGE = 40
const ONLINE_MS = 3 * 60_000

type AttachmentKind = 'image' | 'video' | 'audio' | 'file'
export type AttachmentInput = { kind: AttachmentKind; url: string; name?: string | null; size?: number | null; mime?: string | null; width?: number | null; height?: number | null; duration?: number | null }
export type SendInput = { body?: string; attachments?: AttachmentInput[]; replyToId?: string | null; clientId?: string | null; forwarded?: boolean }
export type SendError = 'admins_only' | 'empty' | 'too_long' | 'attachments' | 'not_member' | 'blocked' | 'not_allowed' | 'inactive' | 'banned_words' | 'rate_limited' | 'reply'
export type SendResult = { ok: true; message: MessageView; error?: never } | { ok: false; error: SendError }

export type Person = { id: string; username: string; fullName: string; avatarUrl: string | null; verified: boolean }
export type MessageView = {
  id: string; conversationId: string; kind: string; body: string; createdAt: string; editedAt: string | null; deleted: boolean; forwarded: boolean
  sender: Person | null; mine: boolean
  replyTo: { id: string; senderName: string; body: string; kind: string; deleted: boolean } | null
  attachments: { kind: AttachmentKind; url: string; name: string | null; size: number | null; mime: string | null; width: number | null; height: number | null; duration: number | null }[]
  reactions: { emoji: string; count: number; mine: boolean }[]
  /** For your own messages: one tick, two ticks, or blue ticks. */
  status: 'sent' | 'delivered' | 'read' | null
}

const OWN_FILE = (userId: string) => new RegExp(`^/media/(chat|posts)/${userId}/[0-9a-f-]{36}\\.(jpg|png|webp|gif|mp4|webm|mov|weba|ogg|mp3|m4a|pdf)$`)

/* ───────────── Conversations ───────────── */

export async function existingDirectChat(a: string, b: string) {
  const [c] = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.directKey, [a, b].sort().join(':')))
  return c?.id ?? null
}

/** The one direct chat between two members (created on first use). */
export async function directChat(me: string, other: string) {
  const key = [me, other].sort().join(':')
  const [found] = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.directKey, key))
  if (found) {
    // Coming back to a chat you had left / archived brings it back
    await db.update(schema.conversationMembers).set({ leftAt: null }).where(and(eq(schema.conversationMembers.conversationId, found.id), eq(schema.conversationMembers.userId, me)))
    return found.id
  }
  return db.transaction(async (tx) => {
    const [c] = await tx.insert(schema.conversations).values({ kind: 'direct', directKey: key, createdBy: me }).onConflictDoNothing().returning({ id: schema.conversations.id })
    if (!c) return (await tx.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.directKey, key)))[0].id
    await tx.insert(schema.conversationMembers).values([{ conversationId: c.id, userId: me }, { conversationId: c.id, userId: other }])
    return c.id
  })
}

export type ChatFilter = 'all' | 'unread' | 'archived'
export type ChatListItem = {
  id: string; kind: 'direct' | 'group'; title: string; avatarUrl: string | null; other: (Person & { online: boolean }) | null
  last: { body: string; kind: string; mine: boolean; deleted: boolean; at: string; status: MessageView['status']; senderName: string | null } | null
  unread: number; muted: boolean; pinned: boolean; archived: boolean
}

/** The member's chats: pinned first, then newest activity. */
export async function listChats(userId: string, filter: ChatFilter = 'all', q?: string): Promise<ChatListItem[]> {
  const term = q?.trim() ? `%${q.trim().replace(/[%_]/g, '')}%` : null
  const r = await db.execute<{
    id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; last_at: Date | null; pinned_at: Date | null; archived: boolean; muted: boolean
    o_id: string | null; o_username: string | null; o_name: string | null; o_avatar: string | null; o_verified: boolean | null; o_seen: Date | null; o_show_seen: boolean | null
    o_read: Date | null; o_delivered: Date | null; o_receipts: boolean | null; my_receipts: boolean
    m_body: string | null; m_kind: string | null; m_sender: string | null; m_sender_name: string | null; m_deleted: boolean | null; m_at: Date | null; unread: number
  }>(sql`
    select c.id, c.kind, c.title, c.avatar_url, c.last_message_at as last_at, me.pinned_at, me.archived,
      (me.muted_until is not null and me.muted_until > now()) as muted,
      o.id as o_id, o.username as o_username, o.full_name as o_name, o.avatar_url as o_avatar, o.verified_at is not null as o_verified,
      o.last_seen_at as o_seen, coalesce(op.show_last_seen, true) as o_show_seen, om.last_read_at as o_read, om.last_delivered_at as o_delivered,
      coalesce(op.read_receipts, true) as o_receipts, coalesce(mp.read_receipts, true) as my_receipts,
      lm.body as m_body, lm.kind as m_kind, lm.sender_id as m_sender, ls.full_name as m_sender_name, lm.deleted_at is not null as m_deleted, lm.created_at as m_at,
      (select count(*)::int from messages x where x.conversation_id = c.id and x.sender_id is distinct from ${userId} and x.deleted_at is null and x.kind <> 'system'
         and x.created_at > coalesce(me.last_read_at, me.joined_at - interval '1 second') and x.created_at > coalesce(me.cleared_at, 'epoch')) as unread
    from conversation_members me
    join conversations c on c.id = me.conversation_id
    left join conversation_members om on c.kind = 'direct' and om.conversation_id = c.id and om.user_id <> ${userId}
    left join users o on o.id = om.user_id
    left join user_preferences op on op.user_id = o.id
    left join user_preferences mp on mp.user_id = ${userId}
    left join lateral (select * from messages m where m.conversation_id = c.id and m.created_at > coalesce(me.cleared_at, 'epoch')
      and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = ${userId}) order by m.created_at desc limit 1) lm on true
    left join users ls on ls.id = lm.sender_id
    where me.user_id = ${userId} and me.left_at is null and c.deleted_at is null and (c.kind = 'group' or om.user_id is not null) and (c.last_message_at is not null or c.kind = 'group' or c.created_by = ${userId})
      and ${filter === 'archived' ? sql`me.archived` : sql`not me.archived`}
      ${term ? sql`and (coalesce(c.title, o.full_name) ilike ${term} or o.username ilike ${term})` : sql``}
    order by me.pinned_at desc nulls last, coalesce(c.last_message_at, c.created_at) desc
    limit 200`)
  const now = Date.now()
  const items = r.rows.map((x): ChatListItem => {
    const mine = x.m_sender === userId
    const receipts = x.o_receipts !== false && x.my_receipts
    const status: MessageView['status'] = !mine || !x.m_at ? null
      : receipts && x.o_read && x.o_read >= x.m_at ? 'read' : x.o_delivered && x.o_delivered >= x.m_at ? 'delivered' : 'sent'
    return {
      id: x.id, kind: x.kind, title: x.kind === 'direct' ? x.o_name ?? '—' : x.title ?? '—', avatarUrl: x.kind === 'direct' ? x.o_avatar : x.avatar_url,
      other: x.o_id ? { id: x.o_id, username: x.o_username!, fullName: x.o_name!, avatarUrl: x.o_avatar, verified: !!x.o_verified, online: !!x.o_show_seen && !!x.o_seen && now - new Date(x.o_seen).getTime() < ONLINE_MS } : null,
      last: x.m_at ? { body: x.m_body ?? '', kind: x.m_kind ?? 'text', mine, deleted: !!x.m_deleted, at: new Date(x.m_at).toISOString(), status, senderName: x.m_sender_name } : null,
      unread: x.unread, muted: x.muted, pinned: !!x.pinned_at, archived: x.archived,
    }
  })
  return filter === 'unread' ? items.filter((i) => i.unread > 0) : items
}

/** Chats with something unread (for the badge on the Messages icon). Muted chats don't count. */
export async function unreadChats(userId: string) {
  const r = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from conversation_members me where me.user_id = ${userId} and me.left_at is null and not me.archived
      and (me.muted_until is null or me.muted_until < now())
      and exists (select 1 from messages x where x.conversation_id = me.conversation_id and x.sender_id is distinct from ${userId} and x.deleted_at is null and x.kind <> 'system'
        and x.created_at > coalesce(me.last_read_at, me.joined_at - interval '1 second') and x.created_at > coalesce(me.cleared_at, 'epoch'))`)
  return r.rows[0]?.n ?? 0
}

export type ChatHeader = {
  id: string; kind: 'direct' | 'group'; title: string; avatarUrl: string | null
  other: (Person & { online: boolean; lastSeenAt: string | null; bio: string | null }) | null
  muted: boolean; pinned: boolean; archived: boolean; canSend: boolean; blockedReason: 'blocked' | 'not_allowed' | 'inactive' | 'admins_only' | null
  members: number
  /** Groups: first names for "Kofi is typing…", and whether I'm an admin. */
  names: Record<string, string>; isAdmin: boolean
  /** Calls: switched on (LiveKit keys set), the call going on in this chat, and why I can't call (privacy, blocks). */
  calls: { on: boolean; open: { id: string; media: 'voice' | 'video'; status: string; joined: number } | null; blocked: 'blocked' | 'not_allowed' | 'inactive' | null }
}

export async function chatHeader(conversationId: string, userId: string): Promise<ChatHeader | null> {
  const me = await membership(conversationId, userId)
  if (!me) return null
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId))
  const members = await db.$count(schema.conversationMembers, and(eq(schema.conversationMembers.conversationId, conversationId), isNull(schema.conversationMembers.leftAt)))
  let other: ChatHeader['other'] = null
  let blockedReason: ChatHeader['blockedReason'] = null
  if (c.kind === 'direct') {
    const [o] = await db.select({ u: schema.users, show: schema.userPreferences.showLastSeen }).from(schema.conversationMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.conversationMembers.userId)).leftJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.users.id))
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), sql`${schema.conversationMembers.userId} <> ${userId}`))
    if (o) {
      const [mine] = await db.select({ show: schema.userPreferences.showLastSeen }).from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId))
      // Like WhatsApp: if you hide your last seen, you can't see others' either
      const visible = (o.show ?? true) && (mine?.show ?? true)
      const seen = visible ? o.u.lastSeenAt : null
      other = { id: o.u.id, username: o.u.username, fullName: o.u.fullName, avatarUrl: o.u.avatarUrl, verified: !!o.u.verifiedAt, bio: o.u.bio,
        online: !!seen && Date.now() - seen.getTime() < ONLINE_MS, lastSeenAt: seen?.toISOString() ?? null }
      const can = await canMessage(userId, o.u.id, conversationId)
      blockedReason = can.ok ? null : ('reason' in can && can.reason === 'self' ? null : ('reason' in can && can.reason !== 'self' ? can.reason : 'not_allowed'))
    }
  }
  let names: Record<string, string> = {}
  if (c.kind === 'group') {
    if (c.onlyAdminsSend && me.role !== 'admin') blockedReason = 'admins_only'
    const people = await db.select({ id: schema.users.id, n: schema.users.fullName }).from(schema.conversationMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.conversationMembers.userId))
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), isNull(schema.conversationMembers.leftAt))).limit(1100)
    names = Object.fromEntries(people.map((p) => [p.id, p.n.split(' ')[0]]))
  }
  const { canCall, openCallIn } = await import('@/server/calls/calls')
  const callBlock = c.kind === 'direct' && other ? await canCall(userId, other.id) : { ok: true as const }
  const calls: ChatHeader['calls'] = { on: livekitEnabled(), open: await openCallIn(conversationId), blocked: callBlock.ok ? null : ('reason' in callBlock ? callBlock.reason : 'not_allowed') }
  return {
    calls,
    id: c.id, kind: c.kind, title: c.kind === 'direct' ? other?.fullName ?? '—' : c.title ?? '—', avatarUrl: c.kind === 'direct' ? other?.avatarUrl ?? null : c.avatarUrl,
    other, muted: !!me.mutedUntil && me.mutedUntil.getTime() > Date.now(), pinned: !!me.pinnedAt, archived: !!me.archivedAt,
    canSend: !blockedReason, blockedReason, members, names, isAdmin: me.role === 'admin',
  }
}

export async function setChatOption(userId: string, conversationId: string, opt: { muted?: boolean; pinned?: boolean; archived?: boolean; cleared?: boolean }) {
  const me = await membership(conversationId, userId)
  if (!me) return false
  await db.update(schema.conversationMembers).set({
    ...(opt.muted !== undefined ? { mutedUntil: opt.muted ? new Date('2999-01-01') : null } : {}),
    ...(opt.pinned !== undefined ? { pinnedAt: opt.pinned ? new Date() : null } : {}),
    ...(opt.archived !== undefined ? { archivedAt: opt.archived ? new Date() : null } : {}),
    ...(opt.cleared ? { clearedAt: new Date() } : {}),
  }).where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, userId)))
  return true
}

/* ───────────── Messages ───────────── */

async function hydrate(rows: (typeof schema.messages.$inferSelect)[], userId: string, conversationId: string): Promise<MessageView[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const senders = [...new Set(rows.map((r) => r.senderId).filter(Boolean))] as string[]
  const replyIds = [...new Set(rows.map((r) => r.replyToId).filter(Boolean))] as string[]
  const [people, atts, reacts, replies, others, myPrefs] = await Promise.all([
    senders.length ? db.select({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName, avatarUrl: schema.users.avatarUrl, verified: sql<boolean>`${schema.users.verifiedAt} is not null` })
      .from(schema.users).where(inArray(schema.users.id, senders)) : [],
    db.select().from(schema.messageAttachments).where(inArray(schema.messageAttachments.messageId, ids)),
    db.select().from(schema.messageReactions).where(inArray(schema.messageReactions.messageId, ids)),
    replyIds.length ? db.select({ id: schema.messages.id, body: schema.messages.body, kind: schema.messages.kind, deleted: sql<boolean>`${schema.messages.deletedAt} is not null`, name: schema.users.fullName })
      .from(schema.messages).leftJoin(schema.users, eq(schema.users.id, schema.messages.senderId)).where(inArray(schema.messages.id, replyIds)) : [],
    db.select({ read: schema.conversationMembers.lastReadAt, delivered: schema.conversationMembers.lastDeliveredAt, receipts: schema.userPreferences.readReceipts })
      .from(schema.conversationMembers).leftJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.conversationMembers.userId))
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), sql`${schema.conversationMembers.userId} <> ${userId}`, isNull(schema.conversationMembers.leftAt))),
    db.select({ receipts: schema.userPreferences.readReceipts }).from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)),
  ])
  const receipts = (myPrefs[0]?.receipts ?? true) && others.every((o) => o.receipts !== false)
  const byPerson = new Map<string, (typeof people)[number]>(people.map((p) => [p.id, p] as [string, (typeof people)[number]]))
  return rows.map((m) => {
    const mine = m.senderId === userId
    const deleted = !!m.deletedAt
    const status: MessageView['status'] = !mine || m.kind === 'system' ? null
      : others.length && receipts && others.every((o) => o.read && o.read >= m.createdAt) ? 'read'
        : others.length && others.every((o) => o.delivered && o.delivered >= m.createdAt) ? 'delivered' : 'sent'
    const reply = m.replyToId ? replies.find((x) => x.id === m.replyToId) : null
    const counts = new Map<string, { count: number; mine: boolean }>()
    for (const r of reacts.filter((r) => r.messageId === m.id)) {
      const c = counts.get(r.emoji) ?? { count: 0, mine: false }
      counts.set(r.emoji, { count: c.count + 1, mine: c.mine || r.userId === userId })
    }
    return {
      id: m.id, conversationId: m.conversationId, kind: m.kind, body: deleted ? '' : m.body, createdAt: m.createdAt.toISOString(), editedAt: m.editedAt?.toISOString() ?? null,
      deleted, forwarded: m.forwarded, sender: m.senderId ? byPerson.get(m.senderId) ?? null : null, mine,
      replyTo: reply ? { id: reply.id, senderName: reply.name ?? '', body: reply.deleted ? '' : reply.body.slice(0, 160), kind: reply.kind, deleted: reply.deleted } : null,
      attachments: deleted ? [] : atts.filter((a) => a.messageId === m.id).map((a) => ({ kind: a.kind as AttachmentKind, url: a.url, name: a.name, size: a.size, mime: a.mime, width: a.width, height: a.height, duration: a.duration })),
      reactions: deleted ? [] : [...counts].map(([emoji, c]) => ({ emoji, ...c })),
      status,
    }
  })
}

const visibleTo = (userId: string, me: { clearedAt: Date | null; joinedAt: Date }) => and(
  gt(schema.messages.createdAt, me.clearedAt ?? new Date(0)),
  sql`${schema.messages.createdAt} >= ${me.joinedAt.toISOString()}::timestamptz - interval '1 second'`,
  sql`not exists (select 1 from message_hidden h where h.message_id = ${schema.messages.id} and h.user_id = ${userId})`)

/** Newest messages (oldest first in the result), or older ones before a message, or newer ones after one (for live updates). */
export async function listMessages(conversationId: string, userId: string, opts: { before?: string; after?: string } = {}) {
  const me = await membership(conversationId, userId)
  if (!me) return null
  const m = schema.messages
  const where = [eq(m.conversationId, conversationId), visibleTo(userId, me)]
  // Compare in the database (microsecond times), with the id as a tie-breaker
  const at = (id: string) => sql`(select x.created_at, x.id from messages x where x.id = ${id} and x.conversation_id = ${conversationId})`
  if (opts.after && /^[0-9a-f-]{36}$/.test(opts.after)) where.push(sql`(${m.createdAt}, ${m.id}) > ${at(opts.after)}`)
  if (opts.before && /^[0-9a-f-]{36}$/.test(opts.before)) where.push(sql`(${m.createdAt}, ${m.id}) < ${at(opts.before)}`)
  const rows = opts.after
    ? await db.select().from(m).where(and(...where)).orderBy(asc(m.createdAt), asc(m.id)).limit(200)
    : (await db.select().from(m).where(and(...where)).orderBy(desc(m.createdAt), desc(m.id)).limit(PAGE + 1)).reverse()
  const hasMore = !opts.after && rows.length > PAGE
  const page = hasMore ? rows.slice(1) : rows
  return { items: await hydrate(page, userId, conversationId), hasMore }
}

/** Fresh status ticks and reactions for messages already on screen. */
export async function refreshMessages(conversationId: string, userId: string, ids: string[]) {
  const me = await membership(conversationId, userId)
  if (!me || !ids.length) return []
  const rows = await db.select().from(schema.messages).where(and(eq(schema.messages.conversationId, conversationId), inArray(schema.messages.id, ids.slice(0, 200))))
  return hydrate(rows, userId, conversationId)
}

async function membersOf(conversationId: string) {
  return db.select({ userId: schema.conversationMembers.userId, mutedUntil: schema.conversationMembers.mutedUntil }).from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, conversationId), isNull(schema.conversationMembers.leftAt)))
}

export async function tellMembers(conversationId: string, except: string | null, kind: 'message' | 'read' | 'typing') {
  for (const m of await membersOf(conversationId)) if (m.userId !== except) await publish({ userId: m.userId, kind, conversationId, by: except ?? undefined }).catch(() => {})
}

export async function sendMessage(senderId: string, conversationId: string, input: SendInput): Promise<SendResult> {
  const me = await membership(conversationId, senderId)
  if (!me) return { ok: false, error: 'not_member' }
  const body = (input.body ?? '').trim()
  const atts = input.attachments ?? []
  if (!body && !atts.length) return { ok: false, error: 'empty' }
  if (body.length > MESSAGE_MAX) return { ok: false, error: 'too_long' }
  if (atts.length > 10 || atts.some((a) => !OWN_FILE(senderId).test(a.url) || !['image', 'video', 'audio', 'file'].includes(a.kind))) return { ok: false, error: 'attachments' }
  const [c] = await db.select({ kind: schema.conversations.kind, onlyAdmins: schema.conversations.onlyAdminsSend }).from(schema.conversations).where(eq(schema.conversations.id, conversationId))
  if (c.kind === 'group' && c.onlyAdmins && me.role !== 'admin') return { ok: false, error: 'admins_only' }
  if (c.kind === 'direct') {
    const [o] = await db.select({ u: schema.conversationMembers.userId }).from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), sql`${schema.conversationMembers.userId} <> ${senderId}`))
    const can = await canMessage(senderId, o.u, conversationId)
    if (!can.ok) return { ok: false, error: 'reason' in can && can.reason !== 'self' ? can.reason : 'not_member' }
  }
  if (input.replyToId) {
    const [r] = await db.select({ c: schema.messages.conversationId }).from(schema.messages).where(eq(schema.messages.id, input.replyToId))
    if (r?.c !== conversationId) return { ok: false, error: 'reply' }
  }
  if (body && await containsBannedWord(body)) return { ok: false, error: 'banned_words' }
  if (input.clientId) {
    const [dup] = await db.select().from(schema.messages).where(and(eq(schema.messages.senderId, senderId), eq(schema.messages.clientId, input.clientId)))
    if (dup) return { ok: true, message: (await hydrate([dup], senderId, conversationId))[0] }
  }
  if (!(await hit(`msg:${senderId}`, 120, 60))) return { ok: false, error: 'rate_limited' }
  const kind = atts.length ? (atts[0].kind === 'file' ? 'file' : atts[0].kind) : 'text'
  const row = await db.transaction(async (tx) => {
    const [m] = await tx.insert(schema.messages).values({
      conversationId, senderId, kind, body, replyToId: input.replyToId ?? null, forwarded: !!input.forwarded, clientId: input.clientId?.slice(0, 64) ?? null,
    }).returning()
    if (atts.length) await tx.insert(schema.messageAttachments).values(atts.map((a) => ({
      messageId: m.id, kind: a.kind, url: a.url, name: a.name?.slice(0, 200) ?? null, size: a.size ?? null, mime: a.mime ?? null,
      width: a.width ?? null, height: a.height ?? null, duration: a.duration ? Math.round(a.duration) : null,
    })))
    await tx.update(schema.conversations).set({ lastMessageAt: m.createdAt }).where(eq(schema.conversations.id, conversationId))
    // Sending reads everything before it, and brings an archived chat back for everyone
    await tx.update(schema.conversationMembers).set({ lastReadAt: m.createdAt, lastDeliveredAt: m.createdAt }).where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, senderId)))
    await tx.update(schema.conversationMembers).set({ archived: false }).where(and(eq(schema.conversationMembers.conversationId, conversationId), isNull(schema.conversationMembers.leftAt)))
    return m
  })
  await tellMembers(conversationId, senderId, 'message')
  void pushNewMessage(conversationId, senderId, body, kind).catch((e) => console.error('push failed', e))
  return { ok: true, message: (await hydrate([row], senderId, conversationId))[0] }
}

const PREVIEW: Record<string, string> = { image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice message', file: '📄 Document' }

async function pushNewMessage(conversationId: string, senderId: string, body: string, kind: string) {
  const [c] = await db.select({ kind: schema.conversations.kind, title: schema.conversations.title }).from(schema.conversations).where(eq(schema.conversations.id, conversationId))
  const [s] = await db.select({ n: schema.users.fullName }).from(schema.users).where(eq(schema.users.id, senderId))
  for (const m of await membersOf(conversationId)) {
    if (m.userId === senderId || (m.mutedUntil && m.mutedUntil.getTime() > Date.now())) continue
    if (!(await getPrefs(m.userId)).message.push) continue
    const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, m.userId))
    for (const sub of subs) {
      const text = body || PREVIEW[kind] || ''
      const r = await sendPush(sub, { title: c.kind === 'group' ? `${c.title} · ${s?.n}` : s?.n ?? 'PAPA', body: text.slice(0, 120), url: `${env.appUrl}/messages/${conversationId}`, tag: `chat:${conversationId}` })
      if (r === 'gone') await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id))
    }
  }
}

/** Opening a chat marks it read (the sender sees blue ticks if both have read receipts on). */
export async function markRead(conversationId: string, userId: string) {
  const r = await db.update(schema.conversationMembers).set({ lastReadAt: sql`now()`, lastDeliveredAt: sql`now()` })
    .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, userId), isNull(schema.conversationMembers.leftAt)))
    .returning({ c: schema.conversationMembers.conversationId })
  if (r.length) await tellMembers(conversationId, userId, 'read')
  return r.length > 0
}

/** The member's app received new messages (double grey ticks for the senders). */
export async function markDelivered(userId: string) {
  const r = await db.execute<{ conversation_id: string }>(sql`
    update conversation_members me set last_delivered_at = now() where me.user_id = ${userId} and me.left_at is null
      and exists (select 1 from messages x where x.conversation_id = me.conversation_id and x.sender_id is distinct from ${userId}
        and x.created_at > coalesce(me.last_delivered_at, 'epoch'))
    returning conversation_id`)
  for (const row of r.rows) await tellMembers(row.conversation_id, userId, 'read')
}

export async function typing(conversationId: string, userId: string) {
  if (!(await membership(conversationId, userId))) return
  await tellMembers(conversationId, userId, 'typing')
}

export async function editMessage(userId: string, id: string, body: string) {
  const text = body.trim()
  if (!text || text.length > MESSAGE_MAX) return { ok: false as const, error: 'empty' as const }
  const r = await db.update(schema.messages).set({ body: text, editedAt: sql`now()` }).where(and(
    eq(schema.messages.id, id), eq(schema.messages.senderId, userId), isNull(schema.messages.deletedAt),
    sql`${schema.messages.createdAt} > now() - make_interval(mins => ${EDIT_MINUTES})`, sql`${schema.messages.kind} <> 'system'`))
    .returning({ c: schema.messages.conversationId })
  if (!r.length) return { ok: false as const, error: 'edit_window' as const }
  await tellMembers(r[0].c, null, 'message')
  return { ok: true as const }
}

/** Delete for everyone: your own message, within 24 hours. */
export async function unsend(userId: string, id: string) {
  const r = await db.update(schema.messages).set({ deletedAt: sql`now()` }).where(and(
    eq(schema.messages.id, id), eq(schema.messages.senderId, userId), isNull(schema.messages.deletedAt),
    sql`${schema.messages.createdAt} > now() - make_interval(hours => ${UNSEND_HOURS})`)).returning({ c: schema.messages.conversationId })
  if (!r.length) return false
  await db.delete(schema.messageReactions).where(eq(schema.messageReactions.messageId, id))
  await tellMembers(r[0].c, null, 'message')
  return true
}

/** Delete for me: hides it from your own view only. */
export async function hideForMe(userId: string, id: string) {
  const [m] = await db.select({ c: schema.messages.conversationId }).from(schema.messages).where(eq(schema.messages.id, id))
  if (!m || !(await membership(m.c, userId))) return false
  await db.insert(schema.messageHidden).values({ messageId: id, userId }).onConflictDoNothing()
  return true
}

export async function react(userId: string, id: string, emoji: string | null) {
  if (emoji && !(REACTIONS as readonly string[]).includes(emoji)) return false
  const [m] = await db.select({ c: schema.messages.conversationId, deleted: schema.messages.deletedAt }).from(schema.messages).where(eq(schema.messages.id, id))
  if (!m || m.deleted || !(await membership(m.c, userId))) return false
  if (emoji) await db.insert(schema.messageReactions).values({ messageId: id, userId, emoji }).onConflictDoUpdate({ target: [schema.messageReactions.messageId, schema.messageReactions.userId], set: { emoji, createdAt: sql`now()` } })
  else await db.delete(schema.messageReactions).where(and(eq(schema.messageReactions.messageId, id), eq(schema.messageReactions.userId, userId)))
  await tellMembers(m.c, null, 'read')
  return true
}

/** Forward a message (text and files) to other chats you're in. */
export async function forward(userId: string, id: string, conversationIds: string[]) {
  const [m] = await db.select().from(schema.messages).where(and(eq(schema.messages.id, id), isNull(schema.messages.deletedAt)))
  if (!m || !(await membership(m.conversationId, userId))) return 0
  const atts = await db.select().from(schema.messageAttachments).where(eq(schema.messageAttachments.messageId, id))
  let sent = 0
  for (const c of conversationIds.slice(0, 5)) {
    // Forwarded files keep their original address; the new chat's members get access through the new message
    const r = await sendForwarded(userId, c, m.body, atts)
    if (r) sent++
  }
  return sent
}

async function sendForwarded(userId: string, conversationId: string, body: string, atts: (typeof schema.messageAttachments.$inferSelect)[]) {
  const me = await membership(conversationId, userId)
  if (!me) return false
  const [c] = await db.select({ kind: schema.conversations.kind, onlyAdmins: schema.conversations.onlyAdminsSend }).from(schema.conversations).where(eq(schema.conversations.id, conversationId))
  if (c.kind === 'group' && c.onlyAdmins && me.role !== 'admin') return false
  if (c.kind === 'direct') {
    const [o] = await db.select({ u: schema.conversationMembers.userId }).from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), sql`${schema.conversationMembers.userId} <> ${userId}`))
    if (!(await canMessage(userId, o.u, conversationId)).ok) return false
  }
  const [m] = await db.insert(schema.messages).values({ conversationId, senderId: userId, kind: atts.length ? atts[0].kind : 'text', body, forwarded: true }).returning()
  if (atts.length) await db.insert(schema.messageAttachments).values(atts.map(({ id: _id, messageId: _m, ...a }) => ({ ...a, messageId: m.id })))
  await db.update(schema.conversations).set({ lastMessageAt: m.createdAt }).where(eq(schema.conversations.id, conversationId))
  await tellMembers(conversationId, userId, 'message')
  return true
}

/** Search the text of your chats. */
export async function searchMessages(userId: string, q: string) {
  const term = q.trim()
  if (term.length < 2) return []
  const r = await db.execute<{ id: string; conversation_id: string; body: string; created_at: Date; sender: string | null; title: string | null; kind: string; other: string | null }>(sql`
    select m.id, m.conversation_id, m.body, m.created_at, s.full_name as sender, c.title, c.kind,
      (select u.full_name from conversation_members x join users u on u.id = x.user_id where c.kind = 'direct' and x.conversation_id = c.id and x.user_id <> ${userId}) as other
    from messages m join conversation_members me on me.conversation_id = m.conversation_id and me.user_id = ${userId} and me.left_at is null
    join conversations c on c.id = m.conversation_id left join users s on s.id = m.sender_id
    where m.deleted_at is null and m.kind not in ('system', 'call') and m.body ilike ${`%${term.replace(/[%_]/g, '')}%`} and m.created_at > coalesce(me.cleared_at, 'epoch') and m.created_at >= me.joined_at - interval '1 second'
      and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = ${userId})
    order by m.created_at desc limit 50`)
  return r.rows.map((x) => ({ id: x.id, conversationId: x.conversation_id, body: x.body, at: new Date(x.created_at).toISOString(), sender: x.sender, title: x.kind === 'direct' ? x.other ?? '—' : x.title ?? '—' }))
}
