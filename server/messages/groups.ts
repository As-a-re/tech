import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
import { containsBannedWord } from '@/server/posts/compose'
import { isBlockedEitherWay, membership } from './access'
import { tellMembers } from './chat'

export const GROUP_MAX_MEMBERS = 1024
export const GROUP_TITLE_MAX = 60
export const GROUP_DESC_MAX = 500
const supabaseConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

export type GroupError = 'title' | 'description' | 'photo' | 'banned_words' | 'rate_limited' | 'not_found' | 'not_admin' | 'full' | 'creator' | 'last_admin' | 'blocked' | 'not_allowed'
export type GroupResult<T = { id: string }> = ({ ok: true; error?: never } & T) | { ok: false; error: GroupError }

/** What a group event says in the chat (shown in the member's language). */
export type SystemEvent =
  | { e: 'created'; by: string } | { e: 'added'; by: string; who: string[] } | { e: 'removed'; by: string; who: string }
  | { e: 'left'; who: string } | { e: 'joined'; who: string } | { e: 'joined_link'; who: string } | { e: 'approved'; by: string; who: string }
  | { e: 'title'; by: string; value: string } | { e: 'photo'; by: string } | { e: 'description'; by: string }
  | { e: 'admin'; by: string; who: string } | { e: 'unadmin'; by: string; who: string }
  | { e: 'only_admins'; by: string; on: boolean } | { e: 'reset_link'; by: string }

const PHOTO = /^\/media\/posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/
type ConversationRow = typeof schema.conversations.$inferSelect
const sb = () => createSupabaseAdminClient()
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }
const nameOf = async (id: string) => supabaseConfigured()
  ? ((await sb().from('users').select('full_name').eq('id', id).maybeSingle()).data?.full_name ?? '—')
  : (await db.select({ n: schema.users.fullName }).from(schema.users).where(eq(schema.users.id, id)))[0]?.n ?? '—'

/** Posts a group event into the chat (no sender) and refreshes everyone's screens. */
async function system(conversationId: string, ev: SystemEvent, actorId: string | null = null, whoIds: string[] = []) {
  // Ids let each reader see "You" in place of their own name
  const body = JSON.stringify({ ...ev, ...('by' in ev && actorId ? { byId: actorId } : {}), ...(whoIds.length ? { whoIds } : {}) })
  if (supabaseConfigured()) {
    const client = sb()
    const { data, error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: actorId, kind: 'system', body }).select('created_at').single()
    fail(error)
    const { error: updateError } = await client.from('conversations').update({ last_message_at: data.created_at }).eq('id', conversationId)
    fail(updateError)
  } else {
    const [m] = await db.insert(schema.messages).values({ conversationId, senderId: actorId, kind: 'system', body }).returning({ at: schema.messages.createdAt })
    await db.update(schema.conversations).set({ lastMessageAt: m.at }).where(eq(schema.conversations.id, conversationId))
  }
  await tellMembers(conversationId, null, 'message')
}

async function group(id: string): Promise<ConversationRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  if (supabaseConfigured()) {
    const { data, error } = await sb().from('conversations').select('*').eq('id', id).eq('kind', 'group').is('deleted_at', null).maybeSingle()
    fail(error)
    if (!data) return null
    return {
      id: data.id, kind: data.kind, directKey: data.direct_key, title: data.title, avatarUrl: data.avatar_url, createdBy: data.created_by,
      lastMessageAt: data.last_message_at ? new Date(data.last_message_at) : null, createdAt: new Date(data.created_at),
      description: data.description, visibility: data.visibility, onlyAdminsSend: data.only_admins_send, onlyAdminsEdit: data.only_admins_edit,
      membersCanAdd: data.members_can_add, approveJoins: data.approve_joins, inviteCode: data.invite_code, deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    } as ConversationRow
  }
  const [c] = await db.select().from(schema.conversations).where(and(eq(schema.conversations.id, id), eq(schema.conversations.kind, 'group'), isNull(schema.conversations.deletedAt)))
  return c ?? null
}

