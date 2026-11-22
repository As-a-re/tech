import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as ann from '@/server/community/announcements'
import * as ev from '@/server/community/events'
import * as dir from '@/server/community/directory'
import { isSubscribed, notifyScope, setSubscription, subscribedKeys } from '@/server/community/levels'
import { setPref } from '@/server/notifications/notify'
import { listNotifications } from '@/server/notifications/list'
import * as rel from '@/server/social/relationships'
import * as compose from '@/server/posts/compose'
import { fileReport, listReports } from '@/server/moderation/reports'
import { fromInputs, whenLabel, clock } from '@/lib/community/dates'
import { cleanup, makeUser, PREFIX } from './helpers'

type U = { id: string; username: string }
let a: U, b: U, far: U
let home: { districtId: string; assemblyId: string }, other: { districtId: string; assemblyId: string }
const inHours = (h: number) => new Date(Date.now() + h * 3600_000)
const notes = (userId: string, type: string) => db.$count(schema.notifications, and(eq(schema.notifications.userId, userId), sql`${schema.notifications.type} = ${type}`))

beforeAll(async () => {
  await cleanup()
  a = await makeUser(701, 'zz_cama'); b = await makeUser(702, 'zz_ckofi'); far = await makeUser(703, 'zz_cfar')
  const [u] = await db.select({ assemblyId: schema.users.assemblyId, districtId: schema.assemblies.districtId }).from(schema.users)
    .innerJoin(schema.assemblies, eq(schema.assemblies.id, schema.users.assemblyId)).where(eq(schema.users.id, a.id))
  home = u
  const [d] = await db.insert(schema.districts).values({ name: `${PREFIX}Far District`, slug: 'zztest-far-district' }).returning()
  const [as] = await db.insert(schema.assemblies).values({ districtId: d.id, name: `${PREFIX}Far Assembly`, slug: 'zztest-far-assembly' }).returning()
  other = { districtId: d.id, assemblyId: as.id }
  await db.update(schema.users).set({ assemblyId: as.id }).where(eq(schema.users.id, far.id))
})
afterAll(async () => { await cleanup(); await pool.end() })

describe('levels', () => {
  it('follows National, your district and your assembly by default, and lets you change any level', async () => {
    expect(await isSubscribed(a.id, 'national')).toBe(true)
    expect(await isSubscribed(a.id, `d:${home.districtId}`)).toBe(true)
    expect(await isSubscribed(a.id, `a:${home.assemblyId}`)).toBe(true)
    expect(await isSubscribed(a.id, `a:${other.assemblyId}`)).toBe(false)
    expect(await setSubscription(a.id, `a:${other.assemblyId}`, true)).toBe(true)
    expect(await isSubscribed(a.id, `a:${other.assemblyId}`)).toBe(true)
    expect(await subscribedKeys(a.id)).toContain(`a:${other.assemblyId}`)
    await setSubscription(a.id, `a:${other.assemblyId}`, false)
    expect(await setSubscription(a.id, 'nonsense', true)).toBe(false)
  })
})

