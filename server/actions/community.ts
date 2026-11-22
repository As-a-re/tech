'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as ann from '@/server/community/announcements'
import * as ev from '@/server/community/events'
import { setSubscription } from '@/server/community/levels'

/* ───── Announcements ───── */
export type AnnouncementPayload = { level: 'national' | 'district' | 'local'; title: string; body: string; important?: boolean; media?: ann.ImageInput[] }

export async function createAnnouncementAction(p: AnnouncementPayload) {
  const me = await requireUser()
  const r = await ann.createAnnouncement(me.id, p)
  if (r.ok) revalidatePath('/announcements', 'layout')
  return r
}

export async function editAnnouncementAction(id: string, p: Omit<AnnouncementPayload, 'level'>) {
  const me = await requireUser()
  const r = await ann.editAnnouncement(me.id, id, p)
  if (r.ok) revalidatePath('/announcements', 'layout')
  return r
}

/** Authors delete their own; Tech Admins can remove anyone's (audited). */
export async function deleteAnnouncementAction(id: string) {
  const me = await requireUser()
  const asAdmin = me.role === 'tech_admin'
  const own = await ann.deleteAnnouncement(me.id, id, false)
  const ok = own || (asAdmin && await ann.deleteAnnouncement(me.id, id, true))
  if (ok && !own) await audit('admin.announcement_removed', { actorId: me.id, target: id })
  revalidatePath('/announcements', 'layout')
  return ok
}

export async function setLevelNotifyAction(key: string, on: boolean) {
  const me = await requireUser()
  return setSubscription(me.id, key, on)
}


/* ───── Events ───── */
export type EventPayload = {
  level: 'national' | 'district' | 'local'; title: string; description: string; startsAt: string; endsAt?: string | null
  venue?: string | null; address?: string | null; lat?: number | null; lng?: number | null; onlineUrl?: string | null; coverUrl?: string | null
}
const toInput = (p: EventPayload): ev.EventInput => ({ ...p, startsAt: new Date(p.startsAt), endsAt: p.endsAt ? new Date(p.endsAt) : null })

export async function createEventAction(p: EventPayload) {
  const me = await requireUser()
  const r = await ev.createEvent(me.id, toInput(p))
  if (r.ok) revalidatePath('/events', 'layout')
  return r
}

export async function updateEventAction(id: string, p: Omit<EventPayload, 'level'>) {
  const me = await requireUser()
  const r = await ev.updateEvent(me.id, id, toInput({ ...p, level: 'national' }))
  if (r.ok) revalidatePath('/events', 'layout')
  return r
}

export async function cancelEventAction(id: string) {
  const me = await requireUser()
  const r = await ev.cancelEvent(me.id, id)
  revalidatePath('/events', 'layout')
  return r
}

export async function deleteEventAction(id: string) {
  const me = await requireUser()
  const own = await ev.deleteEvent(me.id, id, false)
  const ok = own || (me.role === 'tech_admin' && await ev.deleteEvent(me.id, id, true))
  if (ok && !own) await audit('admin.event_removed', { actorId: me.id, target: id })
  revalidatePath('/events', 'layout')
  return ok
}

export async function rsvpAction(id: string, status: ev.Rsvp | null) {
  const me = await requireUser()
  const r = await ev.setRsvp(me.id, id, status)
  revalidatePath(`/events/${id}`)
  return r
}