async function memberCount(id: string) {
  if (supabaseConfigured()) {
    const { count, error } = await sb().from('conversation_members').select('*', { count: 'exact', head: true }).eq('conversation_id', id).is('left_at', null)
    fail(error)
    return count ?? 0
  }
  return db.$count(schema.conversationMembers, and(eq(schema.conversationMembers.conversationId, id), isNull(schema.conversationMembers.leftAt)))
}

/** Adds people who allow it (not blocked with the adder; "messages only from people I follow" is respected). */
async function addPeople(adderId: string, conversationId: string, userIds: string[]) {
  const added: string[] = []
  const skipped: string[] = []
  for (const uid of [...new Set(userIds)].filter((u) => u !== adderId)) {
    let u: { status: string; from: string | null } | undefined
    if (supabaseConfigured()) {
      const { data, error } = await sb().from('users').select('status').eq('id', uid).maybeSingle()
      fail(error)
      const { data: prefs, error: prefError } = await sb().from('user_preferences').select('messages_from').eq('user_id', uid).maybeSingle()
      fail(prefError)
      u = data ? { status: data.status, from: prefs?.messages_from ?? null } : undefined
    } else {
      const [row] = await db.select({ status: schema.users.status, from: schema.userPreferences.messagesFrom }).from(schema.users)
        .leftJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.users.id)).where(eq(schema.users.id, uid))
      u = row
    }
    if (!u || u.status !== 'active' || await isBlockedEitherWay(adderId, uid)) { skipped.push(uid); continue }
    if ((u.from ?? 'everyone') === 'following') {
      let follows = false
      if (supabaseConfigured()) { const { data, error } = await sb().from('follows').select('follower_id').eq('follower_id', uid).eq('followee_id', adderId).maybeSingle(); fail(error); follows = !!data }
      else { const [f] = await db.select({ x: sql`1` }).from(schema.follows).where(and(eq(schema.follows.followerId, uid), eq(schema.follows.followeeId, adderId))); follows = !!f }
      if (!follows) { skipped.push(uid); continue }
    }
    if ((await memberCount(conversationId)) >= GROUP_MAX_MEMBERS) { skipped.push(uid); continue }
    // Newcomers start from now (no earlier messages), even when rejoining
    if (supabaseConfigured()) {
      const { error } = await createSupabaseAdminClient().rpc('papa_group_upsert_member', { p_conversation_id: conversationId, p_user_id: uid })
      if (error) throw error
    } else {
      await db.insert(schema.conversationMembers).values({ conversationId, userId: uid, clearedAt: sql`now()` })
        .onConflictDoUpdate({ target: [schema.conversationMembers.conversationId, schema.conversationMembers.userId], set: { leftAt: null, joinedAt: sql`now()`, role: 'member', clearedAt: sql`now()`, lastReadAt: null } })
      await db.delete(schema.groupJoinRequests).where(and(eq(schema.groupJoinRequests.conversationId, conversationId), eq(schema.groupJoinRequests.userId, uid)))
    }
    added.push(uid)
  }
  return { added, skipped }
}

export type GroupInput = { title: string; description?: string | null; avatarUrl?: string | null; visibility?: 'private' | 'public'; memberIds?: string[] }

async function checkInfo(i: { title?: string; description?: string | null; avatarUrl?: string | null }): Promise<GroupError | null> {
  if (i.title !== undefined && (i.title.trim().length < 1 || i.title.trim().length > GROUP_TITLE_MAX)) return 'title'
  if ((i.description?.length ?? 0) > GROUP_DESC_MAX) return 'description'
  if (i.avatarUrl && !PHOTO.test(i.avatarUrl)) return 'photo'
  if (await containsBannedWord(`${i.title ?? ''} ${i.description ?? ''}`)) return 'banned_words'
  return null
}

