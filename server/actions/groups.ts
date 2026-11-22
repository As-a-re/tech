'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as g from '@/server/messages/groups'

const done = <T,>(r: T, id?: string) => { revalidatePath('/messages', 'layout'); revalidatePath('/groups', 'layout'); if (id) revalidatePath(`/messages/${id}/info`); return r }

export async function createGroupAction(input: g.GroupInput) {
  const me = await requireUser()
  return done(await g.createGroup(me.id, input))
}

export async function updateGroupAction(id: string, input: { title?: string; description?: string | null; avatarUrl?: string | null }) {
  const me = await requireUser()
  return done(await g.updateGroup(me.id, id, input), id)
}

export async function groupSettingsAction(id: string, s: g.GroupSettings) {
  const me = await requireUser()
  return done(await g.updateSettings(me.id, id, s), id)
}

export async function addMembersAction(id: string, userIds: string[]) {
  const me = await requireUser()
  return done(await g.addMembers(me.id, id, userIds), id)
}

export async function removeMemberAction(id: string, userId: string) {
  const me = await requireUser()
  return done(await g.removeMember(me.id, id, userId), id)
}

export async function setAdminAction(id: string, userId: string, on: boolean) {
  const me = await requireUser()
  return done(await g.setAdmin(me.id, id, userId, on), id)
}

export async function leaveGroupAction(id: string) {
  const me = await requireUser()
  return done(await g.leaveGroup(me.id, id), id)
}

export async function resetInviteAction(id: string) {
  const me = await requireUser()
  return done(await g.resetInvite(me.id, id), id)
}

export async function joinGroupAction(id: string, via: 'link' | 'discover') {
  const me = await requireUser()
  return done(await g.joinGroup(me.id, id, via), id)
}

export async function cancelRequestAction(id: string) {
  const me = await requireUser()
  await g.cancelRequest(me.id, id)
  return done({ ok: true as const }, id)
}

export async function answerRequestAction(id: string, userId: string, accept: boolean) {
  const me = await requireUser()
  return done(await g.answerRequest(me.id, id, userId, accept), id)
}

export async function discoverGroupsAction(q: string, page = 1) {
  const me = await requireUser()
  return g.discoverGroups(me.id, q, page)
}

/** Tech Admins only (audited). */
export async function closeGroupAction(id: string) {
  const me = await requireUser()
  if (me.role !== 'tech_admin') return { ok: false as const, error: 'not_admin' as const }
  const ok = await g.closeGroup(id)
  if (ok) await audit('admin.group_closed', { actorId: me.id, target: id })
  return done(ok ? { ok: true as const, id } : { ok: false as const, error: 'not_found' as const }, id)
}