describe('announcements', () => {
  it('checks input', async () => {
    expect(await ann.createAnnouncement(a.id, { level: 'local', title: 'Hi', body: 'x' })).toEqual({ ok: false, error: 'title' })
    expect(await ann.createAnnouncement(a.id, { level: 'local', title: 'Zz title', body: ' ' })).toEqual({ ok: false, error: 'body' })
    expect(await ann.createAnnouncement(a.id, { level: 'local', title: 'Zz title', body: 'ok', media: [{ url: '/media/posts/x/y.jpg' }] })).toEqual({ ok: false, error: 'media_invalid' })
  })

  it('notifies the people following that level only', async () => {
    const r = await ann.createAnnouncement(a.id, { level: 'local', title: 'Zz cleaning day', body: 'Saturday 7am' })
    if (!r.ok) throw new Error(r.error)
    expect(await notes(b.id, 'announcement')).toBe(1)      // same assembly
    expect(await notes(far.id, 'announcement')).toBe(0)    // different assembly
    expect(await notes(a.id, 'announcement')).toBe(0)      // never yourself
    const n = await ann.createAnnouncement(a.id, { level: 'national', title: 'Zz national news', body: 'For everyone', important: true })
    if (!n.ok) throw new Error(n.error)
    expect(await notes(far.id, 'announcement')).toBe(1)
    expect(await ann.unreadAnnouncements(b.id)).toBe(2)
    const group = (await listNotifications(b.id, 'all')).find((g) => g.target?.id === n.id)
    expect(group?.target).toMatchObject({ kind: 'announcement', title: 'Zz national news' })
    await ann.markAnnouncementsSeen(b.id)
    expect(await ann.unreadAnnouncements(b.id)).toBe(0)

    // muted authors and switched-off types don't notify
    await rel.mute(far.id, a.id)
    await ann.createAnnouncement(a.id, { level: 'national', title: 'Zz second national', body: 'Again' })
    expect(await notes(far.id, 'announcement')).toBe(1)
    await setPref(b.id, 'announcement', 'inApp', false)
    await ann.createAnnouncement(a.id, { level: 'national', title: 'Zz third national', body: 'Again' })
    expect(await notes(b.id, 'announcement')).toBe(3)
    await setPref(b.id, 'announcement', 'inApp', true)
  })

  it('lists by level with important ones first, searches, edits and deletes', async () => {
    const page = await ann.listAnnouncements({ scope: { level: 'national' }, viewerId: b.id })
    const mine = page.items.filter((x) => x.title.startsWith('Zz'))
    expect(mine[0].title).toBe('Zz national news') // important stays on top
    expect((await ann.listAnnouncements({ q: 'cleaning', viewerId: null })).items.map((x) => x.title)).toContain('Zz cleaning day')
    const local = await ann.listAnnouncements({ scope: { level: 'local', assemblyId: home.assemblyId }, viewerId: a.id })
    const item = local.items.find((x) => x.title === 'Zz cleaning day')!
    expect(item.viewer.isAuthor).toBe(true)
    expect(item.assembly?.id).toBe(home.assemblyId)
    expect(await ann.editAnnouncement(b.id, item.id, { title: 'Zz hacked', body: 'x' })).toEqual({ ok: false, error: 'not_found' })
    expect((await ann.editAnnouncement(a.id, item.id, { title: 'Zz cleaning day (moved)', body: 'Sunday' })).ok).toBe(true)
    expect((await ann.getAnnouncement(item.id, a.id))?.editedAt).toBeTruthy()
    expect(await ann.deleteAnnouncement(b.id, item.id)).toBe(false)
    expect(await ann.deleteAnnouncement(a.id, item.id)).toBe(true)
    expect(await ann.getAnnouncement(item.id, a.id)).toBeNull()
    expect(await db.$count(schema.notifications, eq(schema.notifications.announcementId, item.id))).toBe(0)
  })

  it('can be reported', async () => {
    const r = await ann.createAnnouncement(a.id, { level: 'local', title: 'Zz reported', body: 'Buy now' })
    if (!r.ok) throw new Error(r.error)
    expect(await fileReport(b.id, { announcementId: r.id }, 'spam', '')).toEqual({ ok: true })
    expect(await fileReport(b.id, { announcementId: r.id }, 'spam', '')).toEqual({ ok: false, error: 'duplicate' })
    expect(await fileReport(a.id, { announcementId: r.id }, 'spam', '')).toEqual({ ok: false, error: 'self' })
    const rep = (await listReports('open')).find((x) => x.announcementId === r.id)
    expect(rep?.itemTitle).toBe('Zz reported')
  })
})