export async function createGroup(creatorId: string, i: GroupInput): Promise<GroupResult<{ id: string; skipped: number }>> {
  const bad = await checkInfo(i)
  if (bad) return { ok: false, error: bad }
  if (!(await hit(`group:${creatorId}`, 10, 3600))) return { ok: false, error: 'rate_limited' }
  const inviteCode = randomBytes(9).toString('base64url')
  let groupId: string
  if (supabaseConfigured()) {
    const { data, error } = await createSupabaseAdminClient().rpc('papa_create_group', {
      p_creator_id: creatorId, p_title: i.title.trim(), p_description: i.description?.trim() || null,
      p_avatar_url: i.avatarUrl || null, p_visibility: i.visibility === 'public' ? 'public' : 'private', p_invite_code: inviteCode,
    })
    if (error) throw error
    groupId = data as string
  } else {
    const [c] = await db.insert(schema.conversations).values({
      kind: 'group', title: i.title.trim(), description: i.description?.trim() || null, avatarUrl: i.avatarUrl || null,
      visibility: i.visibility === 'public' ? 'public' : 'private', createdBy: creatorId, inviteCode,
    }).returning({ id: schema.conversations.id })
    await db.insert(schema.conversationMembers).values({ conversationId: c.id, userId: creatorId, role: 'admin' })
    groupId = c.id
  }
  const c = { id: groupId }
  const me = await nameOf(creatorId)
  await system(c.id, { e: 'created', by: me }, creatorId)
  const { added, skipped } = await addPeople(creatorId, c.id, (i.memberIds ?? []).slice(0, GROUP_MAX_MEMBERS - 1))
  if (added.length) await system(c.id, { e: 'added', by: me, who: await Promise.all(added.slice(0, 10).map(nameOf)) }, creatorId, added.slice(0, 10))
  return { ok: true, id: c.id, skipped: skipped.length }
}

export type GroupMember = { id: string; username: string; fullName: string; avatarUrl: string | null; verified: boolean; role: 'admin' | 'member'; isCreator: boolean; assemblyName: string }
export type GroupInfo = {
  id: string; title: string; description: string | null; avatarUrl: string | null; visibility: 'private' | 'public'; createdAt: string
  onlyAdminsSend: boolean; onlyAdminsEdit: boolean; membersCanAdd: boolean; approveJoins: boolean
  members: GroupMember[]; memberCount: number
  me: { isMember: boolean; isAdmin: boolean; canEdit: boolean; canAdd: boolean; requested: boolean }
  inviteCode: string | null; requests: { id: string; username: string; fullName: string; avatarUrl: string | null; assemblyName: string }[]
}

