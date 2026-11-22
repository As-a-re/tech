import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as prayer from '@/server/devotion/prayer'
import * as tst from '@/server/devotion/testimonies'
import * as cm from '@/server/devotion/comments'
import { verseFor, recentVerses, setVerse, removeVerse } from '@/server/devotion/verse'
import { celebrations, monthDays, sendBirthdayNotifications } from '@/server/devotion/birthdays'
import { builtInVerse, BUILT_IN } from '@/lib/devotion/verses'
import { listNotifications } from '@/server/notifications/list'
import { fileReport } from '@/server/moderation/reports'
import { updatePrivacy } from '@/server/account/account'
import * as rel from '@/server/social/relationships'
import { cleanup, makeUser, PREFIX } from './helpers'

type U = { id: string; username: string; churchId: string }
let a: U, b: U, far: U
const view = async (u: U, isAdmin = false) => {
  const [r] = await db.select({ assemblyId: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, u.id))
  return { id: u.id, assemblyId: r.assemblyId, isAdmin }
}
const notes = (userId: string, type: string) => db.$count(schema.notifications, and(eq(schema.notifications.userId, userId), sql`${schema.notifications.type} = ${type}`))

beforeAll(async () => {
  await cleanup()
  a = await makeUser(801, 'zz_pama'); b = await makeUser(802, 'zz_pkofi'); far = await makeUser(803, 'zz_pfar')
  const [d] = await db.insert(schema.districts).values({ name: `${PREFIX}P District`, slug: 'zztest-p-district' }).returning()
  const [as] = await db.insert(schema.assemblies).values({ districtId: d.id, name: `${PREFIX}P Assembly`, slug: 'zztest-p-assembly' }).returning()
  await db.update(schema.users).set({ assemblyId: as.id }).where(eq(schema.users.id, far.id))
})
afterAll(async () => { await db.execute(sql`delete from daily_verses where day = '2031-01-01'`); await db.execute(sql`delete from job_runs where day = '2031-05-05'`); await cleanup(); await pool.end() })