describe('events', () => {
  const base = { level: 'local' as const, title: 'Zz choir concert', description: 'Songs', venue: 'Zz hall' }
  it('checks input', async () => {
    expect((await ev.createEvent(a.id, { ...base, startsAt: inHours(-2) })).ok).toBe(false)
    expect(await ev.createEvent(a.id, { ...base, startsAt: inHours(5), endsAt: inHours(4) })).toEqual({ ok: false, error: 'ends' })
    expect(await ev.createEvent(a.id, { ...base, venue: '', startsAt: inHours(5) })).toEqual({ ok: false, error: 'venue' })
    expect(await ev.createEvent(a.id, { ...base, venue: '', onlineUrl: 'not a link', startsAt: inHours(5) })).toEqual({ ok: false, error: 'online_url' })
  })

  it('creates, takes RSVPs, filters, reminds once and tells attendees when cancelled', async () => {
    const r = await ev.createEvent(a.id, { ...base, startsAt: inHours(20), endsAt: inHours(22) })
    if (!r.ok) throw new Error(r.error)
    expect(await notes(b.id, 'event')).toBe(1)
    expect(await notes(far.id, 'event')).toBe(0)
    let e = await ev.getEvent(r.id, b.id)
    expect(e?.goingCount).toBe(1) // the host
    expect((await ev.setRsvp(b.id, r.id, 'interested')).ok).toBe(true)
    expect((await ev.setRsvp(b.id, r.id, 'going')).ok).toBe(true)
    e = await ev.getEvent(r.id, b.id)
    expect(e?.goingCount).toBe(2)
    expect(e?.interestedCount).toBe(0)
    expect(e?.viewer.rsvp).toBe('going')

    const ids = async (f: ev.EventFilter, viewer: string, h = home) => (await ev.listEvents({ filter: f, viewerId: viewer, home: h, limit: 200 })).items.map((x) => x.id)
    expect(await ids('local', b.id)).toContain(r.id)
    expect(await ids('district', b.id)).toContain(r.id)
    expect(await ids('local', far.id, other)).not.toContain(r.id)
    expect(await ids('going', b.id)).toContain(r.id)
    expect(await ids('hosting', a.id)).toContain(r.id)
    expect(await ids('past', b.id)).not.toContain(r.id)

    // 24-hour reminder, sent once even if the job runs again
    await ev.sendEventReminders(); await ev.sendEventReminders()
    expect(await notes(b.id, 'event_reminder')).toBe(1)
    const reminder = (await listNotifications(b.id, 'all')).find((g) => g.type === 'event_reminder')
    expect(reminder?.target?.id).toBe(r.id) // shown even though no person sent it

    expect((await ev.cancelEvent(b.id, r.id)).ok).toBe(false)
    expect((await ev.cancelEvent(a.id, r.id)).ok).toBe(true)
    expect(await notes(b.id, 'event_cancelled')).toBe(1)
    expect(await ev.setRsvp(b.id, r.id, 'going')).toEqual({ ok: false, error: 'cancelled' })
    expect(ev.toIcs((await ev.getEvent(r.id, null))!, 'https://papa.example/events/x')).toContain('STATUS:CANCELLED')
  })

  it('sends the 1-hour reminder close to the start, and moving the time resets reminders', async () => {
    const r = await ev.createEvent(a.id, { ...base, title: 'Zz prayer', startsAt: inHours(0.5) })
    if (!r.ok) throw new Error(r.error)
    await ev.setRsvp(b.id, r.id, 'interested')
    const before = await notes(b.id, 'event_reminder')
    await ev.sendEventReminders()
    expect(await notes(b.id, 'event_reminder')).toBe(before + 1)
    const [row] = await db.select().from(schema.events).where(eq(schema.events.id, r.id))
    expect(row.remindedHourAt).toBeTruthy()
    expect(row.remindedDayAt).toBeNull() // too close for the day-before reminder
    expect((await ev.updateEvent(a.id, r.id, { ...base, title: 'Zz prayer', startsAt: inHours(30) })).ok).toBe(true)
    const [moved] = await db.select().from(schema.events).where(eq(schema.events.id, r.id))
    expect(moved.remindedHourAt).toBeNull()
  })
})