/** Members see everything; others see a preview of a public group, or of a private one when they hold its invite link. */
export async function groupInfo(id: string, viewerId: string | null, opts: { invite?: boolean } = {}): Promise<GroupInfo | null> {
  const c = await group(id)
  if (!c) return null
  const mine = viewerId ? await membership(id, viewerId) : null
  if (!mine && c.visibility !== 'public' && !opts.invite) return null
  type GroupMember = { id: string; username: string; fullName: string; avatarUrl: string | null; verified: boolean; role: 'admin' | 'member'; assemblyName: string }
  type GroupRequest = { id: string; username: string; fullName: string; avatarUrl: string | null; assemblyName: string }
  const sbMode = supabaseConfigured()
  const members: GroupMember[] = sbMode ? await (async () => {
    const { data, error } = await sb().rpc('papa_group_members', { p_conversation_id: id })
    fail(error)
    return ((data ?? []) as GroupMember[]).slice(0, GROUP_MAX_MEMBERS)
  })() : await db.select({
    id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName, avatarUrl: schema.users.avatarUrl,
    verified: sql<boolean>`${schema.users.verifiedAt} is not null`, role: schema.conversationMembers.role, assemblyName: schema.assemblies.name,
  }).from(schema.conversationMembers).innerJoin(schema.users, eq(schema.users.id, schema.conversationMembers.userId))
    .innerJoin(schema.assemblies, eq(schema.assemblies.id, schema.users.assemblyId))
    .where(and(eq(schema.conversationMembers.conversationId, id), isNull(schema.conversationMembers.leftAt)))
    .orderBy(desc(sql`${schema.conversationMembers.role} = 'admin'`), asc(schema.users.fullName)).limit(GROUP_MAX_MEMBERS)
  const isAdmin = mine?.role === 'admin'
  const requests: GroupRequest[] = isAdmin && sbMode ? await (async () => {
    const { data, error } = await sb().rpc('papa_group_requests', { p_conversation_id: id })
    fail(error)
    return (data ?? []) as GroupRequest[]
  })() : isAdmin ? await db.select({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName, avatarUrl: schema.users.avatarUrl, assemblyName: schema.assemblies.name })
    .from(schema.groupJoinRequests).innerJoin(schema.users, eq(schema.users.id, schema.groupJoinRequests.userId))
    .innerJoin(schema.assemblies, eq(schema.assemblies.id, schema.users.assemblyId))
    .where(eq(schema.groupJoinRequests.conversationId, id)).orderBy(asc(schema.groupJoinRequests.createdAt)) : []
  const requested = !mine && viewerId && sbMode
    ? ((await sb().from('group_join_requests').select('*', { count: 'exact', head: true }).eq('conversation_id', id).eq('user_id', viewerId)).count ?? 0) > 0
    : !mine && viewerId ? (await db.$count(schema.groupJoinRequests, and(eq(schema.groupJoinRequests.conversationId, id), eq(schema.groupJoinRequests.userId, viewerId)))) > 0 : false
  const canAdd = !!mine && (isAdmin || c.membersCanAdd)
  return {
    id, title: c.title ?? '—', description: c.description, avatarUrl: c.avatarUrl, visibility: c.visibility, createdAt: c.createdAt.toISOString(),
    onlyAdminsSend: c.onlyAdminsSend, onlyAdminsEdit: c.onlyAdminsEdit, membersCanAdd: c.membersCanAdd, approveJoins: c.approveJoins,
    members: mine ? members.map((m) => ({ ...m, isCreator: m.id === c.createdBy })) : members.slice(0, 8).map((m) => ({ ...m, isCreator: m.id === c.createdBy })),
    memberCount: members.length,
    me: { isMember: !!mine, isAdmin, canEdit: !!mine && (isAdmin || !c.onlyAdminsEdit), canAdd, requested },
    inviteCode: canAdd ? c.inviteCode : null, requests,
  }
}

export async function updateGroup(actorId: string, id: string, i: { title?: string; description?: string | null; avatarUrl?: string | null }): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, actorId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (c.onlyAdminsEdit && me.role !== 'admin') return { ok: false, error: 'not_admin' }
  const bad = await checkInfo(i)
  if (bad) return { ok: false, error: bad }
  const who = await nameOf(actorId)
  if (supabaseConfigured()) {
    const titleChanged = i.title !== undefined && i.title.trim() !== c.title
    const descriptionChanged = i.description !== undefined && (i.description?.trim() || null) !== c.description
    const avatarChanged = i.avatarUrl !== undefined && (i.avatarUrl || null) !== c.avatarUrl
    const { data, error } = await sb().rpc('papa_update_group', { p_actor_id: actorId, p_conversation_id: id, p_update_title: titleChanged, p_title: titleChanged ? i.title!.trim() : null, p_update_description: descriptionChanged, p_description: descriptionChanged ? (i.description?.trim() || null) : null, p_update_avatar: avatarChanged, p_avatar_url: avatarChanged ? (i.avatarUrl || null) : null })
    fail(error)
    if (!data) return { ok: false, error: 'not_admin' }
    if (titleChanged) await system(id, { e: 'title', by: who, value: i.title!.trim() }, actorId)
    if (descriptionChanged) await system(id, { e: 'description', by: who }, actorId)
    if (avatarChanged) await system(id, { e: 'photo', by: who }, actorId)
    return { ok: true, id }
  }
  if (i.title !== undefined && i.title.trim() !== c.title) {
    await db.update(schema.conversations).set({ title: i.title.trim() }).where(eq(schema.conversations.id, id))
    await system(id, { e: 'title', by: who, value: i.title.trim() }, actorId)
  }
  if (i.description !== undefined && (i.description?.trim() || null) !== c.description) {
    await db.update(schema.conversations).set({ description: i.description?.trim() || null }).where(eq(schema.conversations.id, id))
    await system(id, { e: 'description', by: who }, actorId)
  }
  if (i.avatarUrl !== undefined && (i.avatarUrl || null) !== c.avatarUrl) {
    await db.update(schema.conversations).set({ avatarUrl: i.avatarUrl || null }).where(eq(schema.conversations.id, id))
    await system(id, { e: 'photo', by: who }, actorId)
  }
  return { ok: true, id }
}

