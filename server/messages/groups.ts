import 'server-only'
import { randomBytes } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
import { containsBannedWord } from '@/server/posts/compose'
import { isBlockedEitherWay, membership } from './access'
import { tellMembers } from './chat'

export const GROUP_MAX_MEMBERS = 1024
export const GROUP_TITLE_MAX = 60
export const GROUP_DESC_MAX = 500

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
type ConversationRow = {
  id: string
  kind: string
  directKey: string | null
  title: string | null
  avatarUrl: string | null
  createdBy: string | null
  lastMessageAt: Date | null
  createdAt: Date
  description: string | null
  visibility: 'private' | 'public'
  onlyAdminsSend: boolean
  onlyAdminsEdit: boolean
  membersCanAdd: boolean
  approveJoins: boolean
  inviteCode: string | null
  deletedAt: Date | null
}
const sb = () => createSupabaseAdminClient()
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }
const nameOf = async (id: string) => {
  const { data, error } = await sb().from('users').select('full_name').eq('id', id).maybeSingle()
  fail(error)
  return data?.full_name ?? '—'
}

/** Posts a group event into the chat (no sender) and refreshes everyone's screens. */
async function system(conversationId: string, ev: SystemEvent, actorId: string | null = null, whoIds: string[] = []) {
  // Ids let each reader see "You" in place of their own name
  const body = JSON.stringify({ ...ev, ...('by' in ev && actorId ? { byId: actorId } : {}), ...(whoIds.length ? { whoIds } : {}) })
  const client = sb()
  const { data, error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: actorId, kind: 'system', body }).select('created_at').single()
  fail(error)
  const { error: updateError } = await client.from('conversations').update({ last_message_at: data.created_at }).eq('id', conversationId)
  fail(updateError)
  await tellMembers(conversationId, null, 'message')
}

async function group(id: string): Promise<ConversationRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const { data, error } = await sb().from('conversations').select('*').eq('id', id).eq('kind', 'group').is('deleted_at', null).maybeSingle()
  fail(error)
  if (!data) return null
  return {
    id: data.id, kind: data.kind, directKey: data.direct_key, title: data.title, avatarUrl: data.avatar_url, createdBy: data.created_by,
    lastMessageAt: data.last_message_at ? new Date(data.last_message_at) : null, createdAt: new Date(data.created_at),
    description: data.description, visibility: data.visibility, onlyAdminsSend: data.only_admins_send, onlyAdminsEdit: data.only_admins_edit,
    membersCanAdd: data.members_can_add, approveJoins: data.approve_joins, inviteCode: data.invite_code, deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
  }
}

async function memberCount(id: string) {
  const { count, error } = await sb().from('conversation_members').select('*', { count: 'exact', head: true }).eq('conversation_id', id).is('left_at', null)
  fail(error)
  return count ?? 0
}