describe('prayer requests', () => {
  it('checks input and hides anonymous names', async () => {
    expect(await prayer.createPrayer(a.id, { body: ' ' })).toEqual({ ok: false, error: 'body' })
    const r = await prayer.createPrayer(a.id, { body: 'Zz pray for my exams', anonymous: true })
    if (!r.ok) throw new Error(r.error)
    expect((await prayer.getPrayer(r.id, await view(b)))?.author).toBeNull()
    expect((await prayer.getPrayer(r.id, await view(a)))?.author?.username).toBe('zz_pama')
    expect((await prayer.getPrayer(r.id, await view(b, true)))?.author?.username).toBe('zz_pama')
    // anonymous requests never show on the author's profile to others
    expect((await prayer.listPrayers({ authorId: a.id, viewer: await view(b) })).items.map((x) => x.id)).not.toContain(r.id)
  })

  it('keeps "my assembly only" requests inside the assembly', async () => {
    const r = await prayer.createPrayer(a.id, { body: 'Zz assembly roof fund', audience: 'assembly' })
    if (!r.ok) throw new Error(r.error)
    expect(await prayer.getPrayer(r.id, await view(b))).not.toBeNull()
    expect(await prayer.getPrayer(r.id, await view(far))).toBeNull()
    expect(await prayer.getPrayer(r.id, null)).toBeNull()
    expect((await prayer.listPrayers({ filter: 'assembly', viewer: await view(b) })).items.map((x) => x.id)).toContain(r.id)
  })

  it('counts "I prayed", tells the author, and tells pray-ers when answered', async () => {
    const r = await prayer.createPrayer(a.id, { body: 'Zz healing for my father' })
    if (!r.ok) throw new Error(r.error)
    expect(await prayer.setPrayed(b.id, r.id, true, await view(b))).toBe(1)
    expect(await prayer.setPrayed(b.id, r.id, true, await view(b))).toBe(1) // once only
    expect(await prayer.setPrayed(far.id, r.id, true, await view(far))).toBe(2)
    const g = (await listNotifications(a.id, 'all')).find((x) => x.type === 'prayed' && x.target?.id === r.id)
    expect(g?.total).toBe(2)
    expect(await prayer.setPrayed(far.id, r.id, false, await view(far))).toBe(1)
    expect((await prayer.listPrayers({ filter: 'prayed', viewer: await view(b) })).items.map((x) => x.id)).toContain(r.id)
    expect(await prayer.markAnswered(b.id, r.id, 'x')).toEqual({ ok: false, error: 'not_found' })
    expect((await prayer.markAnswered(a.id, r.id, 'He is home!')).ok).toBe(true)
    expect(await notes(b.id, 'prayer_answered')).toBe(1)
    expect((await prayer.getPrayer(r.id, null))?.answered?.note).toBe('He is home!')
    expect((await prayer.listPrayers({ filter: 'answered', viewer: null })).items[0].id).toBe(r.id)
  })

  it('takes encouragements and reports, and can be deleted', async () => {
    const r = await prayer.createPrayer(a.id, { body: 'Zz job interview' })
    if (!r.ok) throw new Error(r.error)
    expect(await cm.addComment(b.id, { prayerId: r.id }, ' ')).toEqual({ ok: false, error: 'body' })
    const c = await cm.addComment(b.id, { prayerId: r.id }, 'Praying with you')
    if (!c.ok) throw new Error(c.error)
    expect(await notes(a.id, 'prayer_comment')).toBe(1)
    expect((await prayer.getPrayer(r.id, null))?.commentCount).toBe(1)
    const list = await cm.listComments({ prayerId: r.id }, { id: a.id, isAdmin: false })
    expect(list[0].canDelete).toBe(true) // the request's author can remove comments on it
    expect(await cm.deleteComment(far.id, c.id, false)).toBe(false)
    expect(await cm.deleteComment(a.id, c.id, false)).toBe(true)
    expect((await prayer.getPrayer(r.id, null))?.commentCount).toBe(0)
    expect(await fileReport(b.id, { prayerId: r.id }, 'spam', '')).toEqual({ ok: true })
    expect(await prayer.deletePrayer(b.id, r.id)).toBe(false)
    expect(await prayer.deletePrayer(a.id, r.id)).toBe(true)
    expect(await prayer.getPrayer(r.id, null)).toBeNull()
  })
})

describe('testimonies', () => {
  it('creates, links an own prayer request, takes praise and comments, edits and deletes', async () => {
    const p = await prayer.createPrayer(a.id, { body: 'Zz rent money' })
    const other = await prayer.createPrayer(b.id, { body: 'Zz someone else' })
    if (!p.ok || !other.ok) throw new Error('setup')
    expect(await tst.createTestimony(a.id, { title: 'Hi', body: 'x' })).toEqual({ ok: false, error: 'title' })
    expect(await tst.createTestimony(a.id, { title: 'Zz provision', body: 'God provided', prayerId: other.id })).toEqual({ ok: false, error: 'prayer' })
    const r = await tst.createTestimony(a.id, { title: 'Zz provision', body: 'God provided the rent', prayerId: p.id })
    if (!r.ok) throw new Error(r.error)
    let x = await tst.getTestimony(r.id, b.id)
    expect(x?.prayer?.id).toBe(p.id)
    expect(await tst.setPraise(b.id, r.id, true)).toBe(1)
    expect(await notes(a.id, 'testimony_praise')).toBe(1)
    await cm.addComment(b.id, { testimonyId: r.id }, 'Glory!')
    x = await tst.getTestimony(r.id, b.id)
    expect(x).toMatchObject({ praiseCount: 1, commentCount: 1, viewer: { praised: true, isAuthor: false } })
    expect((await tst.listTestimonies({ viewerId: null, q: 'provision' })).items.map((i) => i.id)).toContain(r.id)
    expect((await tst.editTestimony(b.id, r.id, { title: 'Zz hack', body: 'x' })).ok).toBe(false)
    expect((await tst.editTestimony(a.id, r.id, { title: 'Zz provision!', body: 'God provided the rent on time' })).ok).toBe(true)
    expect((await tst.getTestimony(r.id, null))?.editedAt).toBeTruthy()
    expect(await tst.setPraise(b.id, r.id, false)).toBe(0)
    expect(await tst.deleteTestimony(a.id, r.id)).toBe(true)
    expect(await tst.getTestimony(r.id, null)).toBeNull()
  })
})

