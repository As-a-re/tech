'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, requireUser } from '@/server/identity/session'
import { markAllRead, listNotifications } from '@/server/notifications/list'
import { setPref, unreadCount, NOTIFICATION_TYPES, type NotificationType } from '@/server/notifications/notify'
import * as lists from '@/server/discovery/lists'
import * as saved from '@/server/discovery/saved'
import { fileReport, type ReportTarget } from '@/server/moderation/reports'
import { setFavorite } from '@/server/posts/interactions'

/* ───── Notifications ───── */
export async function markAllReadAction() {
  const me = await requireUser()
  await markAllRead(me.id)
  revalidatePath('/', 'layout')
}
export async function notificationsAction(filter: 'all' | 'mentions') {
  const me = await requireUser()
  return listNotifications(me.id, filter)
}
export async function setNotificationPrefAction(type: string, channel: 'inApp' | 'push', on: boolean) {
  const me = await requireUser()
  if (!NOTIFICATION_TYPES.includes(type as NotificationType)) return
  await setPref(me.id, type as NotificationType, channel, on)
}
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const me = await requireUser()
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return false
  const { error } = await createSupabaseAdminClient().from('push_subscriptions').upsert({ user_id: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300) }, { onConflict: 'endpoint' })
  if (error) throw new Error(`Unable to save push subscription: ${error.message}`)
  return true
}
/** The Android/iOS app's Firebase token for this device (remembered in a cookie so signing out removes it). */
export async function saveNativePushToken(token: string, platform: 'android' | 'ios') {
  const me = await requireUser()
  if (!/^[\w:.\-]{20,4096}$/.test(token) || (platform !== 'android' && platform !== 'ios')) return false
  const endpoint = `fcm:${token}`
  const { error } = await createSupabaseAdminClient().from('push_subscriptions').upsert({ user_id: me.id, endpoint, p256dh: '', auth: '', user_agent: `PAPA app (${platform})` }, { onConflict: 'endpoint' })
  if (error) throw new Error(`Unable to save native push token: ${error.message}`)
  ;(await cookies()).set('papa_native_push', endpoint, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 31536000 })
  return true
}

export async function removePushSubscription(endpoint: string) {
  const me = await requireUser()
  const { error } = await createSupabaseAdminClient().from('push_subscriptions').delete().eq('user_id', me.id).eq('endpoint', endpoint)
  if (error) throw new Error(`Unable to remove push subscription: ${error.message}`)
}

/* ───── Lists ───── */
export type ListFormState = { error?: string }
export async function saveListAction(_: ListFormState, f: FormData): Promise<ListFormState> {
  const me = await requireUser('/lists')
  const id = String(f.get('id') ?? '') || undefined
  const r = await lists.saveList(me.id, { name: String(f.get('name') ?? ''), description: String(f.get('description') ?? ''), isPrivate: f.get('isPrivate') === 'on' }, id)
  if (!r.ok) return { error: r.error }
  revalidatePath('/lists', 'layout')
  redirect(`/lists/${r.id}`)
}
export async function deleteListAction(id: string) {
  const me = await requireUser('/lists')
  await lists.deleteList(me.id, id)
  revalidatePath('/lists', 'layout')
  redirect('/lists')
}
export async function setListMemberAction(listId: string, userId: string, on: boolean) {
  const me = await requireUser()
  const ok = await lists.setListMember(me.id, listId, userId, on)
  revalidatePath(`/lists/${listId}`, 'layout')
  return ok
}
export async function myListsForAction(userId: string) {
  const me = await requireUser()
  return lists.listsWithMembership(me.id, userId)
}

/* ───── Favorites ───── */
export async function removeFavoriteAction(userId: string) {
  const me = await requireUser()
  await setFavorite(me.id, userId, false)
  revalidatePath('/favorites')
}

/* ───── Saved folders ───── */
export async function createFolderAction(name: string) {
  const me = await requireUser()
  const id = await saved.createFolder(me.id, name)
  revalidatePath('/saved')
  return id
}
export async function foldersAction() { const me = await requireUser(); return (await saved.folders(me.id)).map((f) => ({ id: f.id, name: f.name })) }
export async function renameFolderAction(id: string, name: string) { const me = await requireUser(); await saved.renameFolder(me.id, id, name); revalidatePath('/saved') }
export async function deleteFolderAction(id: string) { const me = await requireUser(); await saved.deleteFolder(me.id, id); revalidatePath('/saved'); redirect('/saved') }
export async function moveBookmarkAction(postId: string, folderId: string | null) { const me = await requireUser(); const ok = await saved.moveBookmark(me.id, postId, folderId); revalidatePath('/saved'); return ok }

/* ───── Reports ───── */
export async function reportAction(target: ReportTarget, reason: string, details: string) {
  const me = await requireUser()
  return fileReport(me.id, target, reason, details)
}