/** Adds people who allow it (not blocked with the adder; "messages only from people I follow" is respected). */
async function addPeople(adderId: string, conversationId: string, userIds: string[]) {
  const added: string[] = []
  const skipped: string[] = []
  for (const uid of [...new Set(userIds)].filter((u) => u !== adderId)) {
    const { data, error: userError } = await sb().from('users').select('status').eq('id', uid).maybeSingle()
    fail(userError)
    const { data: prefs, error: prefError } = await sb().from('user_preferences').select('messages_from').eq('user_id', uid).maybeSingle()
    fail(prefError)
    const u = data ? { status: data.status, from: prefs?.messages_from ?? null } : undefined
    if (!u || u.status !== 'active' || await isBlockedEitherWay(adderId, uid)) { skipped.push(uid); continue }
    if ((u.from ?? 'everyone') === 'following') {
      let follows = false
      const { data, error: followError } = await sb().from('follows').select('follower_id').eq('follower_id', uid).eq('followee_id', adderId).maybeSingle()
      fail(followError)
      follows = !!data
      if (!follows) { skipped.push(uid); continue }
    }
    if ((await memberCount(conversationId)) >= GROUP_MAX_MEMBERS) { skipped.push(uid); continue }
    // Newcomers start from now (no earlier messages), even when rejoining
    const { error: memberError } = await sb().rpc('papa_group_upsert_member', { p_conversation_id: conversationId, p_user_id: uid })
    fail(memberError)
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
  const { data, error } = await sb().rpc('papa_create_group', {
    p_creator_id: creatorId, p_title: i.title.trim(), p_description: i.description?.trim() || null,
    p_avatar_url: i.avatarUrl || null, p_visibility: i.visibility === 'public' ? 'public' : 'private', p_invite_code: inviteCode,
  })
  if (error) throw error
  const groupId = data as string
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
  const { data: memberData, error: memberError } = await sb().rpc('papa_group_members', { p_conversation_id: id })
  fail(memberError)
  const members = ((memberData ?? []) as GroupMember[]).slice(0, GROUP_MAX_MEMBERS)
  const isAdmin = mine?.role === 'admin'
  let requests: GroupRequest[] = []
  if (isAdmin) {
    const { data, error } = await sb().rpc('papa_group_requests', { p_conversation_id: id })
    fail(error)
    requests = (data ?? []) as GroupRequest[]
  }
  let requested = false
  if (!mine && viewerId) {
    const { count, error } = await sb().from('group_join_requests').select('*', { count: 'exact', head: true }).eq('conversation_id', id).eq('user_id', viewerId)
    fail(error)
    requested = (count ?? 0) > 0
  }
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

export type GroupSettings = Partial<{ visibility: 'private' | 'public'; onlyAdminsSend: boolean; onlyAdminsEdit: boolean; membersCanAdd: boolean; approveJoins: boolean }>
export async function updateSettings(adminId: string, id: string, s: GroupSettings): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  const patch = Object.fromEntries(Object.entries(s).filter(([k, v]) => v !== undefined && ['visibility', 'onlyAdminsSend', 'onlyAdminsEdit', 'membersCanAdd', 'approveJoins'].includes(k)))
  if (patch.visibility && !['private', 'public'].includes(patch.visibility as string)) return { ok: false, error: 'not_found' }
  const { data, error } = await sb().rpc('papa_update_group_settings', { p_actor_id: adminId, p_conversation_id: id, p_settings: patch })
  fail(error)
  if (!data) return { ok: false, error: 'not_admin' }
  if (s.onlyAdminsSend !== undefined && s.onlyAdminsSend !== c.onlyAdminsSend) await system(id, { e: 'only_admins', by: await nameOf(adminId), on: s.onlyAdminsSend }, adminId)
  // Turning approval off lets everyone who asked in
  if (s.approveJoins === false && c.approveJoins) {
    const { data, error } = await sb().from('group_join_requests').select('user_id').eq('conversation_id', id)
    fail(error)
    const waitingIds = (data ?? []).map((w) => w.user_id)
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
  const { data, error } = await sb().rpc('papa_remove_group_member', { p_actor_id: adminId, p_conversation_id: id, p_user_id: userId })
  fail(error)
  if (!data) return { ok: false, error: 'not_found' }
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
  const { data, error } = await sb().rpc('papa_set_group_admin', { p_actor_id: adminId, p_conversation_id: id, p_user_id: userId, p_on: on })
  fail(error)
  if (data === 'creator') return { ok: false, error: 'creator' }
  if (data === 'last_admin') return { ok: false, error: 'last_admin' }
  if (data !== 'ok') return { ok: false, error: data === 'not_admin' ? 'not_admin' : 'not_found' }
  await system(id, { e: on ? 'admin' : 'unadmin', by: await nameOf(adminId), who: await nameOf(userId) }, adminId, [userId])
  return { ok: true, id }
}

/** Leaving: if no admin is left, the longest-serving member becomes admin; an empty group closes. */
export async function leaveGroup(userId: string, id: string): Promise<GroupResult> {
  const c = await group(id)
  if (!c || !(await membership(id, userId))) return { ok: false, error: 'not_found' }
  const { data, error } = await sb().rpc('papa_leave_group', { p_user_id: userId, p_conversation_id: id })
  fail(error)
  const result = data as { status?: string; promoted?: string | null }
  if (result.status === 'not_found') return { ok: false, error: 'not_found' }
  if (result.status === 'closed') return { ok: true, id }
  await system(id, { e: 'left', who: await nameOf(userId) }, userId, [userId])
  if (result.promoted) await system(id, { e: 'admin', by: 'PAPA', who: await nameOf(result.promoted) }, null, [result.promoted])
  return { ok: true, id }
}

/** A new invite link (the old one stops working). */
export async function resetInvite(adminId: string, id: string): Promise<GroupResult<{ id: string; code: string }>> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  const code = randomBytes(9).toString('base64url')
  const { data, error } = await sb().rpc('papa_reset_group_invite', { p_actor_id: adminId, p_conversation_id: id, p_code: code })
  fail(error)
  if (!data) return { ok: false, error: 'not_admin' }
  await system(id, { e: 'reset_link', by: await nameOf(adminId) }, adminId)
  return { ok: true, id, code }
}

export async function groupByInvite(code: string) {
  if (!/^[\w-]{8,20}$/.test(code)) return null
  const { data, error } = await sb().from('conversations').select('id').eq('invite_code', code).eq('kind', 'group').is('deleted_at', null).maybeSingle()
  fail(error)
  return data?.id ?? null
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
    const { error } = await sb().from('group_join_requests').upsert({ conversation_id: id, user_id: userId }, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true })
    fail(error)
    const { data, error: adminError } = await sb().from('conversation_members').select('user_id').eq('conversation_id', id).eq('role', 'admin').is('left_at', null)
    fail(adminError)
    const adminIds = (data ?? []).map((a) => a.user_id)
    const { publish } = await import('@/server/notifications/realtime')
    for (const a of adminIds) await publish({ userId: a, kind: 'message', conversationId: id }).catch(() => {})
    return { ok: true, id, status: 'requested' }
  }
  const { error } = await sb().rpc('papa_group_upsert_member', { p_conversation_id: id, p_user_id: userId })
  fail(error)
  await system(id, via === 'link' ? { e: 'joined_link', who: await nameOf(userId) } : { e: 'joined', who: await nameOf(userId) }, userId, [userId])
  return { ok: true, id, status: 'joined' }
}