export type GroupSettings = Partial<{ visibility: 'private' | 'public'; onlyAdminsSend: boolean; onlyAdminsEdit: boolean; membersCanAdd: boolean; approveJoins: boolean }>
export async function updateSettings(adminId: string, id: string, s: GroupSettings): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  const patch = Object.fromEntries(Object.entries(s).filter(([k, v]) => v !== undefined && ['visibility', 'onlyAdminsSend', 'onlyAdminsEdit', 'membersCanAdd', 'approveJoins'].includes(k)))
  if (patch.visibility && !['private', 'public'].includes(patch.visibility as string)) return { ok: false, error: 'not_found' }
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_update_group_settings', { p_actor_id: adminId, p_conversation_id: id, p_settings: patch })
    fail(error)
    if (!data) return { ok: false, error: 'not_admin' }
  } else await db.update(schema.conversations).set(patch).where(eq(schema.conversations.id, id))
  if (s.onlyAdminsSend !== undefined && s.onlyAdminsSend !== c.onlyAdminsSend) await system(id, { e: 'only_admins', by: await nameOf(adminId), on: s.onlyAdminsSend }, adminId)
  // Turning approval off lets everyone who asked in
  if (s.approveJoins === false && c.approveJoins) {
    let waitingIds: string[]
    if (supabaseConfigured()) { const { data, error } = await sb().from('group_join_requests').select('user_id').eq('conversation_id', id); fail(error); waitingIds = (data ?? []).map((w) => w.user_id) }
    else waitingIds = (await db.select({ u: schema.groupJoinRequests.userId }).from(schema.groupJoinRequests).where(eq(schema.groupJoinRequests.conversationId, id))).map((w) => w.u)
    if (waitingIds.length) { const r = await addPeople(adminId, id, waitingIds); for (const u of r.added) await system(id, { e: 'joined', who: await nameOf(u) }, u, [u]) }
  }
  return { ok: true, id }
}

export async function addMembers(actorId: string, id: string, userIds: string[]): Promise<GroupResult<{ id: string; added: number; skipped: number }>> {
  const c = await group(id)
  const me = c ? await membership(id, actorId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin' && !c.membersCanAdd) return { ok: false, error: 'not_admin' }
  const { added, skipped } = await addPeople(actorId, id, userIds.slice(0, 200))
  if (added.length) await system(id, { e: 'added', by: await nameOf(actorId), who: await Promise.all(added.slice(0, 10).map(nameOf)) }, actorId, added.slice(0, 10))
  return { ok: true, id, added: added.length, skipped: skipped.length }
}

export async function removeMember(adminId: string, id: string, userId: string): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  if (userId === c.createdBy && adminId !== c.createdBy) return { ok: false, error: 'creator' }
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_remove_group_member', { p_actor_id: adminId, p_conversation_id: id, p_user_id: userId })
    fail(error)
    if (!data) return { ok: false, error: 'not_found' }
  } else {
    const r = await db.update(schema.conversationMembers).set({ leftAt: sql`now()`, role: 'member' })
      .where(and(eq(schema.conversationMembers.conversationId, id), eq(schema.conversationMembers.userId, userId), isNull(schema.conversationMembers.leftAt))).returning()
    if (!r.length) return { ok: false, error: 'not_found' }
  }
  await system(id, { e: 'removed', by: await nameOf(adminId), who: await nameOf(userId) }, adminId, [userId])
  // The removed member's screens update too (the chat leaves their list)
  const { publish } = await import('@/server/notifications/realtime')
  await publish({ userId, kind: 'message', conversationId: id }).catch(() => {})
  return { ok: true, id }
}

