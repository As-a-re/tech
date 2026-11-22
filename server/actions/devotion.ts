'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as prayer from '@/server/devotion/prayer'
import * as testimonies from '@/server/devotion/testimonies'
import * as comments from '@/server/devotion/comments'
import type { ImageInput } from '@/server/community/announcements'

const viewerOf = (me: { id: string; assemblyId: string; role: string }) => ({ id: me.id, assemblyId: me.assemblyId, isAdmin: me.role === 'tech_admin' })

/* ───── Prayer requests ───── */
export async function createPrayerAction(p: { body: string; anonymous: boolean; audience: prayer.Audience }) {
  const me = await requireUser()
  const r = await prayer.createPrayer(me.id, p)
  if (r.ok) revalidatePath('/prayer')
  return r
}

export async function prayedAction(id: string, on: boolean) {
  const me = await requireUser()
  return prayer.setPrayed(me.id, id, on, viewerOf(me))
}

export async function answerPrayerAction(id: string, note: string) {
  const me = await requireUser()
  const r = await prayer.markAnswered(me.id, id, note)
  revalidatePath(`/prayer/${id}`)
  return r
}

export async function deletePrayerAction(id: string) {
  const me = await requireUser()
  const own = await prayer.deletePrayer(me.id, id)
  const ok = own || (me.role === 'tech_admin' && await prayer.deletePrayer(me.id, id, true))
  if (ok && !own) await audit('admin.prayer_removed', { actorId: me.id, target: id })
  revalidatePath('/prayer')
  return ok
}

/* ───── Testimonies ───── */
export type TestimonyPayload = { title: string; body: string; media?: ImageInput[]; prayerId?: string | null }

export async function createTestimonyAction(p: TestimonyPayload) {
  const me = await requireUser()
  const r = await testimonies.createTestimony(me.id, p)
  if (r.ok) revalidatePath('/testimonies')
  return r
}

export async function editTestimonyAction(id: string, p: TestimonyPayload) {
  const me = await requireUser()
  const r = await testimonies.editTestimony(me.id, id, p)
  if (r.ok) revalidatePath(`/testimonies/${id}`)
  return r
}

export async function deleteTestimonyAction(id: string) {
  const me = await requireUser()
  const own = await testimonies.deleteTestimony(me.id, id)
  const ok = own || (me.role === 'tech_admin' && await testimonies.deleteTestimony(me.id, id, true))
  if (ok && !own) await audit('admin.testimony_removed', { actorId: me.id, target: id })
  revalidatePath('/testimonies')
  return ok
}

export async function praiseAction(id: string, on: boolean) {
  const me = await requireUser()
  return testimonies.setPraise(me.id, id, on)
}

/* ───── Comments (encouragements) ───── */
export async function addCommentAction(target: comments.CommentTarget, body: string) {
  const me = await requireUser()
  const r = await comments.addComment(me.id, target, body)
  if (r.ok) revalidatePath('prayerId' in target ? `/prayer/${target.prayerId}` : `/testimonies/${target.testimonyId}`)
  return r
}

export async function deleteCommentAction(id: string, path: string) {
  const me = await getCurrentUser()
  if (!me) return false
  const ok = await comments.deleteComment(me.id, id, me.role === 'tech_admin')
  if (ok) revalidatePath(path)
  return ok
}