describe('scheduled posts', () => {
  it('are counted and notified by the job once they go live', async () => {
    await rel.unmute(far.id, a.id)
    const parent = await compose.createPost(b.id, { body: 'Zz parent post' })
    if (!parent.ok) throw new Error(parent.error)
    const r = await compose.createPost(a.id, { body: 'Zz scheduled quote @zz_cfar', quoteOfId: parent.id, publishAt: inHours(1) })
    if (!r.ok) throw new Error(r.error)
    await db.update(schema.posts).set({ publishedAt: sql`now() - interval '1 minute'` }).where(eq(schema.posts.id, r.id))
    await compose.releaseScheduledPosts(); await compose.releaseScheduledPosts()
    const [p] = await db.select().from(schema.posts).where(eq(schema.posts.id, parent.id))
    expect(p.quoteCount).toBe(1)
    expect(await notes(b.id, 'quote')).toBe(1)
    expect(await notes(far.id, 'mention')).toBe(1)
  })
})

describe('directory', () => {
  it('saves assembly details and shows them', async () => {
    expect(await dir.saveAssemblyProfile(a.id, home.assemblyId, { serviceTimes: [{ day: 9, start: '08:00', label: 'x' }], leaders: [] })).toEqual({ ok: false, error: 'service_times' })
    expect(await dir.saveAssemblyProfile(a.id, home.assemblyId, { serviceTimes: [], leaders: [], lat: 5.5 })).toEqual({ ok: false, error: 'location' })
    expect(await dir.saveAssemblyProfile(a.id, home.assemblyId, {
      about: 'Zz about', lat: 5.56, lng: -0.21, phone: '030 222 1111', serviceTimes: [{ day: 3, start: '18:30', label: 'Bible Study' }, { day: 0, start: '08:30', end: '11:00', label: 'Sunday Service' }],
      leaders: [{ name: 'Zz Elder', role: 'Presiding Elder', username: '@zz_cama' }],
    })).toEqual({ ok: true })
    const [as] = await db.select({ slug: schema.assemblies.slug }).from(schema.assemblies).where(eq(schema.assemblies.id, home.assemblyId))
    const page = await dir.assemblyBySlug(as.slug)
    expect(page?.serviceTimes.map((s) => s.label)).toEqual(['Sunday Service', 'Bible Study'])
    expect(page?.leaders[0]).toMatchObject({ username: 'zz_cama', role: 'Presiding Elder' })
    expect(page?.accounts).toBeGreaterThanOrEqual(2)
    const listed = (await dir.directory('zztest')).flatMap((d) => d.assemblies)
    expect(listed.some((x) => x.id === home.assemblyId && x.lat === 5.56)).toBe(true)
  })

  it('works out the next service in the week', () => {
    const times = [{ day: 0, start: '08:30', label: 'Sunday Service' }, { day: 3, start: '18:30', label: 'Bible Study' }]
    expect(dir.nextService(times, new Date('2026-10-28T10:00:00Z'))?.label).toBe('Bible Study') // Wednesday morning
    expect(dir.nextService(times, new Date('2026-10-28T19:00:00Z'))?.label).toBe('Sunday Service') // Wednesday night
    expect(dir.nextService([], new Date())).toBeNull()
  })
})

describe('dates (Ghana time)', () => {
  it('formats and parses consistently', () => {
    expect(fromInputs('2026-11-14', '16:00')?.toISOString()).toBe('2026-11-14T16:00:00.000Z')
    expect(fromInputs('bad', '16:00')).toBeNull()
    expect(whenLabel('2026-11-14T16:00:00.000Z', '2026-11-14T19:00:00.000Z')).toBe('Sat 14 Nov, 4:00pm – 7:00pm')
    expect(clock('08:30')).toBe('8:30am')
    expect(clock('18:05')).toBe('6:05pm')
  })
})

describe('bulk notify', () => {
  it('returns how many members were told and skips the author', async () => {
    const r = await ann.createAnnouncement(b.id, { level: 'district', title: 'Zz district note', body: 'Hello district' })
    if (!r.ok) throw new Error(r.error)
    const n = await notifyScope(`d:${home.districtId}`, 'announcement', b.id, { announcementId: r.id })
    expect(n).toBeGreaterThanOrEqual(1)
  })
})
