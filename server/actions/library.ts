'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getCurrentUser, requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import { hit } from '@/server/identity/rate-limit'
import * as pubs from '@/server/library/publications'
import * as kids from '@/server/library/kids'
import { KIDS_COOKIE, isKidsAge } from '@/lib/library/kids-mode'

/* ───── Publications ───── */
export async function savePublicationAction(input: pubs.PublicationInput, id?: string) {
  const me = await requireUser()
  const r = await pubs.savePublication(me, input, id)
  if (r.ok) { revalidatePath('/publications', 'layout'); if (id && me.role === 'tech_admin') await audit('admin.publication_saved', { actorId: me.id, target: r.id }) }
  return r
}

export async function deletePublicationAction(id: string) {
  const me = await requireUser()
  const ok = await pubs.deletePublication(me, id)
  if (ok) { revalidatePath('/publications', 'layout'); await audit('publication.deleted', { actorId: me.id, target: id }) }
  return ok
}

export async function savePublicationToLibraryAction(id: string, on: boolean) {
  const me = await requireUser()
  await pubs.setSaved(me.id, id, on)
  revalidatePath(`/publications/${id}`)
}

export async function followSeriesAction(seriesId: string, on: boolean) {
  const me = await requireUser()
  await pubs.setFollowSeries(me.id, seriesId, on)
  revalidatePath('/publications', 'layout')
}

/* ───── Kids ───── */
export async function saveKidsAction(input: kids.KidsInput, id?: string) {
  const me = await requireUser()
  const r = await kids.saveKidsItem(me, input, id)
  if (r.ok) revalidatePath('/children', 'layout')
  return r
}

export async function deleteKidsAction(id: string) {
  const me = await requireUser()
  const ok = await kids.deleteKidsItem(me, id)
  if (ok) { revalidatePath('/children', 'layout'); await audit('kids.deleted', { actorId: me.id, target: id }) }
  return ok
}

export async function submitQuizAction(id: string, answers: number[]) {
  const me = await getCurrentUser()
  return kids.submitQuiz(me?.id ?? null, id, answers.slice(0, 50).map((n) => Math.trunc(Number(n))))
}

/** Turns Kids mode on for this device (a parent's 4-digit PIN is set the first time). */
export async function enterKidsModeAction(age: string, pin?: string): Promise<{ ok: boolean; error?: 'pin' }> {
  const me = await requireUser('/children/kids-mode')
  if (!(await kids.hasKidsPin(me.id))) {
    if (!pin || !(await kids.setKidsPin(me.id, pin))) return { ok: false, error: 'pin' }
  }
  const jar = await cookies()
  jar.set(KIDS_COOKIE, isKidsAge(age) ? age : 'all', { path: '/', maxAge: 31536000, sameSite: 'lax', httpOnly: true })
  return { ok: true }
}

/** Leaving Kids mode needs the parent's PIN (5 tries per 15 minutes). */
export async function exitKidsModeAction(pin: string): Promise<{ ok: boolean; error?: 'pin' | 'too_many' }> {
  const me = await requireUser('/children/exit')
  if (!(await hit(`kidspin:${me.id}`, 5, 900))) return { ok: false, error: 'too_many' }
  if (!(await kids.checkKidsPin(me.id, pin))) return { ok: false, error: 'pin' }
  ;(await cookies()).delete(KIDS_COOKIE)
  return { ok: true }
}

export async function changeKidsPinAction(oldPin: string, pin: string) {
  const me = await requireUser()
  if ((await kids.hasKidsPin(me.id)) && !(await kids.checkKidsPin(me.id, oldPin))) return { ok: false }
  return { ok: await kids.setKidsPin(me.id, pin) }
}