describe('verse of the day', () => {
  it('uses the built-in list, or the verse a Tech Admin chose', async () => {
    expect(BUILT_IN.length).toBeGreaterThan(50)
    expect(builtInVerse('2031-01-01')).toEqual(builtInVerse('2031-01-01'))
    expect(builtInVerse('2031-01-01').reference).not.toBe(builtInVerse('2031-01-02').reference)
    expect((await verseFor('2031-01-01')).chosen).toBe(false)
    expect(await setVerse(a.id, { day: '2031-01-01', reference: 'Zz', text: 'x' })).toEqual({ ok: false, error: 'reference' })
    expect(await setVerse(a.id, { day: '2031-01-01', reference: 'Psalm 150:6', text: 'Let every thing that hath breath praise the LORD.' })).toEqual({ ok: true })
    expect(await verseFor('2031-01-01')).toMatchObject({ chosen: true, reference: 'Psalm 150:6' })
    const recent = await recentVerses(3, '2031-01-02')
    expect(recent.map((v) => v.day)).toEqual(['2031-01-02', '2031-01-01', '2030-12-31'])
    expect(recent[1].reference).toBe('Psalm 150:6')
    await removeVerse('2031-01-01')
    expect((await verseFor('2031-01-01')).chosen).toBe(false)
  })
})

describe('birthdays', () => {
  it('lists birthdays (day and month only) and respects privacy', async () => {
    const now = new Date('2031-05-05T09:00:00Z')
    expect(monthDays('today', now)).toEqual(['05-05'])
    expect(monthDays('week', now)).toHaveLength(7)
    expect(monthDays('month', now)).toHaveLength(31)
    await db.update(schema.churchMembers).set({ dateOfBirth: '1990-05-05' }).where(eq(schema.churchMembers.churchId, b.churchId))
    await db.update(schema.churchMembers).set({ dateOfBirth: '1992-05-09' }).where(eq(schema.churchMembers.churchId, far.churchId))
    await db.update(schema.users).set({ anniversary: '2010-05-07' }).where(eq(schema.users.id, a.id))
    const me = await view(a)
    const today = await celebrations(me, 'today', 'all', now)
    expect(today.find((x) => x.id === b.id)).toMatchObject({ kind: 'birthday', monthDay: '05-05', isToday: true })
    const week = await celebrations(me, 'week', 'all', now)
    expect(week.filter((x) => x.username.startsWith('zz_p')).map((x) => `${x.username}:${x.kind}`)).toEqual(['zz_pkofi:birthday', 'zz_pama:anniversary', 'zz_pfar:birthday'])
    expect((await celebrations(me, 'week', 'assembly', now)).some((x) => x.id === far.id)).toBe(false)
    await updatePrivacy(b.id, { showBirthday: false })
    expect((await celebrations(me, 'today', 'all', now)).some((x) => x.id === b.id)).toBe(false)
    await updatePrivacy(b.id, { showBirthday: true })
  })

  it('tells followers once a day', async () => {
    await rel.follow(a.id, b.id)
    const before = await notes(a.id, 'birthday')
    expect(await sendBirthdayNotifications(new Date('2031-05-05T04:00:00Z'))).toBe(0) // too early
    await sendBirthdayNotifications(new Date('2031-05-05T07:00:00Z'))
    await sendBirthdayNotifications(new Date('2031-05-05T08:00:00Z')) // already ran today
    expect(await notes(a.id, 'birthday')).toBe(before + 1)
  })
})