export async function setAdmin(adminId: string, id: string, userId: string, on: boolean): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  if (!on && userId === c.createdBy && adminId !== c.createdBy) return { ok: false, error: 'creator' }
  if (!on && userId === adminId && !supabaseConfigured()) {
    const admins = await db.$count(schema.conversationMembers, and(eq(schema.conversationMembers.conversationId, id), eq(schema.conversationMembers.role, 'admin'), isNull(schema.conversationMembers.leftAt)))
    if (admins <= 1) return { ok: false, error: 'last_admin' }
  }
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_set_group_admin', { p_actor_id: adminId, p_conversation_id: id, p_user_id: userId, p_on: on })
    fail(error)
    if (data === 'creator') return { ok: false, error: 'creator' }
    if (data === 'last_admin') return { ok: false, error: 'last_admin' }
    if (data !== 'ok') return { ok: false, error: data === 'not_admin' ? 'not_admin' : 'not_found' }
  } else {
    const r = await db.update(schema.conversationMembers).set({ role: on ? 'admin' : 'member' })
      .where(and(eq(schema.conversationMembers.conversationId, id), eq(schema.conversationMembers.userId, userId), isNull(schema.conversationMembers.leftAt))).returning()
    if (!r.length) return { ok: false, error: 'not_found' }
  }
  await system(id, { e: on ? 'admin' : 'unadmin', by: await nameOf(adminId), who: await nameOf(userId) }, adminId, [userId])
  return { ok: true, id }
}

/** Leaving: if no admin is left, the longest-serving member becomes admin; an empty group closes. */
export async function leaveGroup(userId: string, id: string): Promise<GroupResult> {
  const c = await group(id)
  if (!c || !(await membership(id, userId))) return { ok: false, error: 'not_found' }
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_leave_group', { p_user_id: userId, p_conversation_id: id })
    fail(error)
    const result = data as { status?: string; promoted?: string | null }
    if (result.status === 'not_found') return { ok: false, error: 'not_found' }
    if (result.status === 'closed') return { ok: true, id }
    await system(id, { e: 'left', who: await nameOf(userId) }, userId, [userId])
    if (result.promoted) await system(id, { e: 'admin', by: 'PAPA', who: await nameOf(result.promoted) }, null, [result.promoted])
    return { ok: true, id }
  }
  await db.update(schema.conversationMembers).set({ leftAt: sql`now()`, role: 'member' })
    .where(and(eq(schema.conversationMembers.conversationId, id), eq(schema.conversationMembers.userId, userId)))
  const rest = await db.select().from(schema.conversationMembers).where(and(eq(schema.conversationMembers.conversationId, id), isNull(schema.conversationMembers.leftAt)))
    .orderBy(asc(schema.conversationMembers.joinedAt))
  if (!rest.length) { await db.update(schema.conversations).set({ deletedAt: sql`now()` }).where(eq(schema.conversations.id, id)); return { ok: true, id } }
  await system(id, { e: 'left', who: await nameOf(userId) }, userId, [userId])
  if (!rest.some((m) => m.role === 'admin')) {
    await db.update(schema.conversationMembers).set({ role: 'admin' }).where(and(eq(schema.conversationMembers.conversationId, id), eq(schema.conversationMembers.userId, rest[0].userId)))
    await system(id, { e: 'admin', by: 'PAPA', who: await nameOf(rest[0].userId) }, null, [rest[0].userId])
  }
  return { ok: true, id }
}

/** A new invite link (the old one stops working). */
export async function resetInvite(adminId: string, id: string): Promise<GroupResult<{ id: string; code: string }>> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  const code = randomBytes(9).toString('base64url')
  if (supabaseConfigured()) { const { data, error } = await sb().rpc('papa_reset_group_invite', { p_actor_id: adminId, p_conversation_id: id, p_code: code }); fail(error); if (!data) return { ok: false, error: 'not_admin' } }
  else await db.update(schema.conversations).set({ inviteCode: code }).where(eq(schema.conversations.id, id))
  await system(id, { e: 'reset_link', by: await nameOf(adminId) }, adminId)
  return { ok: true, id, code }
}

