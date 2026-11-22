import { vi } from 'vitest'
import { inArray, like, or, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { slugify } from '@/lib/identity/normalise'

export const PREFIX = 'ZZTEST-'

/** Captures SMS messages printed by the console provider. */
export function captureSms() {
  const sent: { to: string; text: string }[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    const m = String(args[0] ?? '').match(/\[SMS → \+(\d+)\]\x1b\[0m (.*)/s)
    if (m) sent.push({ to: m[1], text: m[2].trim() })
  })
  const lastCode = () => sent.at(-1)?.text.match(/^(\d{6})/)?.[1] ?? ''
  return { sent, lastCode, restore: () => spy.mockRestore() }
}

export async function makeMember(n: number, opts: { active?: boolean; grant?: boolean } = {}) {
  const dSlug = slugify(`${PREFIX}district`)
  const [d] = await db.insert(schema.districts).values({ name: `${PREFIX}District`, slug: dSlug })
    .onConflictDoUpdate({ target: schema.districts.slug, set: { name: `${PREFIX}District` } }).returning()
  const [a] = await db.insert(schema.assemblies).values({ districtId: d.id, name: `${PREFIX}Assembly`, slug: `${dSlug}-assembly` })
    .onConflictDoUpdate({ target: schema.assemblies.slug, set: { name: `${PREFIX}Assembly` } }).returning()
  const churchId = `${PREFIX}${n}`
  const phone = `23324${String(9000000 + n)}`
  await db.insert(schema.churchMembers).values({ churchId, fullName: `Test Member ${n}`, phone, assemblyId: a.id, active: opts.active ?? true, grantTechAdmin: !!opts.grant })
    .onConflictDoNothing()
  return { churchId, phone, local: `0${phone.slice(3)}` }
}

export async function cleanup() {
  const users = await db.select({ id: schema.users.id }).from(schema.users).where(like(schema.users.churchId, `${PREFIX}%`))
  if (users.length) await db.delete(schema.auditLog).where(inArray(schema.auditLog.actorId, users.map((u) => u.id)))
  await db.delete(schema.auditLog).where(like(schema.auditLog.action, '%zztest%'))
  if (users.length) {
    const ids = users.map((u) => u.id)
    await db.delete(schema.publications).where(inArray(schema.publications.createdBy, ids))
    await db.delete(schema.publicationSeries).where(inArray(schema.publicationSeries.createdBy, ids))
    await db.delete(schema.kidsItems).where(inArray(schema.kidsItems.createdBy, ids))
    await db.delete(schema.lives).where(inArray(schema.lives.createdBy, ids))
    await db.delete(schema.resourceOrders).where(inArray(schema.resourceOrders.buyerId, ids))
    await db.delete(schema.payouts).where(inArray(schema.payouts.userId, ids))
    await db.delete(schema.marketOrders).where(or(inArray(schema.marketOrders.buyerId, ids), inArray(schema.marketOrders.sellerId, ids)))
    await db.delete(schema.marketCheckouts).where(inArray(schema.marketCheckouts.buyerId, ids))
    await db.delete(schema.shops).where(inArray(schema.shops.ownerId, ids))
    await db.delete(schema.payments).where(inArray(schema.payments.userId, ids))
    await db.delete(schema.resources).where(inArray(schema.resources.createdBy, ids))
    await db.delete(schema.funds).where(inArray(schema.funds.createdBy, ids))
  }
  await db.delete(schema.users).where(like(schema.users.churchId, `${PREFIX}%`))
  await db.execute(sql`delete from conversations c where (select count(*) from conversation_members m where m.conversation_id = c.id) < (case when c.kind = 'direct' then 2 else 1 end)`)
  await db.delete(schema.churchMembers).where(or(like(schema.churchMembers.churchId, `${PREFIX}%`), like(schema.churchMembers.churchId, 'ZZCSV%')))
  await db.delete(schema.assemblies).where(like(schema.assemblies.name, `${PREFIX}%`))
  await db.delete(schema.districts).where(like(schema.districts.name, `${PREFIX}%`))
  await db.delete(schema.verificationCodes).where(like(schema.verificationCodes.phone, '233249%'))
  await db.delete(schema.rateLimits).where(or(like(schema.rateLimits.key, '%233249%'), like(schema.rateLimits.key, '%zztest%'), like(schema.rateLimits.key, '%test-ip%'), like(schema.rateLimits.key, '%zz%')))
}

/** Creates a ready account directly (for tests that don't exercise registration). */
export async function makeUser(n: number, username = `zz_u${n}`) {
  const { hashPassword } = await import('@/server/identity/register')
  const m = await makeMember(n)
  const [a] = await db.select({ id: schema.assemblies.id }).from(schema.assemblies).where(like(schema.assemblies.name, `${PREFIX}%`)).limit(1)
  const [u] = await db.insert(schema.users).values({
    churchId: m.churchId, username, fullName: `Test Member ${n}`, phone: m.phone, assemblyId: a.id, passwordHash: await hashPassword('grace2026'),
  }).returning({ id: schema.users.id })
  return { ...m, id: u.id, username }
}
