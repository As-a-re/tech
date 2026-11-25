import 'server-only'
import { livekitEnabled } from '@/integrations/livekit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
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
const db = () => createSupabaseAdminClient()
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  kind: string
  body: string
  reply_to_id: string | null
  forwarded: boolean
  client_id: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

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
  const { data, error } = await db().from('conversations').select('id').eq('direct_key', [a, b].sort().join(':')).maybeSingle()
  fail(error)
  return data?.id ?? null
}

/** The one direct chat between two members (created on first use). */
export async function directChat(me: string, other: string) {
  const { data, error } = await db().rpc('papa_direct_chat', { p_me: me, p_other: other })
  fail(error)
  if (!data) throw new Error('Unable to create direct conversation')
  return data as string
}

export type ChatFilter = 'all' | 'unread' | 'archived'
export type ChatListItem = {
  id: string; kind: 'direct' | 'group'; title: string; avatarUrl: string | null; other: (Person & { online: boolean }) | null
  last: { body: string; kind: string; mine: boolean; deleted: boolean; at: string; status: MessageView['status']; senderName: string | null } | null
  unread: number; muted: boolean; pinned: boolean; archived: boolean
}

/** The member's chats: pinned first, then newest activity. */
export async function listChats(userId: string, filter: ChatFilter = 'all', q?: string): Promise<ChatListItem[]> {
  const { data, error } = await db().rpc('papa_list_chats', { p_user_id: userId, p_filter: filter, p_query: q?.trim() || null })
  fail(error)
  const rows = (data ?? []) as {
    id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; last_at: string | null; pinned_at: string | null; archived: boolean; muted: boolean
    o_id: string | null; o_username: string | null; o_name: string | null; o_avatar: string | null; o_verified: boolean | null; o_seen: string | null; o_show_seen: boolean | null
    o_read: string | null; o_delivered: string | null; o_receipts: boolean | null; my_receipts: boolean
    m_body: string | null; m_kind: string | null; m_sender: string | null; m_sender_name: string | null; m_deleted: boolean | null; m_at: string | null; unread: number
  }[]
  const now = Date.now()
  const items = rows.map((x): ChatListItem => {
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
  const { data, error } = await db().rpc('papa_unread_chats', { p_user_id: userId })
  fail(error)
  return Number(data ?? 0)
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
  const client = db()
  const { data: c, error: conversationError } = await client.from('conversations').select('*').eq('id', conversationId).maybeSingle()
  fail(conversationError)
  if (!c) return null
  const { count, error: countError } = await client.from('conversation_members').select('user_id', { count: 'exact', head: true }).eq('conversation_id', conversationId).is('left_at', null)
  fail(countError)
  const members = count ?? 0
  let other: ChatHeader['other'] = null
  let blockedReason: ChatHeader['blockedReason'] = null
  if (c.kind === 'direct') {
    const { data: otherMember, error: otherMemberError } = await client.from('conversation_members').select('user_id').eq('conversation_id', conversationId).neq('user_id', userId).maybeSingle()
    fail(otherMemberError)
    if (otherMember) {
      const [{ data: profile, error: profileError }, { data: otherPrefs, error: otherPrefsError }, { data: myPrefs, error: myPrefsError }] = await Promise.all([
        client.from('users').select('id,username,full_name,avatar_url,verified_at,last_seen_at,bio').eq('id', otherMember.user_id).maybeSingle(),
        client.from('user_preferences').select('show_last_seen').eq('user_id', otherMember.user_id).maybeSingle(),
        client.from('user_preferences').select('show_last_seen').eq('user_id', userId).maybeSingle(),
      ])
      fail(profileError); fail(otherPrefsError); fail(myPrefsError)
      if (profile) {
        const visible = (otherPrefs?.show_last_seen ?? true) && (myPrefs?.show_last_seen ?? true)
        const seen = visible ? profile.last_seen_at : null
        other = { id: profile.id, username: profile.username, fullName: profile.full_name, avatarUrl: profile.avatar_url, verified: !!profile.verified_at, bio: profile.bio,
          online: !!seen && Date.now() - new Date(seen).getTime() < ONLINE_MS, lastSeenAt: seen ?? null }
        const can = await canMessage(userId, profile.id, conversationId)
        blockedReason = can.ok ? null : ('reason' in can && can.reason === 'self' ? null : ('reason' in can && can.reason !== 'self' ? can.reason : 'not_allowed'))
      }
    }
  }
  let names: Record<string, string> = {}
  if (c.kind === 'group') {
    if (c.only_admins_send && me.role !== 'admin') blockedReason = 'admins_only'
    const { data: people, error: peopleError } = await client.from('conversation_members').select('user:users!inner(id,full_name)').eq('conversation_id', conversationId).is('left_at', null).limit(1100)
    fail(peopleError)
    names = Object.fromEntries((people ?? []).map((person: any) => [person.user.id, person.user.full_name.split(' ')[0]]))
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
  const patch = {
    ...(opt.muted !== undefined ? { muted_until: opt.muted ? '2999-01-01T00:00:00.000Z' : null } : {}),
    ...(opt.pinned !== undefined ? { pinned_at: opt.pinned ? new Date().toISOString() : null } : {}),
    ...(opt.archived !== undefined ? { archived: opt.archived } : {}),
    ...(opt.cleared ? { cleared_at: new Date().toISOString() } : {}),
  }
  const { error } = await db().from('conversation_members').update(patch).eq('conversation_id', conversationId).eq('user_id', userId)
  fail(error)
  return true
}

/* ───────────── Messages ───────────── */

async function hydrate(rows: MessageRow[], userId: string, conversationId: string): Promise<MessageView[]> {
  if (!rows.length) return []
  const client = db()
  const ids = rows.map((row) => row.id)
  const senders = [...new Set(rows.map((row) => row.sender_id).filter(Boolean))] as string[]
  const replyIds = [...new Set(rows.map((row) => row.reply_to_id).filter(Boolean))] as string[]
  const [peopleResult, attachmentsResult, reactionsResult, repliesResult, membersResult, myPrefsResult] = await Promise.all([
    senders.length ? client.from('users').select('id,username,full_name,avatar_url,verified_at').in('id', senders) : Promise.resolve({ data: [], error: null }),
    client.from('message_attachments').select('message_id,kind,url,name,size,mime,width,height,duration').in('message_id', ids),
    client.from('message_reactions').select('message_id,user_id,emoji').in('message_id', ids),
    replyIds.length ? client.from('messages').select('id,body,kind,deleted_at,sender_id').in('id', replyIds) : Promise.resolve({ data: [], error: null }),
    client.from('conversation_members').select('last_read_at,last_delivered_at,user_id').eq('conversation_id', conversationId).neq('user_id', userId).is('left_at', null),
    client.from('user_preferences').select('read_receipts').eq('user_id', userId).maybeSingle(),
  ])
  for (const result of [peopleResult, attachmentsResult, reactionsResult, repliesResult, membersResult, myPrefsResult]) fail(result.error)
  const people = (peopleResult.data ?? []).map((person: any) => ({ id: person.id, username: person.username, fullName: person.full_name, avatarUrl: person.avatar_url, verified: !!person.verified_at }))
  const attachments = attachmentsResult.data ?? []
  const reactions = reactionsResult.data ?? []
  const replyRows = repliesResult.data ?? []
  const replySenders = [...new Set(replyRows.map((reply: any) => reply.sender_id).filter(Boolean))] as string[]
  const { data: replyPeople, error: replyPeopleError } = replySenders.length ? await client.from('users').select('id,full_name').in('id', replySenders) : { data: [], error: null }
  fail(replyPeopleError)
  const replyNames = new Map((replyPeople ?? []).map((person: any) => [person.id, person.full_name]))
  const memberIds = (membersResult.data ?? []).map((member: any) => member.user_id)
  const { data: memberPrefs, error: memberPrefsError } = memberIds.length ? await client.from('user_preferences').select('user_id,read_receipts').in('user_id', memberIds) : { data: [], error: null }
  fail(memberPrefsError)
  const preferenceByUser = new Map((memberPrefs ?? []).map((prefs: any) => [prefs.user_id, prefs.read_receipts]))
  const others = (membersResult.data ?? []).map((member: any) => ({
    read: member.last_read_at ? new Date(member.last_read_at) : null,
    delivered: member.last_delivered_at ? new Date(member.last_delivered_at) : null,
    receipts: preferenceByUser.get(member.user_id),
  }))
  const receipts = (myPrefsResult.data?.read_receipts ?? true) && others.every((other) => other.receipts !== false)
  const byPerson = new Map(people.map((person: any) => [person.id, person]))
  return rows.map((message) => {
    const createdAt = new Date(message.created_at)
    const mine = message.sender_id === userId
    const deleted = !!message.deleted_at
    const status: MessageView['status'] = !mine || message.kind === 'system' ? null
      : others.length && receipts && others.every((other) => other.read && other.read >= createdAt) ? 'read'
        : others.length && others.every((other) => other.delivered && other.delivered >= createdAt) ? 'delivered' : 'sent'
    const reply = message.reply_to_id ? replyRows.find((row: any) => row.id === message.reply_to_id) : null
    const counts = new Map<string, { count: number; mine: boolean }>()
    for (const reaction of reactions.filter((row: any) => row.message_id === message.id)) {
      const count = counts.get(reaction.emoji) ?? { count: 0, mine: false }
      counts.set(reaction.emoji, { count: count.count + 1, mine: count.mine || reaction.user_id === userId })
    }
    return {
      id: message.id, conversationId: message.conversation_id, kind: message.kind, body: deleted ? '' : message.body, createdAt: createdAt.toISOString(), editedAt: message.edited_at ? new Date(message.edited_at).toISOString() : null,
      deleted, forwarded: message.forwarded, sender: message.sender_id ? byPerson.get(message.sender_id) ?? null : null, mine,
      replyTo: reply ? { id: reply.id, senderName: replyNames.get(reply.sender_id) ?? '', body: reply.deleted_at ? '' : reply.body.slice(0, 160), kind: reply.kind, deleted: !!reply.deleted_at } : null,
      attachments: deleted ? [] : attachments.filter((attachment: any) => attachment.message_id === message.id).map((attachment: any) => ({ kind: attachment.kind as AttachmentKind, url: attachment.url, name: attachment.name, size: attachment.size, mime: attachment.mime, width: attachment.width, height: attachment.height, duration: attachment.duration })),
      reactions: deleted ? [] : [...counts].map(([emoji, count]) => ({ emoji, ...count })),
      status,
    }
  })
}

/** Newest messages (oldest first in the result), or older ones before a message, or newer ones after one (for live updates). */
export async function listMessages(conversationId: string, userId: string, opts: { before?: string; after?: string } = {}) {
  if (!(await membership(conversationId, userId))) return null
  const validId = (id?: string) => id && /^[0-9a-f-]{36}$/i.test(id) ? id : null
  const { data, error } = await db().rpc('papa_list_message_rows', {
    p_conversation_id: conversationId,
    p_user_id: userId,
    p_before: validId(opts.before),
    p_after: validId(opts.after),
  })
  fail(error)
  let rows = (data ?? []) as MessageRow[]
  if (opts.after && validId(opts.after)) rows = rows.slice(0, 200)
  else rows = rows.reverse()
  const hasMore = !opts.after && rows.length > PAGE
  const page = hasMore ? rows.slice(1) : rows
  return { items: await hydrate(page, userId, conversationId), hasMore }
}

/** Fresh status ticks and reactions for messages already on screen. */
export async function refreshMessages(conversationId: string, userId: string, ids: string[]) {
  const me = await membership(conversationId, userId)
  if (!me || !ids.length) return []
  const { data, error } = await db().from('messages').select('id,conversation_id,sender_id,kind,body,reply_to_id,forwarded,client_id,created_at,edited_at,deleted_at').eq('conversation_id', conversationId).in('id', ids.slice(0, 200))
  fail(error)
  return hydrate((data ?? []) as MessageRow[], userId, conversationId)
}

async function membersOf(conversationId: string) {
  const { data, error } = await db().from('conversation_members').select('user_id,muted_until').eq('conversation_id', conversationId).is('left_at', null)
  fail(error)
  return (data ?? []).map((member) => ({ userId: member.user_id, mutedUntil: member.muted_until ? new Date(member.muted_until) : null }))
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
  const { data: conversation, error: conversationError } = await db().from('conversations').select('kind,only_admins_send').eq('id', conversationId).maybeSingle()
  fail(conversationError)
  if (!conversation) return { ok: false, error: 'not_member' }
  if (conversation.kind === 'group' && conversation.only_admins_send && me.role !== 'admin') return { ok: false, error: 'admins_only' }
  if (conversation.kind === 'direct') {
    const { data: other, error: otherError } = await db().from('conversation_members').select('user_id').eq('conversation_id', conversationId).neq('user_id', senderId).maybeSingle()
    fail(otherError)
    if (!other) return { ok: false, error: 'not_member' }
    const can = await canMessage(senderId, other.user_id, conversationId)
    if (!can.ok) return { ok: false, error: 'reason' in can && can.reason !== 'self' ? can.reason : 'not_member' }
  }
  if (input.replyToId) {
    const { data: reply, error: replyError } = await db().from('messages').select('conversation_id').eq('id', input.replyToId).maybeSingle()
    fail(replyError)
    if (reply?.conversation_id !== conversationId) return { ok: false, error: 'reply' }
  }
  if (body && await containsBannedWord(body)) return { ok: false, error: 'banned_words' }
  if (input.clientId) {
    const { data: duplicate, error: duplicateError } = await db().from('messages').select('id,conversation_id,sender_id,kind,body,reply_to_id,forwarded,client_id,created_at,edited_at,deleted_at').eq('sender_id', senderId).eq('client_id', input.clientId).maybeSingle()
    fail(duplicateError)
    if (duplicate) return { ok: true, message: (await hydrate([duplicate as MessageRow], senderId, conversationId))[0] }
  }
  if (!(await hit(`msg:${senderId}`, 120, 60))) return { ok: false, error: 'rate_limited' }
  const kind = atts.length ? atts[0].kind : 'text'
  const { data, error } = await db().rpc('papa_send_message', {
    p_conversation_id: conversationId,
    p_sender_id: senderId,
    p_kind: kind,
    p_body: body,
    p_reply_to_id: input.replyToId ?? null,
    p_forwarded: !!input.forwarded,
    p_client_id: input.clientId?.slice(0, 64) ?? null,
    p_attachments: atts.map((attachment) => ({
      kind: attachment.kind, url: attachment.url, name: attachment.name?.slice(0, 200) ?? null, size: attachment.size ?? null,
      mime: attachment.mime ?? null, width: attachment.width ?? null, height: attachment.height ?? null,
      duration: attachment.duration ? Math.round(attachment.duration) : null,
    })),
  })
  fail(error)
  const row = ((data ?? []) as MessageRow[])[0]
  if (!row) throw new Error('Message could not be sent')
  await tellMembers(conversationId, senderId, 'message')
  void pushNewMessage(conversationId, senderId, body, kind).catch((e) => console.error('push failed', e))
  return { ok: true, message: (await hydrate([row], senderId, conversationId))[0] }
}

const PREVIEW: Record<string, string> = { image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice message', file: '📄 Document' }

async function pushNewMessage(conversationId: string, senderId: string, body: string, kind: string) {
  const client = db()
  const { data: conversation, error: conversationError } = await client.from('conversations').select('kind,title').eq('id', conversationId).single()
  fail(conversationError)
  const { data: sender, error: senderError } = await client.from('users').select('full_name').eq('id', senderId).single()
  fail(senderError)
  for (const member of await membersOf(conversationId)) {
    if (member.userId === senderId || (member.mutedUntil && member.mutedUntil.getTime() > Date.now())) continue
    if (!(await getPrefs(member.userId)).message.push) continue
    const { data: subscriptions, error } = await client.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', member.userId)
    fail(error)
    for (const subscription of subscriptions ?? []) {
      const text = body || PREVIEW[kind] || ''
      const result = await sendPush({ endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth }, { title: conversation.kind === 'group' ? `${conversation.title} · ${sender.full_name}` : sender.full_name ?? 'PAPA', body: text.slice(0, 120), url: `${env.appUrl}/messages/${conversationId}`, tag: `chat:${conversationId}` })
      if (result === 'gone') {
        const { error: deleteError } = await client.from('push_subscriptions').delete().eq('id', subscription.id)
        fail(deleteError)
      }
    }
  }
}

/** Opening a chat marks it read (the sender sees blue ticks if both have read receipts on). */
export async function markRead(conversationId: string, userId: string) {
  const now = new Date().toISOString()
  const { data, error } = await db().from('conversation_members').update({ last_read_at: now, last_delivered_at: now })
    .eq('conversation_id', conversationId).eq('user_id', userId).is('left_at', null).select('conversation_id')
  fail(error)
  if (data?.length) await tellMembers(conversationId, userId, 'read')
  return !!data?.length
}

/** The member's app received new messages (double grey ticks for the senders). */
export async function markDelivered(userId: string) {
  const client = db()
  const { data: memberships, error: membershipError } = await client.from('conversation_members')
    .select('conversation_id,last_delivered_at').eq('user_id', userId).is('left_at', null)
  fail(membershipError)
  for (const member of memberships ?? []) {
    let query = client.from('messages').select('id').eq('conversation_id', member.conversation_id).neq('sender_id', userId).limit(1)
    if (member.last_delivered_at) query = query.gt('created_at', member.last_delivered_at)
    const { data: pending, error } = await query
    fail(error)
    if (!pending?.length) continue
    const { error: updateError } = await client.from('conversation_members')
      .update({ last_delivered_at: new Date().toISOString() }).eq('conversation_id', member.conversation_id).eq('user_id', userId)
    fail(updateError)
    await tellMembers(member.conversation_id, userId, 'read')
  }
}

export async function typing(conversationId: string, userId: string) {
  if (!(await membership(conversationId, userId))) return
  await tellMembers(conversationId, userId, 'typing')
}

export async function editMessage(userId: string, id: string, body: string) {
  const text = body.trim()
  if (!text || text.length > MESSAGE_MAX) return { ok: false as const, error: 'empty' as const }
  const cutoff = new Date(Date.now() - EDIT_MINUTES * 60_000).toISOString()
  const { data, error } = await db().from('messages').update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', id).eq('sender_id', userId).is('deleted_at', null).neq('kind', 'system').gt('created_at', cutoff).select('conversation_id')
  fail(error)
  if (!data?.length) return { ok: false as const, error: 'edit_window' as const }
  await tellMembers(data[0].conversation_id, null, 'message')
  return { ok: true as const }
}

/** Delete for everyone: your own message, within 24 hours. */
export async function unsend(userId: string, id: string) {
  const cutoff = new Date(Date.now() - UNSEND_HOURS * 60 * 60_000).toISOString()
  const { data, error } = await db().from('messages').update({ deleted_at: new Date().toISOString() })
    .eq('id', id).eq('sender_id', userId).is('deleted_at', null).gt('created_at', cutoff).select('conversation_id')
  fail(error)
  if (!data?.length) return false
  const { error: reactionError } = await db().from('message_reactions').delete().eq('message_id', id)
  fail(reactionError)
  await tellMembers(data[0].conversation_id, null, 'message')
  return true
}

/** Delete for me: hides it from your own view only. */
export async function hideForMe(userId: string, id: string) {
  const { data: message, error } = await db().from('messages').select('conversation_id').eq('id', id).maybeSingle()
  fail(error)
  if (!message || !(await membership(message.conversation_id, userId))) return false
  const { error: hiddenError } = await db().from('message_hidden').upsert({ message_id: id, user_id: userId }, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
  fail(hiddenError)
  return true
}

export async function react(userId: string, id: string, emoji: string | null) {
  if (emoji && !(REACTIONS as readonly string[]).includes(emoji)) return false
  const { data: message, error } = await db().from('messages').select('conversation_id,deleted_at').eq('id', id).maybeSingle()
  fail(error)
  if (!message || message.deleted_at || !(await membership(message.conversation_id, userId))) return false
  if (emoji) {
    const { error: reactionError } = await db().from('message_reactions').upsert({ message_id: id, user_id: userId, emoji, created_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' })
    fail(reactionError)
  } else {
    const { error: reactionError } = await db().from('message_reactions').delete().eq('message_id', id).eq('user_id', userId)
    fail(reactionError)
  }
  await tellMembers(message.conversation_id, null, 'read')
  return true
}

/** Forward a message (text and files) to other chats you're in. */
export async function forward(userId: string, id: string, conversationIds: string[]) {
  const { data: message, error } = await db().from('messages').select('id,conversation_id,sender_id,kind,body,reply_to_id,forwarded,client_id,created_at,edited_at,deleted_at').eq('id', id).is('deleted_at', null).maybeSingle()
  fail(error)
  if (!message || !(await membership(message.conversation_id, userId))) return 0
  const { data: attachments, error: attachmentsError } = await db().from('message_attachments').select('kind,url,name,size,mime,width,height,duration').eq('message_id', id)
  fail(attachmentsError)
  let sent = 0
  for (const conversationId of conversationIds.slice(0, 5)) {
    const result = await sendForwarded(userId, conversationId, message.body, attachments ?? [])
    if (result) sent++
  }
  return sent
}

async function sendForwarded(userId: string, conversationId: string, body: string, attachments: AttachmentInput[]) {
  const me = await membership(conversationId, userId)
  if (!me) return false
  const { data: conversation, error } = await db().from('conversations').select('kind,only_admins_send').eq('id', conversationId).maybeSingle()
  fail(error)
  if (!conversation) return false
  if (conversation.kind === 'group' && conversation.only_admins_send && me.role !== 'admin') return false
  if (conversation.kind === 'direct') {
    const { data: other, error: otherError } = await db().from('conversation_members').select('user_id').eq('conversation_id', conversationId).neq('user_id', userId).maybeSingle()
    fail(otherError)
    if (!other || !(await canMessage(userId, other.user_id, conversationId)).ok) return false
  }
  const { error: sendError } = await db().rpc('papa_send_message', {
    p_conversation_id: conversationId, p_sender_id: userId, p_kind: attachments.length ? attachments[0].kind : 'text', p_body: body,
    p_reply_to_id: null, p_forwarded: true, p_client_id: null, p_attachments: attachments,
  })
  fail(sendError)
  await tellMembers(conversationId, userId, 'message')
  return true
}

/** Search the text of your chats. */
export async function searchMessages(userId: string, q: string) {
  const term = q.trim().replace(/[%_]/g, '')
  if (term.length < 2) return []
  const client = db()
  const { data: memberships, error: membershipError } = await client.from('conversation_members').select('conversation_id,cleared_at,joined_at').eq('user_id', userId).is('left_at', null)
  fail(membershipError)
  if (!memberships?.length) return []
  const membershipByConversation = new Map(memberships.map((member) => [member.conversation_id, member]))
  const { data: candidates, error: searchError } = await client.from('messages')
    .select('id,conversation_id,body,created_at,sender_id').in('conversation_id', memberships.map((member) => member.conversation_id))
    .is('deleted_at', null).neq('kind', 'system').neq('kind', 'call').ilike('body', `%${term}%`)
    .order('created_at', { ascending: false }).limit(1000)
  fail(searchError)
  if (!candidates?.length) return []
  const visible = candidates.filter((message) => {
    const membership = membershipByConversation.get(message.conversation_id)
    const created = new Date(message.created_at).getTime()
    return membership && created > new Date(membership.cleared_at ?? 0).getTime() && created >= new Date(membership.joined_at).getTime() - 1000
  })
  const visibleIds = visible.map((message) => message.id)
  const { data: hidden, error: hiddenError } = visibleIds.length ? await client.from('message_hidden').select('message_id').eq('user_id', userId).in('message_id', visibleIds) : { data: [], error: null }
  fail(hiddenError)
  const hiddenIds = new Set((hidden ?? []).map((row) => row.message_id))
  const results = visible.filter((message) => !hiddenIds.has(message.id)).slice(0, 50)
  const conversationIds = [...new Set(results.map((message) => message.conversation_id))]
  const senderIds = [...new Set(results.map((message) => message.sender_id).filter(Boolean))] as string[]
  const [{ data: conversations, error: conversationsError }, { data: senders, error: sendersError }, { data: others, error: othersError }] = await Promise.all([
    client.from('conversations').select('id,title,kind').in('id', conversationIds),
    senderIds.length ? client.from('users').select('id,full_name').in('id', senderIds) : Promise.resolve({ data: [], error: null }),
    client.from('conversation_members').select('conversation_id,user:users!inner(full_name)').in('conversation_id', conversationIds).neq('user_id', userId),
  ])
  fail(conversationsError); fail(sendersError); fail(othersError)
  const conversationById = new Map((conversations ?? []).map((conversation) => [conversation.id, conversation]))
  const senderById = new Map((senders ?? []).map((sender) => [sender.id, sender.full_name]))
  const otherByConversation = new Map((others ?? []).map((row: any) => [row.conversation_id, row.user.full_name]))
  return results.map((message) => {
    const conversation = conversationById.get(message.conversation_id)
    return { id: message.id, conversationId: message.conversation_id, body: message.body, at: new Date(message.created_at).toISOString(), sender: senderById.get(message.sender_id) ?? null, title: conversation?.kind === 'direct' ? otherByConversation.get(message.conversation_id) ?? '—' : conversation?.title ?? '—' }
  })
}