export async function groupByInvite(code: string) {
  if (!/^[\w-]{8,20}$/.test(code)) return null
  if (supabaseConfigured()) { const { data, error } = await sb().from('conversations').select('id').eq('invite_code', code).eq('kind', 'group').is('deleted_at', null).maybeSingle(); fail(error); return data?.id ?? null }
  const [c] = await db.select({ id: schema.conversations.id }).from(schema.conversations)
    .where(and(eq(schema.conversations.inviteCode, code), eq(schema.conversations.kind, 'group'), isNull(schema.conversations.deletedAt)))
  return c?.id ?? null
}

/** Join from an invite link or from Discover (public groups). Needs approval if the group asks for it. */
export async function joinGroup(userId: string, id: string, via: 'link' | 'discover'): Promise<GroupResult<{ id: string; status: 'joined' | 'requested' | 'member' }>> {
  const c = await group(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (await membership(id, userId)) return { ok: true, id, status: 'member' }
  if (via === 'discover' && c.visibility !== 'public') return { ok: false, error: 'not_allowed' }
  // Someone who blocked (or was blocked by) the group's creator can't come in through the back door
  if (c.createdBy && await isBlockedEitherWay(userId, c.createdBy)) return { ok: false, error: 'blocked' }
  if ((await memberCount(id)) >= GROUP_MAX_MEMBERS) return { ok: false, error: 'full' }
  if (c.approveJoins) {
    let adminIds: string[]
    if (supabaseConfigured()) {
      const { error } = await sb().from('group_join_requests').upsert({ conversation_id: id, user_id: userId }, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }); fail(error)
      const { data, error: adminError } = await sb().from('conversation_members').select('user_id').eq('conversation_id', id).eq('role', 'admin').is('left_at', null); fail(adminError); adminIds = (data ?? []).map((a) => a.user_id)
    } else {
      await db.insert(schema.groupJoinRequests).values({ conversationId: id, userId }).onConflictDoNothing()
      adminIds = (await db.select({ u: schema.conversationMembers.userId }).from(schema.conversationMembers)
        .where(and(eq(schema.conversationMembers.conversationId, id), eq(schema.conversationMembers.role, 'admin'), isNull(schema.conversationMembers.leftAt)))).map((a) => a.u)
    }
    const { publish } = await import('@/server/notifications/realtime')
    for (const a of adminIds) await publish({ userId: a, kind: 'message', conversationId: id }).catch(() => {})
    return { ok: true, id, status: 'requested' }
  }
  if (supabaseConfigured()) {
    const { error } = await createSupabaseAdminClient().rpc('papa_group_upsert_member', { p_conversation_id: id, p_user_id: userId })
    if (error) throw error
  } else await db.insert(schema.conversationMembers).values({ conversationId: id, userId, clearedAt: sql`now()` })
    .onConflictDoUpdate({ target: [schema.conversationMembers.conversationId, schema.conversationMembers.userId], set: { leftAt: null, joinedAt: sql`now()`, role: 'member', clearedAt: sql`now()`, lastReadAt: null } })
  await system(id, via === 'link' ? { e: 'joined_link', who: await nameOf(userId) } : { e: 'joined', who: await nameOf(userId) }, userId, [userId])
  return { ok: true, id, status: 'joined' }
}

export async function cancelRequest(userId: string, id: string) {
  if (supabaseConfigured()) { const { error } = await sb().rpc('papa_cancel_group_request', { p_user_id: userId, p_conversation_id: id }); fail(error); return }
  await db.delete(schema.groupJoinRequests).where(and(eq(schema.groupJoinRequests.conversationId, id), eq(schema.groupJoinRequests.userId, userId)))
}

export async function answerRequest(adminId: string, id: string, userId: string, accept: boolean): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_answer_group_request', { p_actor_id: adminId, p_conversation_id: id, p_user_id: userId, p_accept: accept })
    fail(error)
    if (!data) return { ok: false, error: 'not_found' }
  } else {
    const r = await db.delete(schema.groupJoinRequests).where(and(eq(schema.groupJoinRequests.conversationId, id), eq(schema.groupJoinRequests.userId, userId))).returning()
    if (!r.length) return { ok: false, error: 'not_found' }
  }
  if (accept) {
    const { added } = await addPeople(adminId, id, [userId])
    if (added.length) await system(id, { e: 'approved', by: await nameOf(adminId), who: await nameOf(userId) }, adminId, [userId])
  }
  return { ok: true, id }
}

