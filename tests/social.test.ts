import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, pool, schema } from '@/db'
import { eq } from 'drizzle-orm'
import * as rel from '@/server/social/relationships'
import { loadProfile } from '@/server/social/profile'
import { updatePrivacy } from '@/server/account/account'
import { cleanup, makeUser } from './helpers'

let a: { id: string; username: string }, b: { id: string; username: string }, c: { id: string; username: string }
beforeAll(async () => { await cleanup(); a = await makeUser(101); b = await makeUser(102); c = await makeUser(103) })
afterAll(async () => { await cleanup(); await pool.end() })

describe('follow', () => {
  it('follows a public profile and counts it', async () => {
    expect(await rel.follow(a.id, b.id)).toBe('following')
    expect(await rel.follow(a.id, a.id)).toBe('self')
    expect((await rel.counts(b.id)).followers).toBe(1)
    const r = await rel.relationship(b.id, a.id)
    expect(r.followsYou).toBe(true)
    await rel.unfollow(a.id, b.id)
    expect((await rel.counts(b.id)).followers).toBe(0)
  })

  it('private profiles get requests that can be accepted or declined', async () => {
    await updatePrivacy(b.id, { privateProfile: true })
    expect(await rel.follow(a.id, b.id)).toBe('requested')
    expect(await rel.follow(c.id, b.id)).toBe('requested')
    expect((await rel.counts(b.id)).requests).toBe(2)
    expect((await loadProfile(b.username, a.id))?.access).toBe('private')
    await rel.answerRequest(b.id, a.id, true)
    await rel.answerRequest(b.id, c.id, false)
    expect((await loadProfile(b.username, a.id))?.access).toBe('full')
    expect((await loadProfile(b.username, c.id))?.access).toBe('private')
    expect((await rel.counts(b.id)).requests).toBe(0)
  })

  it('making a profile public approves everyone waiting', async () => {
    await rel.follow(c.id, b.id)
    await updatePrivacy(b.id, { privateProfile: false })
    expect((await rel.relationship(c.id, b.id)).following).toBe(true)
  })

  it('lists followers newest first', async () => {
    const list = await rel.listPeople('followers', b.id)
    expect(list.map((p) => p.username)).toEqual([c.username, a.username])
  })
})

describe('block and mute', () => {
  it('blocking removes follows both ways and prevents following', async () => {
    await rel.follow(b.id, c.id)
    await rel.block(c.id, b.id)
    expect((await rel.relationship(b.id, c.id)).following).toBe(false)
    expect((await rel.relationship(c.id, b.id)).following).toBe(false)
    expect(await rel.follow(b.id, c.id)).toBe('blocked')
    expect((await loadProfile(c.username, b.id))?.access).toBe('blocked_by')
    expect((await loadProfile(b.username, c.id))?.access).toBe('blocked')
    await rel.unblock(c.id, b.id)
    expect((await loadProfile(c.username, b.id))?.access).toBe('full')
  })

  it('mute is private to the muter', async () => {
    await rel.mute(a.id, c.id)
    expect((await rel.relationship(a.id, c.id)).muting).toBe(true)
    expect((await rel.relationship(c.id, a.id)).muting).toBe(false)
    expect((await rel.listPeople('muted', a.id)).map((p) => p.id)).toEqual([c.id])
    await rel.unmute(a.id, c.id)
    expect(await rel.listPeople('muted', a.id)).toEqual([])
  })

  it('guests see members-only profiles as restricted', async () => {
    await updatePrivacy(a.id, { visibleToGuests: false })
    expect((await loadProfile(a.username, null))?.access).toBe('members_only')
    expect((await loadProfile(a.username, b.id))?.access).toBe('full')
  })

  it('suspended members have no profile page', async () => {
    await db.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.id, c.id))
    expect(await loadProfile(c.username, a.id)).toBeNull()
    await db.update(schema.users).set({ status: 'active' }).where(eq(schema.users.id, c.id))
  })
})