export async function cancelRequest(userId: string, id: string) {
  const { error } = await sb().rpc('papa_cancel_group_request', { p_user_id: userId, p_conversation_id: id })
  fail(error)
}

export async function answerRequest(adminId: string, id: string, userId: string, accept: boolean): Promise<GroupResult> {
  const c = await group(id)
  const me = c ? await membership(id, adminId) : null
  if (!c || !me) return { ok: false, error: 'not_found' }
  if (me.role !== 'admin') return { ok: false, error: 'not_admin' }
  const { data, error } = await sb().rpc('papa_answer_group_request', { p_actor_id: adminId, p_conversation_id: id, p_user_id: userId, p_accept: accept })
  fail(error)
  if (!data) return { ok: false, error: 'not_found' }
  if (accept) {
    const { added } = await addPeople(adminId, id, [userId])
    if (added.length) await system(id, { e: 'approved', by: await nameOf(adminId), who: await nameOf(userId) }, adminId, [userId])
  }
  return { ok: true, id }
}

/** Public groups to discover (newest activity first), with whether the viewer is in, or has asked. */
export async function discoverGroups(viewerId: string | null, q?: string, page = 1) {
  const PAGE = 20
  const { data, error } = await sb().rpc('papa_discover_groups', { p_viewer_id: viewerId, p_query: q?.trim() || null, p_page: page })
  fail(error)
  const all = (data ?? []) as { id: string; title: string; description: string | null; avatar_url: string | null; members: number; approve_joins: boolean; member: boolean; requested: boolean }[]
  return {
    items: all.slice(0, PAGE).map((r) => ({ id: r.id, title: r.title, description: r.description, avatarUrl: r.avatar_url, members: r.members, approveJoins: r.approve_joins, member: r.member, requested: r.requested })),
    page, hasMore: all.length > PAGE,
  }
}

/** Tech Admins can close a group (e.g. after reports). */
export async function closeGroup(id: string) {
  const { data, error } = await sb().rpc('papa_close_group', { p_conversation_id: id })
  fail(error)
  return !!data
}

/** My groups (for the Groups page). */
export async function myGroups(userId: string) {
  const { data, error } = await sb().rpc('papa_my_groups', { p_user_id: userId })
  fail(error)
  return ((data ?? []) as { id: string; title: string | null; avatar_url: string | null; description: string | null; members: number; role: 'admin' | 'member' }[])
    .map((r) => ({ id: r.id, title: r.title, avatarUrl: r.avatar_url, description: r.description, members: r.members, role: r.role }))
}
