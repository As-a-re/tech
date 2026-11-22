'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as live from '@/server/live/live'

const done = () => { revalidatePath('/live', 'layout'); revalidatePath('/') }

export async function saveLiveAction(input: live.LiveInput, id?: string) {
  const me = await requireUser()
  const r = await live.saveLive(me, input, id)
  if (r.ok) done()
  return r
}

export async function goLiveAction(id: string) {
  const me = await requireUser()
  const ok = await live.goLive(me, id)
  if (ok) { done(); await audit('live.started', { actorId: me.id, target: id }) }
  return ok
}

export async function endLiveAction(id: string) {
  const me = await requireUser()
  const ok = await live.endLive(me, id)
  if (ok) done()
  return ok
}

export async function deleteLiveAction(id: string) {
  const me = await requireUser()
  const ok = await live.deleteLive(me, id)
  if (ok) { done(); await audit('live.deleted', { actorId: me.id, target: id }) }
  return ok
}

export async function removeLiveCommentAction(commentId: string) {
  const me = await requireUser()
  return live.removeComment(me, commentId)
}

export async function liveReminderAction(id: string, on: boolean) {
  const me = await requireUser()
  await live.setReminder(me.id, id, on)
}