/** Public groups to discover (newest activity first), with whether the viewer is in, or has asked. */
export async function discoverGroups(viewerId: string | null, q?: string, page = 1) {
  const term = q?.trim() ? `%${q.trim().replace(/[%_]/g, '')}%` : null
  const PAGE = 20
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_discover_groups', { p_viewer_id: viewerId, p_query: q?.trim() || null, p_page: page })
    fail(error)
    const all = (data ?? []) as { id: string; title: string; description: string | null; avatar_url: string | null; members: number; approve_joins: boolean; member: boolean; requested: boolean }[]
    return {
      items: all.slice(0, PAGE).map((r) => ({ id: r.id, title: r.title, description: r.description, avatarUrl: r.avatar_url, members: r.members, approveJoins: r.approve_joins, member: r.member, requested: r.requested })),
      page, hasMore: all.length > PAGE,
    }
  }
  const rows = await db.execute<{ id: string; title: string; description: string | null; avatar_url: string | null; members: number; approve_joins: boolean; member: boolean; requested: boolean }>(sql`
    select c.id, c.title, c.description, c.avatar_url, c.approve_joins,
      (select count(*)::int from conversation_members m where m.conversation_id = c.id and m.left_at is null) as members,
      ${viewerId ? sql`exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = ${viewerId} and m.left_at is null)` : sql`false`} as member,
      ${viewerId ? sql`exists (select 1 from group_join_requests r where r.conversation_id = c.id and r.user_id = ${viewerId})` : sql`false`} as requested
    from conversations c where c.kind = 'group' and c.visibility = 'public' and c.deleted_at is null
      ${term ? sql`and (c.title ilike ${term} or c.description ilike ${term})` : sql``}
    order by coalesce(c.last_message_at, c.created_at) desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`)
  return {
    items: rows.rows.slice(0, PAGE).map((r) => ({ id: r.id, title: r.title, description: r.description, avatarUrl: r.avatar_url, members: r.members, approveJoins: r.approve_joins, member: r.member, requested: r.requested })),
    page, hasMore: rows.rows.length > PAGE,
  }
}

/** Tech Admins can close a group (e.g. after reports). */
export async function closeGroup(id: string) {
  if (supabaseConfigured()) { const { data, error } = await sb().rpc('papa_close_group', { p_conversation_id: id }); fail(error); return !!data }
  const r = await db.update(schema.conversations).set({ deletedAt: sql`now()` }).where(and(eq(schema.conversations.id, id), eq(schema.conversations.kind, 'group'), isNull(schema.conversations.deletedAt))).returning()
  return r.length > 0
}

/** My groups (for the Groups page). */
export async function myGroups(userId: string) {
  if (supabaseConfigured()) {
    const { data, error } = await sb().rpc('papa_my_groups', { p_user_id: userId })
    fail(error)
    return ((data ?? []) as { id: string; title: string | null; avatar_url: string | null; description: string | null; members: number; role: 'admin' | 'member' }[])
      .map((r) => ({ id: r.id, title: r.title, avatarUrl: r.avatar_url, description: r.description, members: r.members, role: r.role }))
  }
  return db.select({ id: schema.conversations.id, title: schema.conversations.title, avatarUrl: schema.conversations.avatarUrl, description: schema.conversations.description,
    members: sql<number>`(select count(*)::int from conversation_members m where m.conversation_id = ${schema.conversations.id} and m.left_at is null)`,
    role: schema.conversationMembers.role })
    .from(schema.conversationMembers).innerJoin(schema.conversations, eq(schema.conversations.id, schema.conversationMembers.conversationId))
    .where(and(eq(schema.conversationMembers.userId, userId), isNull(schema.conversationMembers.leftAt), eq(schema.conversations.kind, 'group'), isNull(schema.conversations.deletedAt)))
    .orderBy(desc(schema.conversations.lastMessageAt))
}
